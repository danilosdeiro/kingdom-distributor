// src/App.tsx

import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ConnectionStatus } from './components/ConnectionStatus';
import { Footer } from './components/Footer';
import { SideMenu } from './components/SideMenu';
import { AppUpdateNotice } from './components/AppUpdateNotice';
import { AppUpdateProvider } from './contexts/AppUpdateProvider';
import { toast, Toaster } from 'react-hot-toast';
import { socket } from './services/socket';
import { saveRoomRecovery } from './services/roomRecovery';
import './App.css';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Lógica de toggle: se o menu está aberto, fecha; se está fechado, abre.
  const toggleMenu = () => setIsMenuOpen((current) => !current);
  const closeMenu = () => setIsMenuOpen(false);

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

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  return (
    <AppUpdateProvider>
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
        aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={isMenuOpen}
        aria-controls="app-side-menu"
      >
        {/* As três linhas do ícone de hamburguer */}
        <div className="line line1"></div>
        <div className="line line2"></div>
        <div className="line line3"></div>
      </button>
      
      <SideMenu isOpen={isMenuOpen} onClose={closeMenu} />
      
      <main className="main-content" aria-hidden={isMenuOpen}>
        <Outlet />
      </main>

      <Footer />
      <AppUpdateNotice />
    </div>
    </AppUpdateProvider>
  );
}

export default App;
