// src/App.tsx

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Footer } from './components/Footer';
import { SideMenu } from './components/SideMenu';
import { Toaster } from 'react-hot-toast';
import './App.css';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Lógica de toggle: se o menu está aberto, fecha; se está fechado, abre.
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    // Adiciona uma classe ao layout quando o menu está aberto
    // Útil para, por exemplo, impedir o scroll da página de fundo
    <div className={`app-layout ${isMenuOpen ? 'menu-open' : ''}`}>
      <Toaster 
        position="top-center"
        toastOptions={{ style: { background: '#333', color: '#fff' } }}
      />

      {/* Botão de Menu ATUALIZADO */}
      <button 
        className={`menu-toggle-button ${isMenuOpen ? 'open' : ''}`} 
        onClick={toggleMenu}
        aria-label="Abrir menu"
      >
        {/* As três linhas do ícone de hamburguer */}
        <div className="line line1"></div>
        <div className="line line2"></div>
        <div className="line line3"></div>
      </button>
      
      <SideMenu isOpen={isMenuOpen} onClose={toggleMenu} />
      
      <main className="main-content">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

export default App;