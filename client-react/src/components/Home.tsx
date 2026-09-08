import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { socket } from '../services/socket';
import { ensureBackendReady } from '../services/backendAvailability';
import { gameState } from '../services/gameState';
import { getPlayerId } from '../services/playerIdentity';
import { cancelSavedRoomRejoin, rejoinSavedRoom } from '../services/rejoinRoom';
import { clearRoomSession } from '../services/roomSession';
import {
  beginRoomSync,
  subscribeToRoomConnection,
} from '../services/roomConnection';
import { showSocketError, type SocketErrorPayload } from '../services/socketError';
import { toast } from 'react-hot-toast';
import './Home.css';

import logoMeuKingdom from '../assets/meuking.png';

interface Jogador {
  id: string;
  nome: string;
}

interface PapelInfo {
  papel: string;
  objetivo: string;
}

export function Home() {
  const { codigoConvite } = useParams();
  const [nome, setNome] = useState('');
  const [codigoSala, setCodigoSala] = useState('');
  const [temPapelSalvo, setTemPapelSalvo] = useState(false);
  const [temSalaSalva, setTemSalaSalva] = useState(false);
  const [reconectando, setReconectando] = useState(false);
  const [servidorIniciando, setServidorIniciando] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState<'criar' | 'entrar' | null>(null);
  const serverStartingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = useNavigate();

  const encerrarEsperaDeReconexao = useCallback(() => {
    if (serverStartingTimer.current) {
      clearTimeout(serverStartingTimer.current);
      serverStartingTimer.current = null;
    }
    setReconectando(false);
    setServidorIniciando(false);
    setAcaoPendente(null);
  }, []);

  const prepararServidor = useCallback(async (acao: 'criar' | 'entrar') => {
    setAcaoPendente(acao);
    setServidorIniciando(false);
    serverStartingTimer.current = setTimeout(() => setServidorIniciando(true), 5000);

    try {
      await ensureBackendReady();
      return true;
    } catch (error) {
      encerrarEsperaDeReconexao();
      toast.error(error instanceof Error && error.message === 'offline'
        ? 'Sem internet. Verifique sua conexão e tente novamente.'
        : 'O servidor demorou para responder. Tente novamente.');
      return false;
    }
  }, [encerrarEsperaDeReconexao]);

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
      encerrarEsperaDeReconexao();
      localStorage.setItem('salaAtual', codigo);
      navigate(`/lobby/${codigo}`, { state: { jogadoresIniciais: jogadores } });
    };

    const handleEntradaComSucesso = () => {
      encerrarEsperaDeReconexao();
      const salaDestino = localStorage.getItem('salaAtual');
      if (salaDestino) {
        navigate(`/lobby/${salaDestino}`, { state: { entrouNaSala: true } });
      }
    };

    const handleSeuPapel = (papelInfo: PapelInfo) => {
      gameState.setMeuPapel(papelInfo);
      sessionStorage.setItem('ultimoPapel', JSON.stringify(papelInfo));
      navigate('/role', { replace: true });
    };

    const handleErro = (error: SocketErrorPayload) => {
      encerrarEsperaDeReconexao();
      showSocketError(error);
      const { mensagem } = error;
      if (mensagem.toLowerCase().includes('sala nao encontrada')) {
        clearRoomSession();
        setTemSalaSalva(false);
        setTemPapelSalvo(false);
      }
    };

    socket.on('salaCriada', handleSalaCriada);
    socket.on('entradaComSucesso', handleEntradaComSucesso);
    socket.on('seuPapel', handleSeuPapel);
    socket.on('erro', handleErro);
    const unsubscribeConnection = subscribeToRoomConnection((status) => {
      if (status === 'room-error') encerrarEsperaDeReconexao();
    });

    return () => {
      encerrarEsperaDeReconexao();
      cancelSavedRoomRejoin();
      unsubscribeConnection();
      socket.off('salaCriada', handleSalaCriada);
      socket.off('entradaComSucesso', handleEntradaComSucesso);
      socket.off('seuPapel', handleSeuPapel);
      socket.off('erro', handleErro);
    };
  }, [encerrarEsperaDeReconexao, navigate]);

  const handleReconectar = () => {
    const codigo = localStorage.getItem('salaAtual');
    const nomeSalvo = localStorage.getItem('meuNome');

    if (codigo && nomeSalvo) {
      setCodigoSala(codigo);
      setNome(nomeSalvo);
      setReconectando(true);
      setServidorIniciando(false);
      serverStartingTimer.current = setTimeout(() => {
        setServidorIniciando(true);
      }, 8000);

      if (!rejoinSavedRoom(true)) {
        encerrarEsperaDeReconexao();
      }
    }
  };

  const handleCriarSala = async () => {
    if (!nome.trim()) {
      toast.error('Digite seu nome primeiro!');
      return;
    }

    if (!(await prepararServidor('criar'))) return;

    clearRoomSession();
    setTemPapelSalvo(false);
    setTemSalaSalva(false);
    localStorage.setItem('meuNome', nome.trim());
    beginRoomSync();
    socket.emit('criarSala', { nome: nome.trim(), playerId: getPlayerId() });
  };

  const handleEntrarSala = async () => {
    if (!nome.trim() || !codigoSala.trim()) {
      toast.error('Preencha nome e código!');
      return;
    }

    const codigoLimpo = codigoSala.trim().toUpperCase();

    if (!(await prepararServidor('entrar'))) return;

    clearRoomSession();
    setTemPapelSalvo(false);
    setTemSalaSalva(false);
    localStorage.setItem('meuNome', nome.trim());
    localStorage.setItem('salaAtual', codigoLimpo);
    beginRoomSync(codigoLimpo);

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
            <button
              className="last-role-button reconnect-room-button"
              onClick={handleReconectar}
              disabled={reconectando}
            >
              {reconectando && <LoaderCircle size={19} className="reconnect-spinner" aria-hidden="true" />}
              {reconectando ? 'Procurando sala...' : 'Reconectar à Última Sala'}
            </button>
            {reconectando && (
              <p className="reconnect-room-status" role="status" aria-live="polite">
                {servidorIniciando
                  ? 'O servidor está iniciando. Isso pode levar até um minuto.'
                  : 'Conectando ao servidor...'}
              </p>
            )}
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
            disabled={!nome.trim() || !codigoSala.trim() || acaoPendente !== null}
          >
            {acaoPendente === 'entrar' && <LoaderCircle size={19} className="reconnect-spinner" aria-hidden="true" />}
            {acaoPendente === 'entrar' ? 'Entrando...' : 'Entrar na Sala'}
          </button>
          {acaoPendente === 'entrar' && servidorIniciando && (
            <p className="reconnect-room-status" role="status" aria-live="polite">
              Preparando o servidor. A primeira conexão pode levar até um minuto.
            </p>
          )}
        </div>

        <div className="secondary-action">
          <p className="or-separator">ou</p>
          <button
            className="secondary-button create-room-button"
            onClick={handleCriarSala}
            disabled={!nome.trim() || acaoPendente !== null}
          >
            {acaoPendente === 'criar' && <LoaderCircle size={19} className="reconnect-spinner" aria-hidden="true" />}
            {acaoPendente === 'criar' ? 'Criando sala...' : 'Crie uma Nova Sala'}
          </button>
          {acaoPendente === 'criar' && servidorIniciando && (
            <p className="reconnect-room-status" role="status" aria-live="polite">
              Preparando o servidor. A primeira conexão pode levar até um minuto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
