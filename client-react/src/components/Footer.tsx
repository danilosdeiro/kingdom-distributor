import './Footer.css';

export function Footer() {
  const anoAtual = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <p>&copy; {anoAtual} Meu Kingdom | Desenvolvido por Danilo Deiró</p>
    </footer>
  );
}