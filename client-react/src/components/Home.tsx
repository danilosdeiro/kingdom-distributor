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
  
  // 👇 PASSO 1: O novo estado fica aqui, junto com os outros!
  const [temSalaSalva, setTemSalaSalva] = useState(false);

  const navigate = useNavigate();

  // 👇 PASSO 2: O novo useEffect que checa o localStorage ao abrir a tela inicial
  useEffect(() => {
    if(localStorage.getItem('salaAtual') && localStorage.getItem('meuNome')) {
        setTemSalaSalva(true);
    }
  }, []);

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

  // 👇 PASSO 3: A nova função fica aqui, junto com as outras funções "handle"
  const handleReconectar = () => {
    const codigo = localStorage.getItem('salaAtual');
    const nomeSalvo = localStorage.getItem('meuNome');
    if(codigo && nomeSalvo) {
       // Opcional: Atualiza o estado da tela para os dados salvos
       setCodigoSala(codigo);
       setNome(nomeSalvo);
       // Dispara a reconexão
       socket.emit('entrarSala', { codigo, nome: nomeSalvo });
    }
  }

  const handleCriarSala = () => {
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    
    // NOVO: Salva o nome para poder reconectar depois
    localStorage.setItem('meuNome', nome.trim()); 
    
    socket.emit('criarSala', { nome: nome.trim() });
  };

  const handleEntrarSala = () => {
    localStorage.removeItem('ultimoPapel');
    setTemPapelSalvo(false);
    
    // NOVO: Salva o nome e a sala para poder reconectar depois
    localStorage.setItem('meuNome', nome.trim());
    localStorage.setItem('salaAtual', codigoSala.trim().toUpperCase());
    
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
          <div className="card last-role-card" style={{ marginBottom: temSalaSalva ? '10px' : '20px' }}>
            <button className="last-role-button" onClick={handleVerUltimoPapel}>
              Ver Meu Último Papel
            </button>
          </div>
        )}

        {/* 👇 PASSO 4: O novo botão de reconectar entra aqui na interface! */}
        {temSalaSalva && (
          <div className="card last-role-card" style={{ marginBottom: '20px' }}>
            <button className="last-role-button" onClick={handleReconectar} style={{ borderColor: '#34c759', color: '#34c759' }}>
              Reconectar à Última Sala
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