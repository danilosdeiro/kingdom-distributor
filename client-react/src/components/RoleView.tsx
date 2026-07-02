import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameState } from '../services/gameState';
import { socket } from '../services/socket';
import { rejoinSavedRoom } from '../services/rejoinRoom';
import { getPlayerId } from '../services/playerIdentity';
import { toast } from 'react-hot-toast';
import './RoleView.css';

interface Jogador {
  id: string;
  nome: string;
  connected?: boolean;
  vivo?: boolean;
}

interface PapelInfo {
  papel: string;
  objetivo: string;
}

interface RevelacaoPapel {
  id: string;
  nome: string;
  papel: string;
  vivo: boolean;
}

interface GameResult {
  vencedor: string;
  mensagem: string;
  revelacao?: RevelacaoPapel[];
}

const papelStorage = {
  get: () => sessionStorage.getItem('ultimoPapel'),
  set: (papelInfo: PapelInfo) => sessionStorage.setItem('ultimoPapel', JSON.stringify(papelInfo)),
  clear: () => sessionStorage.removeItem('ultimoPapel'),
};

export function RoleView() {
  const [meuPapel, setMeuPapel] = useState<PapelInfo | null>(null);
  const [modalMorteAberto, setModalMorteAberto] = useState(false);
  const [quemMeMatouId, setQuemMeMatouId] = useState('');
  const [estouMorto, setEstouMorto] = useState(false);
  const [papelVisivel, setPapelVisivel] = useState(false);
  const [jogadoresVivos, setJogadoresVivos] = useState<Jogador[]>([]);
  const [meuId, setMeuId] = useState('');
  const [resultado, setResultado] = useState<GameResult | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const jogadoresSalvos = localStorage.getItem('jogadoresDaSala');
    if (jogadoresSalvos) {
      try {
        setJogadoresVivos(JSON.parse(jogadoresSalvos));
      } catch {
        setJogadoresVivos([]);
      }
    }

    setMeuId(getPlayerId());

    let papelInfo = gameState.getMeuPapel();
    if (!papelInfo) {
      const papelSalvoString = papelStorage.get();
      if (papelSalvoString) {
        try {
          papelInfo = JSON.parse(papelSalvoString);
        } catch {
          navigate('/');
          return;
        }
      }
    }

    if (papelInfo) {
      setMeuPapel(papelInfo);
      gameState.setMeuPapel(papelInfo);
    } else {
      navigate('/');
    }

    const handleMorteConfirmada = () => setEstouMorto(true);

    const handleMensagemSistema = (data: { mensagem: string }) => {
      toast(data.mensagem, { icon: '👑', duration: 5000 });
    };

    const handleFimDeJogo = (data: GameResult) => {
      setResultado(data);
      toast.success(data.mensagem, { duration: 8000 });
    };

    const handleSeuPapel = (novoPapelInfo: PapelInfo) => {
      setMeuPapel(novoPapelInfo);
      gameState.setMeuPapel(novoPapelInfo);
      papelStorage.set(novoPapelInfo);
    };

    const handleAtualizarLobby = (dados: { jogadores: Jogador[]; status?: string; resultado?: GameResult | null }) => {
      setJogadoresVivos(dados.jogadores);
      localStorage.setItem('jogadoresDaSala', JSON.stringify(dados.jogadores));
      if (dados.status === 'finalizado' && dados.resultado) {
        setResultado(dados.resultado);
      }
    };

    const handleErro = ({ mensagem }: { mensagem: string }) => {
      toast.error(mensagem);
    };

    const handleConnect = () => {
      setMeuId(getPlayerId());
      rejoinSavedRoom();
    };

    socket.on('morteConfirmada', handleMorteConfirmada);
    socket.on('mensagemSistema', handleMensagemSistema);
    socket.on('fimDeJogo', handleFimDeJogo);
    socket.on('seuPapel', handleSeuPapel);
    socket.on('atualizarLobby', handleAtualizarLobby);
    socket.on('erro', handleErro);
    socket.on('connect', handleConnect);

    handleConnect();

    return () => {
      socket.off('morteConfirmada', handleMorteConfirmada);
      socket.off('mensagemSistema', handleMensagemSistema);
      socket.off('fimDeJogo', handleFimDeJogo);
      socket.off('seuPapel', handleSeuPapel);
      socket.off('atualizarLobby', handleAtualizarLobby);
      socket.off('erro', handleErro);
      socket.off('connect', handleConnect);
    };
  }, [navigate]);

  const confirmarEliminacao = () => {
    if (!quemMeMatouId) {
      toast.error('Selecione quem eliminou você.');
      return;
    }

    const codigoSala = localStorage.getItem('salaAtual');
    const assassinoSelecionado = jogadoresVivos.find((jogador) => jogador.id === quemMeMatouId);

    socket.emit('jogadorEliminado', {
      codigo: codigoSala,
      vitimaPlayerId: getPlayerId(),
      assassinoId: quemMeMatouId,
      assassinoNome: assassinoSelecionado?.nome,
    });
    setModalMorteAberto(false);
  };

  const voltarAoLobby = () => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) {
      navigate(`/lobby/${codigoSala}`, { state: { voltouDaPartida: true } });
    } else {
      navigate('/');
    }
  };

  const sairDoJogo = () => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) {
      socket.emit('sairDaSala', { codigo: codigoSala });
    }

    papelStorage.clear();
    localStorage.removeItem('salaAtual');
    localStorage.removeItem('jogadoresDaSala');
    localStorage.removeItem('meuId');
    navigate('/');
  };

  const renderListaJogadores = () => {
    if (jogadoresVivos.length === 0) return null;

    const jogadoresAindaVivos = jogadoresVivos.filter((jogador) => jogador.vivo !== false).length;

    return (
      <section className="players-status-panel" aria-label="Jogadores na partida">
        <div className="players-status-header">
          <h2>Jogadores</h2>
          <span>{jogadoresAindaVivos}/{jogadoresVivos.length} em jogo</span>
        </div>

        <div className="players-status-list">
          {jogadoresVivos.map((jogador) => {
            const eliminado = jogador.vivo === false;

            return (
              <div
                className={`player-status-item ${eliminado ? 'is-dead' : ''}`}
                key={jogador.id}
                aria-label={`${jogador.nome} ${eliminado ? 'eliminado' : 'em jogo'}`}
              >
                <span className="player-status-name">{jogador.nome}</span>
                <span className="player-status-marker" aria-hidden="true" />
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  if (!meuPapel) {
    return <div className="role-container loading">Carregando...</div>;
  }

  if (resultado) {
    return (
      <div className="role-container">
        <div className="role-card result-card">
          <p>Fim de Jogo</p>
          <h1>{resultado.vencedor}</h1>
          <div className="objetivo">
            <p>{resultado.mensagem}</p>
          </div>

          {resultado.revelacao && resultado.revelacao.length > 0 && (
            <div className="role-reveal-list">
              {resultado.revelacao.map((player) => (
                <div className="role-reveal-item" key={player.id}>
                  <span>{player.nome}</span>
                  <strong>{player.papel}</strong>
                  <em>{player.vivo ? 'Vivo' : 'Eliminado'}</em>
                </div>
              ))}
            </div>
          )}

          <div className="role-actions">
            <button className="back-button" onClick={voltarAoLobby}>
              Voltar ao Lobby
            </button>
            <button className="back-button exit-role-button" onClick={sairDoJogo}>
              Sair do Jogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (estouMorto) {
    return (
      <div className="role-container">
        <div className="role-card" style={{ border: '1px solid #d32f2f' }}>
          <h1 style={{ color: '#d32f2f' }}>ELIMINADO</h1>
          <p>Você está morto. Aguarde o fim da partida em silêncio.</p>
          {renderListaJogadores()}
          <div className="role-actions">
            <button className="back-button" onClick={voltarAoLobby}>
              Voltar ao Lobby
            </button>
            <button className="back-button exit-role-button" onClick={sairDoJogo}>
              Sair do Jogo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="role-container">
      <div className="role-card">
        <p>Seu Papel Secreto é:</p>

        {papelVisivel ? (
          <>
            <h1>{meuPapel.papel}</h1>
            <div className="objetivo">
              <h3>Seu Objetivo:</h3>
              <p>{meuPapel.objetivo}</p>
            </div>
          </>
        ) : (
          <div className="role-hidden-panel">
            <p>Toque no botão abaixo para revelar o seu papel.</p>
          </div>
        )}

        <button
          className={`back-button reveal-role-button ${papelVisivel ? '' : 'is-highlighted'}`}
          onClick={() => setPapelVisivel(!papelVisivel)}
        >
          {papelVisivel ? 'Esconder Meu Papel' : 'Revelar Meu Papel'}
        </button>

        <p className="warning">Não revele seu papel a ninguém!</p>

        {renderListaJogadores()}

        <button
          className="back-button danger-action-button"
          onClick={() => setModalMorteAberto(true)}
        >
          Fui Eliminado
        </button>

        <div className="role-actions">
          <button className="back-button" onClick={voltarAoLobby}>
            Voltar ao Lobby
          </button>
          <button className="back-button exit-role-button" onClick={sairDoJogo}>
            Sair do Jogo
          </button>
        </div>

        {modalMorteAberto && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ background: '#1c1c1e', padding: '25px', borderRadius: '10px', textAlign: 'center', width: '90%', maxWidth: '350px', border: '1px solid #444' }}>
              <h3 style={{ color: '#e0e0e0', marginTop: 0 }}>Quem te eliminou?</h3>
              <p style={{ fontSize: '0.9rem', color: '#888' }}>Selecione o jogador responsável pelo golpe final.</p>

              <select
                value={quemMeMatouId}
                onChange={(e) => setQuemMeMatouId(e.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '5px', background: '#2a2a2a', color: '#fff', border: '1px solid #555' }}
              >
                <option value="">Selecione na lista...</option>
                {jogadoresVivos
                  .filter((jogador) => jogador.id !== meuId && jogador.vivo !== false)
                  .map((jogador) => (
                    <option key={jogador.id} value={jogador.id}>
                      {jogador.nome}
                    </option>
                  ))}
              </select>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={confirmarEliminacao} style={{ flex: 1, padding: '12px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Confirmar</button>
                <button onClick={() => setModalMorteAberto(false)} style={{ flex: 1, padding: '12px', background: '#444', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold' }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
