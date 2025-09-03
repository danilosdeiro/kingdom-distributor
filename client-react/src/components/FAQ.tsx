import './FAQ.css';

export function FAQ() {
  return (
    <div className="faq-container">
      <h2>FAQ - Meu Kingdom</h2>

      <div className="faq-item">
        <h4>Qual é o objetivo do Rei?</h4>
        <p>O Rei vence se for o último jogador sobrevivente na mesa, ou se restar apenas ele e o seu Cavaleiro.</p>
      </div>

      <div className="faq-item">
        <h4>Qual é o objetivo do Cavaleiro?</h4>
        <p>O Cavaleiro é o guarda-costas do Rei. Ele vence se o Rei vencer. O seu dever é proteger o Rei a todo custo.</p>
      </div>

      <div className="faq-item">
        <h4>Qual é o objetivo do Assassino?</h4>
        <p>Os Assassinos são cruéis, o seu objetivo é matar o Rei. Se o Rei for eliminado (não sendo pelo Usurpador), todos os Assassinos vencem.</p>
      </div>

      <div className="faq-item">
        <h4>Qual é o objetivo do Usurpador?</h4>
        <p>O usurpador é um lobo solitário. O seu objetivo é matar o Rei e se tornar o rei. Ao eliminar o rei, o usurpador se torna o novo Rei e ganha 10 de vida e passa a ter a função do Rei</p>
      </div>


      <div className="faq-item">
        <h4>Qual o objetivo do Coringa?</h4>
        <p>O Coringa tem dois objetivos: <br/> 1. Ser o primeiro jogador a morrer. Se conseguir, ele vence sozinho. <br/>2. Se não for o primeiro a morrer, o seu objetivo muda: ele precisa de eliminar um jogador para roubar o papel e o objetivo desse jogador (exceto o do Rei).</p>
      </div>

      <div className="faq-item">
        <h4>Qual o objetivo do Caçador?</h4>
        <p>O Caçador é ardiloso e vence o jogo se ele for o responsável por eliminar dois jogadores que não sejam o rei.</p>
      </div>

    </div>
  );
}