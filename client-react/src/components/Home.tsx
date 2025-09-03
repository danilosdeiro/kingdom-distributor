import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { socket } from '../services/socket';
import { toast } from 'react-hot-toast';
import './Home.css';

import logoMeuKingdom from '../assets/meuking.png';

export function Home() {
  const [nome, setNome] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [temPapelSalvo, setTemPapelSalvo] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const papelSalvo = localStorage.getItem('ultimoPapel');
    if (papelSalvo) setTemPapelSalvo(true);

    socket.on('salaCriada', ({ codigo, jogadores }) => {
      navigate(`/lobby/${codigo}`, { state: { jogadoresIniciais: jogadores } });
    });
    
    socket.on('entradaComSucesso', () => {
      navigate(`/lobby/${codigoSala.toUpperCase()}`, { state: { entrouNaSala: true } });
    });
    
    socket.on('erro', ({ mensagem }) => { 
      toast.error(mensagem); 
    });

    return () => {
      socket.off('salaCriada');
      socket.off('entradaComSucesso');
      socket.off('erro');
    };
  }, [navigate, codigoSala]);

  const handleCriarSala = () => {
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    socket.emit('criarSala', { nome: nome.trim() });
  };

  const handleEntrarSala = () => {
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    socket.emit('entrarSala', { 
      codigo: codigoSala.trim().toUpperCase(), 
      nome: nome.trim() 
    });
  };

  const handleVerUltimoPapel = () => { navigate('/role'); };

  return (
    <div className="home-container">
      <div className="title-container">
        <Link to="/" className="main-logo-link">
          <img 
            src={logoMeuKingdom} 
            alt="Meu Kingdom: Organize e distribua papéis para suas partidas" 
            className="main-logo" 
          />
        </Link>
      </div>
      
      <div className="content-container">
        {temPapelSalvo && (
          <div className="card last-role-card">
            <button className="last-role-button" onClick={handleVerUltimoPapel}>
              Ver Meu Último Papel
            </button>
          </div>
        )}

        <div className="card primary-card-group">
          <div className="form-group">
            <label htmlFor="nome">Seu Nome</label>
            <input 
              id="nome" 
              type="text" 
              value={nome} 
              onChange={(e) => setNome(e.target.value)} 
              placeholder="Digite seu nome de jogador" 
            />
          </div>
          <div className="form-group">
            <label htmlFor="codigo">Código da Sala</label>
            <input 
              id="codigo" 
              type="text" 
              value={codigoSala} 
              onChange={(e) => setCodigoSala(e.target.value)} 
              placeholder="Ex: ABCD" 
            />
          </div>
          <button 
            className="primary-button" 
            onClick={handleEntrarSala} 
            disabled={!nome.trim() || !codigoSala.trim()}
          >
            Entrar na Sala
          </button>
        </div>

        <div className="secondary-action">
          <p className="or-separator">ou</p>
          <button 
            className="secondary-button create-room-button"
            onClick={handleCriarSala} 
            disabled={!nome.trim()}
          >
            Crie uma Nova Sala
          </button>
        </div>
      </div>
    </div>
  );
}