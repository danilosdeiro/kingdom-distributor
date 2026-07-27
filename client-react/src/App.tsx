// src/App.tsx

import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Footer } from './components/Footer';
import { SideMenu } from './components/SideMenu';
import { toast, Toaster } from 'react-hot-toast';
import { socket } from './services/socket';
import { saveRoomRecovery } from './services/roomRecovery';
import './App.css';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Lógica de toggle: se o menu está aberto, fecha; se está fechado, abre.
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  useEffect(() => {
    const handleSalvarRecuperacao = (data: { codigo: string; token: string }) => {
      saveRoomRecovery(data);
    };
    const handleSalaRecuperada = ({ mensagem }: { mensagem: string }) => {
      toast.success(mensagem, { duration: 5000 });
    };

    socket.on('salvarRecuperacaoSala', handleSalvarRecuperacao);
    socket.on('salaRecuperada', handleSalaRecuperada);

    return () => {
      socket.off('salvarRecuperacaoSala', handleSalvarRecuperacao);
      socket.off('salaRecuperada', handleSalaRecuperada);
    };
  }, []);

  return (
    // Adiciona uma classe ao layout quando o menu está aberto
    // Útil para, por exemplo, impedir o scroll da página de fundo
    <div className={`app-layout ${isMenuOpen ? 'menu-open' : ''}`}>
    <Toaster 
      position="top-center" 
      reverseOrder={false} 
      gutter={8}
      containerStyle={{ top: 40 }} // Para não cobrir a coroa
      toastOptions={{
        duration: 3000,
        style: {
          background: '#333',
          color: '#fff',
        },
      }}
    />

      <ConnectionStatus />

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
