import { useState, type CSSProperties } from 'react';
import {
  ChevronDown,
  Crown,
  HeartPulse,
  Shield,
  Swords,
  Target,
  type LucideIcon,
} from 'lucide-react';
import './FAQ.css';

type GuideTab = 'kingdom' | 'magic-war' | 'commander';

interface GuideItem {
  title: string;
  description: string;
  accent?: string;
}

interface GuideContent {
  eyebrow: string;
  title: string;
  summary: string;
  items: GuideItem[];
}

const GUIDE_TABS: Array<{
  id: GuideTab;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'kingdom', label: 'Kingdom', icon: Crown },
  { id: 'magic-war', label: 'Magic War', icon: Target },
  { id: 'commander', label: 'Commander', icon: HeartPulse },
];

const GUIDE_CONTENT: Record<GuideTab, GuideContent> = {
  kingdom: {
    eyebrow: '5 a 7 jogadores',
    title: 'Papéis secretos',
    summary: 'Cada jogador recebe um papel e vence ao cumprir o objetivo indicado na própria tela.',
    items: [
      {
        title: 'Rei',
        description: 'Proteja a coroa. O Rei vence quando os dois Assassinos forem eliminados.',
        accent: '#f4c542',
      },
      {
        title: 'Cavaleiro',
        description: 'Proteja o Rei. Quando o Rei vence, o Cavaleiro vence junto.',
        accent: '#72a7e8',
      },
      {
        title: 'Assassinos',
        description: 'Eliminem o Rei. A vitória é imediata, exceto quando o último golpe for do Usurpador.',
        accent: '#e45f68',
      },
      {
        title: 'Usurpador',
        description: 'Elimine o Rei pessoalmente. Você assume a coroa, ganha 10 de vida e passa a jogar como o novo Rei.',
        accent: '#b985e8',
      },
      {
        title: 'Coringa',
        description: 'Vença sendo o primeiro eliminado. Se isso não acontecer, elimine alguém para roubar o papel e o objetivo dessa pessoa, exceto o Rei.',
        accent: '#e98ebc',
      },
      {
        title: 'Caçador',
        description: 'Seja responsável por duas eliminações que não sejam a do Rei.',
        accent: '#61c49a',
      },
    ],
  },
  'magic-war': {
    eyebrow: '3 a 7 jogadores',
    title: 'Caçada por cores',
    summary: 'Sua cor é pública, mas somente você conhece a cor que precisa eliminar.',
    items: [
      {
        title: 'Escolha das cores',
        description: 'Cada pessoa pode reservar uma cor no lobby. Quem não escolher recebe automaticamente uma cor disponível.',
      },
      {
        title: 'Missão principal',
        description: 'Você vence imediatamente se der o último golpe no jogador da cor mostrada como seu alvo.',
      },
      {
        title: 'Alvo eliminado por outro',
        description: 'Se outra pessoa eliminar seu alvo, sua missão muda: você precisa ser o último sobrevivente.',
      },
      {
        title: 'Registro da eliminação',
        description: 'A vítima informa quem deu o último golpe. Se o celular dela estiver indisponível, o host pode registrar por ela.',
      },
      {
        title: 'Informação permanente',
        description: 'As cores permanecem visíveis ao lado dos jogadores durante toda a partida.',
      },
    ],
  },
  commander: {
    eyebrow: 'Contador compartilhado',
    title: 'Vida e comandante',
    summary: 'Todos acompanham a vida da mesa em tempo real, sem precisar de um segundo aplicativo.',
    items: [
      {
        title: 'Vida inicial',
        description: 'Cada jogador começa com 40 de vida. Os controles rápidos alteram 1 ou 5 pontos por toque.',
      },
      {
        title: 'Dano de comandante',
        description: 'Cada ponto de dano de comandante também reduz a vida. Ao chegar a 21 do mesmo comandante, registre a eliminação.',
      },
      {
        title: 'Comandante roubado',
        description: 'Seu próprio nome aparece entre os comandantes porque um adversário pode controlar sua criatura e causar dano com ela.',
      },
      {
        title: 'Partner',
        description: 'Adicione o segundo comandante quando estiver usando Partner. O dano de cada comandante é acompanhado separadamente.',
      },
      {
        title: 'Conferência e correção',
        description: 'Toque no nome de alguém para conferir os danos recebidos. A última alteração pode ser desfeita.',
      },
    ],
  },
};

export function FAQ() {
  const [activeTab, setActiveTab] = useState<GuideTab>('kingdom');
  const [openItem, setOpenItem] = useState<string | null>('Rei');
  const content = GUIDE_CONTENT[activeTab];

  const selectTab = (tab: GuideTab) => {
    setActiveTab(tab);
    setOpenItem(null);
  };

  return (
    <section className="game-guide" aria-labelledby="game-guide-title">
      <div className="game-guide-heading">
        <Swords size={20} aria-hidden="true" />
        <h2 id="game-guide-title">Guia de jogo</h2>
      </div>

      <div className="game-guide-tabs" role="tablist" aria-label="Regras por modo">
        {GUIDE_TABS.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            aria-controls={`guide-panel-${id}`}
            className={activeTab === id ? 'active' : ''}
            onClick={() => selectTab(id)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div
        id={`guide-panel-${activeTab}`}
        className="game-guide-panel"
        role="tabpanel"
      >
        <div className="game-guide-intro">
          <span>{content.eyebrow}</span>
          <h3>{content.title}</h3>
          <p>{content.summary}</p>
        </div>

        <div className="game-guide-list">
          {content.items.map((item) => {
            const itemId = `${activeTab}-${item.title}`;
            const isOpen = openItem === itemId || openItem === item.title;

            return (
              <article
                className={`game-guide-item ${isOpen ? 'open' : ''}`}
                key={item.title}
                style={{ '--guide-accent': item.accent || '#8fc7a7' } as CSSProperties}
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${itemId}-content`}
                  onClick={() => setOpenItem(isOpen ? null : itemId)}
                >
                  <span className="game-guide-item-mark" aria-hidden="true" />
                  <strong>{item.title}</strong>
                  <ChevronDown size={19} aria-hidden="true" />
                </button>
                <div id={`${itemId}-content`} className="game-guide-answer" hidden={!isOpen}>
                  <Shield size={16} aria-hidden="true" />
                  <p>{item.description}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
