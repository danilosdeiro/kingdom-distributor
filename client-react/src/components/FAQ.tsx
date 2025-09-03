import './FAQ.css';

export function FAQ() {
  return (
    <div className="faq-container">
      <h2>FAQ - Kingdom Commander</h2>

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
        <p>O Assassino é um lobo solitário. O seu objetivo é matar o Rei. Se o Rei for eliminado (e não pelo Usurpador), todos os Assassinos vencem.</p>
      </div>

      <div className="faq-item">
        <h4>E o Coringa?</h4>
        <p>O Coringa tem dois objetivos: 1º) Ser o primeiro jogador a morrer. Se conseguir, ele vence sozinho. 2º) Se não for o primeiro a morrer, o seu objetivo muda: ele precisa de eliminar um jogador para roubar o papel e o objetivo desse jogador (exceto o do Rei).</p>
      </div>

    </div>
  );
}