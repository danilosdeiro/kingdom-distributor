import { useState, type CSSProperties } from 'react';
import {
  ChevronDown,
  BookOpen,
  Crown,
  Swords,
  Target,
  type LucideIcon,
} from 'lucide-react';
import './FAQ.css';

type GuideTab = 'kingdom' | 'magic-war' | 'rules';

interface GuideItem {
  title: string;
  description?: string;
  victory?: string;
  defeat?: string;
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
  { id: 'rules', label: 'Regras', icon: BookOpen },
];

const GUIDE_CONTENT: Record<GuideTab, GuideContent> = {
  kingdom: {
    eyebrow: '5 a 7 jogadores',
    title: 'Papéis secretos',
    summary: 'Há sempre um Rei, um Cavaleiro e dois Assassinos. Os outros papéis dependem do modo escolhido no lobby.',
    items: [
      {
        title: 'Rei',
        victory: 'Os dois Assassinos forem eliminados.',
        defeat: 'Você for eliminado. Se o Usurpador der o último golpe, ele assume a coroa e a partida continua.',
        accent: '#f4c542',
      },
      {
        title: 'Cavaleiro',
        victory: 'O Rei vencer. Sua missão é mantê-lo vivo.',
        defeat: 'O Rei perder a partida.',
        accent: '#72a7e8',
      },
      {
        title: 'Assassinos',
        victory: 'O Rei for eliminado por qualquer jogador que não seja o Usurpador.',
        defeat: 'Os dois Assassinos forem eliminados.',
        accent: '#e45f68',
      },
      {
        title: 'Usurpador',
        victory: 'Você der o último golpe no Rei, assumir a coroa e depois eliminar os Assassinos.',
        defeat: 'Você for eliminado antes de assumir a coroa ou outra equipe encerrar a partida.',
        accent: '#b985e8',
      },
      {
        title: 'Coringa',
        victory: 'Você for o primeiro eliminado. Se não for, ainda pode eliminar alguém, assumir o papel dessa pessoa e cumprir o novo objetivo.',
        defeat: 'A partida terminar antes de você cumprir um desses objetivos. O papel do Rei não pode ser roubado.',
        accent: '#e98ebc',
      },
      {
        title: 'Caçador',
        victory: 'Você der o último golpe em dois jogadores que não sejam o Rei.',
        defeat: 'Você for eliminado antes da segunda presa. Se matar o Rei, a vitória fica com os Assassinos.',
        accent: '#61c49a',
      },
    ],
  },
  'magic-war': {
    eyebrow: '3 a 7 jogadores',
    title: 'Caçada por cores',
    summary: 'Todo jogador tem uma cor visível e recebe, em segredo, a cor que precisa caçar.',
    items: [
      {
        title: 'Escolha das cores',
        description: 'Cada pessoa pode escolher sua cor antes do sorteio. Quem não escolher recebe uma das cores que sobraram.',
      },
      {
        title: 'Missão principal',
        victory: 'Você der o último golpe no jogador da cor que recebeu como alvo.',
        defeat: 'Você for eliminado antes de cumprir sua missão.',
      },
      {
        title: 'Alvo eliminado por outro',
        description: 'Se outra pessoa eliminar seu alvo, você não recebe um novo alvo. A partir daí, só vence se for o último sobrevivente.',
      },
      {
        title: 'Registro da eliminação',
        description: 'Quem foi eliminado informa quem deu o último golpe. Se não puder fazer isso, o host registra a eliminação.',
      },
      {
        title: 'Informação permanente',
        description: 'As cores são públicas durante toda a partida. O alvo de cada pessoa continua secreto.',
      },
    ],
  },
  rules: {
    eyebrow: 'Regras da partida',
    title: 'Vida e eliminação',
    summary: 'Estas condições valem durante as partidas organizadas pelo MeuKingdom.',
    items: [
      {
        title: 'Vida inicial',
        description: 'Todos começam com 40 de vida. O jogador que recebe o papel de Rei começa com 50.',
      },
      {
        title: 'Zero de vida',
        description: 'Ao chegar a zero de vida, o jogador é eliminado e deve informar quem deu o último golpe.',
      },
      {
        title: 'Dano de comandante',
        description: 'Ao receber 21 pontos de um mesmo comandante, o jogador é eliminado. Esse dano também reduz a vida normalmente.',
      },
      {
        title: 'Partner',
        description: 'Quando uma dupla de comandantes usa Partner, o dano de cada comandante é contado separadamente.',
      },
      {
        title: 'Último golpe',
        description: 'A pessoa responsável pelo último golpe é quem recebe a eliminação. Isso pode definir a vitória de um papel ou mudar um objetivo.',
      },
      {
        title: 'Depois da eliminação',
        description: 'O jogador eliminado deixa o combate, mas continua na sala acompanhando o restante da partida.',
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
                  {item.description && <p>{item.description}</p>}
                  {item.victory && (
                    <p>
                      <span className="rule-label victory">Você vence quando</span>
                      {item.victory}
                    </p>
                  )}
                  {item.defeat && (
                    <p>
                      <span className="rule-label defeat">Você perde quando</span>
                      {item.defeat}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
