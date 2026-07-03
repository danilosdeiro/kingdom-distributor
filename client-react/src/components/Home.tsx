import { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { socket } from '../services/socket';
import { getPlayerId } from '../services/playerIdentity';
import { clearRoomSession } from '../services/roomSession';
import { toast } from 'react-hot-toast';
import './Home.css';

import logoMeuKingdom from '../assets/meuking.png';

interface Jogador {
  id: string;
  nome: string;
}

export function Home() {
  const { codigoConvite } = useParams();
  const [nome, setNome] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [temPapelSalvo, setTemPapelSalvo] = useState(false);
  const [temSalaSalva, setTemSalaSalva] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const nomeSalvo = localStorage.getItem('meuNome');
    if (nomeSalvo) {
      setNome(nomeSalvo);
    }

    setTemSalaSalva(Boolean(localStorage.getItem('salaAtual') && localStorage.getItem('meuNome')));
    setTemPapelSalvo(Boolean(sessionStorage.getItem('ultimoPapel')));
  }, []);

  useEffect(() => {
    if (!codigoConvite) return;

    const codigoLimpo = codigoConvite.toUpperCase();
    setCodigoSala(codigoLimpo);
    toast.success(`Sala ${codigoLimpo} detectada!`, {
      icon: '🔗',
      id: 'convite-toast',
    });
  }, [codigoConvite]);

  useEffect(() => {
    const handleSalaCriada = ({ codigo, jogadores }: { codigo: string; jogadores: Jogador[] }) => {
      localStorage.setItem('salaAtual', codigo);
      navigate(`/lobby/${codigo}`, { state: { jogadoresIniciais: jogadores } });
    };

    const handleEntradaComSucesso = () => {
      const salaDestino = localStorage.getItem('salaAtual');
      if (salaDestino) {
        navigate(`/lobby/${salaDestino}`, { state: { entrouNaSala: true } });
      }
    };

    const handleErro = ({ mensagem }: { mensagem: string }) => {
      toast.error(mensagem);
      if (mensagem.toLowerCase().includes('sala nao encontrada')) {
        clearRoomSession();
        setTemSalaSalva(false);
        setTemPapelSalvo(false);
      }
    };

    socket.on('salaCriada', handleSalaCriada);
    socket.on('entradaComSucesso', handleEntradaComSucesso);
    socket.on('erro', handleErro);

    return () => {
      socket.off('salaCriada', handleSalaCriada);
      socket.off('entradaComSucesso', handleEntradaComSucesso);
      socket.off('erro', handleErro);
    };
  }, [navigate]);

  const handleReconectar = () => {
    const codigo = localStorage.getItem('salaAtual');
    const nomeSalvo = localStorage.getItem('meuNome');

    if (codigo && nomeSalvo) {
      setCodigoSala(codigo);
      setNome(nomeSalvo);
      socket.emit('entrarSala', { codigo, nome: nomeSalvo, playerId: getPlayerId() });
    }
  };

  const handleCriarSala = () => {
    if (!nome.trim()) {
      toast.error('Digite seu nome primeiro!');
      return;
    }

    clearRoomSession();
    setTemPapelSalvo(false);
    setTemSalaSalva(false);
    localStorage.setItem('meuNome', nome.trim());
    socket.emit('criarSala', { nome: nome.trim(), playerId: getPlayerId() });
  };

  const handleEntrarSala = () => {
    if (!nome.trim() || !codigoSala.trim()) {
      toast.error('Preencha nome e código!');
      return;
    }

    const codigoLimpo = codigoSala.trim().toUpperCase();

    clearRoomSession();
    setTemPapelSalvo(false);
    setTemSalaSalva(false);
    localStorage.setItem('meuNome', nome.trim());
    localStorage.setItem('salaAtual', codigoLimpo);

    socket.emit('entrarSala', {
      codigo: codigoLimpo,
      nome: nome.trim(),
      playerId: getPlayerId(),
    });
  };

  const handleVerUltimoPapel = () => {
    navigate('/role');
  };

  return (
    <div className="home-container">
      <div className="title-container">
        <Link to="/" className="main-logo-link">
          <img
            src={logoMeuKingdom}
            alt="Meu Kingdom"
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
