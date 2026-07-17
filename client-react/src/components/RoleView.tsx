import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameState } from '../services/gameState';
import { socket } from '../services/socket';
import { rejoinSavedRoom } from '../services/rejoinRoom';
import { getPlayerId } from '../services/playerIdentity';
import { clearRoomSession } from '../services/roomSession';
import { toast } from 'react-hot-toast';
import './RoleView.css';

interface Jogador {
  id: string;
  nome: string;
  connected?: boolean;
  vivo?: boolean;
  cor?: CorMagicWar | null;
  vida?: number;
  danoComandante?: Record<string, number>;
  commanderCount?: 1 | 2;
}

interface CorMagicWar {
  id: string;
  nome: string;
  hex: string;
  textColor?: string;
}

interface PapelInfo {
  papel: string;
  objetivo: string;
  modoDeJogo?: 'kingdom' | 'magic-war';
  cor?: CorMagicWar;
  objetivoSobrevivencia?: boolean;
  alvo?: {
    id: string;
    nome: string;
    cor: CorMagicWar;
  } | null;
}

interface RevelacaoPapel {
  id: string;
  nome: string;
  papel: string;
  vivo: boolean;
  cor?: CorMagicWar | null;
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
  const [modalDanoComandanteAberto, setModalDanoComandanteAberto] = useState(false);
  const [jogadorDetalhesId, setJogadorDetalhesId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [modalRegistroHostAberto, setModalRegistroHostAberto] = useState(false);
  const [vitimaSelecionadaId, setVitimaSelecionadaId] = useState('');
  const [eliminadorSelecionadoId, setEliminadorSelecionadoId] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const jogadoresSalvos = localStorage.getItem('jogadoresDaSala');
    if (jogadoresSalvos) {
      try {
        const jogadores = JSON.parse(jogadoresSalvos) as Jogador[];
        setJogadoresVivos(jogadores);
        setEstouMorto(jogadores.some((jogador) => jogador.id === getPlayerId() && jogador.vivo === false));
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

    const handleLobbyReaberto = () => {
      gameState.clearMeuPapel();
      papelStorage.clear();
      setResultado(null);
      setEstouMorto(false);
      const codigoSala = localStorage.getItem('salaAtual');
      navigate(codigoSala ? `/lobby/${codigoSala}` : '/', { replace: true });
    };

    const handleSeuPapel = (novoPapelInfo: PapelInfo) => {
      setMeuPapel(novoPapelInfo);
      gameState.setMeuPapel(novoPapelInfo);
      papelStorage.set(novoPapelInfo);
    };

    const handleAtualizarLobby = (dados: { jogadores: Jogador[]; hostId?: string; status?: string; resultado?: GameResult | null }) => {
      setJogadoresVivos(dados.jogadores);
      if (dados.hostId) setHostId(dados.hostId);
      localStorage.setItem('jogadoresDaSala', JSON.stringify(dados.jogadores));
      if (dados.jogadores.some((jogador) => jogador.id === getPlayerId() && jogador.vivo === false)) {
        setEstouMorto(true);
      }
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
    socket.on('lobbyReaberto', handleLobbyReaberto);
    socket.on('seuPapel', handleSeuPapel);
    socket.on('atualizarLobby', handleAtualizarLobby);
    socket.on('erro', handleErro);
    socket.on('connect', handleConnect);

    handleConnect();

    return () => {
      socket.off('morteConfirmada', handleMorteConfirmada);
      socket.off('mensagemSistema', handleMensagemSistema);
      socket.off('fimDeJogo', handleFimDeJogo);
      socket.off('lobbyReaberto', handleLobbyReaberto);
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

  const confirmarEliminacaoPeloHost = () => {
    if (!vitimaSelecionadaId || !eliminadorSelecionadoId || vitimaSelecionadaId === eliminadorSelecionadoId) {
      toast.error('Selecione a vítima e quem deu o último golpe.');
      return;
    }

    const codigoSala = localStorage.getItem('salaAtual');
    const eliminador = jogadoresVivos.find((jogador) => jogador.id === eliminadorSelecionadoId);
    socket.emit('jogadorEliminado', {
      codigo: codigoSala,
      vitimaPlayerId: vitimaSelecionadaId,
      assassinoId: eliminadorSelecionadoId,
      assassinoNome: eliminador?.nome,
    });
    setModalRegistroHostAberto(false);
    setVitimaSelecionadaId('');
    setEliminadorSelecionadoId('');
  };

  const voltarAoLobby = () => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) {
      if (resultado) {
        socket.emit('voltarAoLobby', { codigo: codigoSala });
      } else {
        navigate(`/lobby/${codigoSala}`, { state: { voltouDaPartida: true } });
      }
    } else {
      navigate('/');
    }
  };

  const sairDoJogo = () => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) {
      socket.emit('sairDaSala', { codigo: codigoSala });
    }

    clearRoomSession();
    navigate('/');
  };

  const alterarVida = (delta: -1 | 1) => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) socket.emit('alterarVida', { codigo: codigoSala, delta });
  };

  const alterarDanoComandante = (comandanteId: string, delta: -1 | 1) => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) socket.emit('alterarDanoComandante', { codigo: codigoSala, comandanteId, delta });
  };

  const adicionarSegundoComandante = () => {
    const codigoSala = localStorage.getItem('salaAtual');
    if (codigoSala) socket.emit('adicionarSegundoComandante', { codigo: codigoSala });
  };

  const getCommanderSources = () => jogadoresVivos.flatMap((jogador) => [
    { id: jogador.id, nome: jogador.nome, cor: jogador.cor },
    ...(jogador.commanderCount === 2
      ? [{ id: `${jogador.id}:partner`, nome: `${jogador.nome} (Parceiro)`, cor: jogador.cor }]
      : []),
  ]);

  const renderContadorVida = () => {
    if (estouMorto) return null;

    const jogadorAtual = jogadoresVivos.find((jogador) => jogador.id === meuId);
    if (!jogadorAtual) return null;

    const vida = jogadorAtual.vida ?? 40;
    const maiorDanoComandante = Math.max(0, ...Object.values(jogadorAtual.danoComandante || {}));

    return (
      <section className="life-counter-panel" aria-label="Seu contador de vida">
        <div className="life-counter-header">
          <h2>Sua vida</h2>
          <button type="button" className="commander-damage-button" onClick={() => setModalDanoComandanteAberto(true)}>
            Dano de comandante
            {maiorDanoComandante > 0 && <span className={maiorDanoComandante >= 21 ? 'is-lethal' : ''}>{maiorDanoComandante}</span>}
          </button>
        </div>
        <div className="life-counter-control">
          <button type="button" className="life-side life-minus" onClick={() => alterarVida(-1)} aria-label="Diminuir uma vida">
            <span aria-hidden="true">−</span>
          </button>
          <div className={`life-current-value ${vida <= 0 ? 'is-zero' : ''}`} aria-live="polite">
            <strong>{vida}</strong>
            <small>VIDA</small>
          </div>
          <button type="button" className="life-side life-plus" onClick={() => alterarVida(1)} aria-label="Aumentar uma vida">
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </section>
    );
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
                <div className="player-status-identity">
                  <button
                    type="button"
                    className="player-status-name-button"
                    onClick={() => setJogadorDetalhesId(jogador.id)}
                    aria-label={`Ver dano de comandante recebido por ${jogador.nome}`}
                  >
                    <span
                      className="player-status-name"
                      style={jogador.cor && !eliminado ? { color: jogador.cor.id === 'black' ? '#aaa5b3' : jogador.cor.hex } : undefined}
                    >
                      {jogador.nome}
                    </span>
                  </button>
                </div>
                <div className="player-status-stats">
                  <span className={`player-life-value ${(jogador.vida ?? 40) <= 0 ? 'is-zero' : ''}`}>{jogador.vida ?? 40} PV</span>
                  <span className="player-status-marker" aria-hidden="true" />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderDetalhesDanoComandante = () => {
    const jogadorDetalhes = jogadoresVivos.find((jogador) => jogador.id === jogadorDetalhesId);
    if (!jogadorDetalhes) return null;

    return (
      <div className="commander-modal-backdrop" role="presentation" onClick={() => setJogadorDetalhesId(null)}>
        <div className="commander-modal" role="dialog" aria-modal="true" aria-labelledby="player-damage-title" onClick={(event) => event.stopPropagation()}>
          <div className="commander-modal-header">
            <div>
              <h2 id="player-damage-title">{jogadorDetalhes.nome}</h2>
              <p>Dano de comandante recebido</p>
            </div>
            <button type="button" className="commander-modal-close" onClick={() => setJogadorDetalhesId(null)} aria-label="Fechar">×</button>
          </div>
          <div className="commander-damage-list">
            {getCommanderSources().map((comandante) => {
              const dano = jogadorDetalhes.danoComandante?.[comandante.id] ?? 0;
              return (
                <div className={`commander-damage-row commander-damage-readonly ${dano >= 21 ? 'is-lethal' : ''}`} key={comandante.id}>
                  <div className="commander-player">
                    {comandante.cor && <span className="player-status-color-swatch" style={{ backgroundColor: comandante.cor.hex }} aria-hidden="true" />}
                    <span>{comandante.nome}</span>
                  </div>
                  <strong className="commander-damage-total">{dano}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
                  <strong className="role-reveal-role">
                    {player.cor && <span className="player-status-color-swatch" style={{ backgroundColor: player.cor.hex }} aria-hidden="true" />}
                    {player.papel}
                  </strong>
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

  if (estouMorto && meuId !== hostId) {
    return (
      <div className="role-container">
        <div className="role-card" style={{ border: '1px solid #d32f2f' }}>
          <h1 style={{ color: '#d32f2f' }}>ELIMINADO</h1>
          <p>Você está morto. Aguarde o fim da partida em silêncio.</p>
          {renderListaJogadores()}
          {renderDetalhesDanoComandante()}
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
        {estouMorto && (
          <div className="eliminated-host-notice">
            <strong>ELIMINADO</strong>
            <span>Você ainda pode registrar as eliminações como host.</span>
          </div>
        )}

        {renderContadorVida()}

        {renderListaJogadores()}

        <p className="private-role-label">{meuPapel.modoDeJogo === 'magic-war' ? 'Sua cor é:' : 'Seu Papel Secreto é:'}</p>

        {meuPapel.modoDeJogo === 'magic-war' && meuPapel.cor && (
          <div className="my-color-banner" style={{ backgroundColor: meuPapel.cor.hex, color: meuPapel.cor.textColor || '#fff' }}>
            <span className="my-color-swatch" aria-hidden="true" />
            {meuPapel.cor.nome}
          </div>
        )}

        {papelVisivel ? (
          meuPapel.modoDeJogo === 'magic-war' ? (
            meuPapel.objetivoSobrevivencia ? (
              <div className="magic-war-mission survival-mission">
                <span>Novo objetivo</span>
                <div className="survival-target">Último sobrevivente</div>
                <p>Seu alvo foi eliminado por outro jogador.</p>
              </div>
            ) : meuPapel.alvo ? (
              <div className="magic-war-mission">
                <span>Seu alvo secreto</span>
                <div className="target-color" style={{ backgroundColor: meuPapel.alvo.cor.hex, color: meuPapel.alvo.cor.textColor || '#fff' }}>
                  {meuPapel.alvo.cor.nome}
                </div>
                <p>{meuPapel.alvo.nome}</p>
              </div>
            ) : null
          ) : (
            <>
              <h1>{meuPapel.papel}</h1>
              <div className="objetivo">
                <h3>Seu Objetivo:</h3>
                <p>{meuPapel.objetivo}</p>
              </div>
            </>
          )
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

        <p className="warning">{meuPapel.modoDeJogo === 'magic-war' ? 'Não revele seu objetivo a ninguém!' : 'Não revele seu papel a ninguém!'}</p>

        {meuId === hostId && (
          <button
            className="back-button host-elimination-button"
            onClick={() => setModalRegistroHostAberto(true)}
          >
            Registrar Eliminação
          </button>
        )}

        {!estouMorto && (
          <button
            className="back-button danger-action-button"
            onClick={() => setModalMorteAberto(true)}
          >
            Fui Eliminado
          </button>
        )}

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
                      {jogador.cor ? `${jogador.cor.nome} - ` : ''}{jogador.nome}
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

        {modalDanoComandanteAberto && (
          <div className="commander-modal-backdrop" role="presentation" onClick={() => setModalDanoComandanteAberto(false)}>
            <div className="commander-modal" role="dialog" aria-modal="true" aria-labelledby="commander-modal-title" onClick={(event) => event.stopPropagation()}>
              <div className="commander-modal-header">
                <div>
                  <h2 id="commander-modal-title">Dano de comandante</h2>
                  <p>Dano que você recebeu</p>
                </div>
                <button type="button" className="commander-modal-close" onClick={() => setModalDanoComandanteAberto(false)} aria-label="Fechar">×</button>
              </div>
              <div className="commander-damage-list">
                {getCommanderSources()
                  .map((comandante) => {
                    const jogadorAtual = jogadoresVivos.find((item) => item.id === meuId);
                    const dano = jogadorAtual?.danoComandante?.[comandante.id] ?? 0;

                    return (
                      <div className={`commander-damage-row ${dano >= 21 ? 'is-lethal' : ''}`} key={comandante.id}>
                        <div className="commander-player">
                          {comandante.cor && <span className="player-status-color-swatch" style={{ backgroundColor: comandante.cor.hex }} aria-hidden="true" />}
                          <span>{comandante.nome}</span>
                        </div>
                        <div className="commander-stepper">
                          <button type="button" onClick={() => alterarDanoComandante(comandante.id, -1)} aria-label={`Diminuir dano de comandante de ${comandante.nome}`}>−</button>
                          <strong>{dano}</strong>
                          <button type="button" onClick={() => alterarDanoComandante(comandante.id, 1)} aria-label={`Aumentar dano de comandante de ${comandante.nome}`}>+</button>
                        </div>
                      </div>
                    );
                  })}
              </div>
              {jogadoresVivos.find((jogador) => jogador.id === meuId)?.commanderCount !== 2 && (
                <button type="button" className="add-partner-button" onClick={adicionarSegundoComandante}>
                  Adicionar segundo comandante (Partner)
                </button>
              )}
            </div>
          </div>
        )}

        {renderDetalhesDanoComandante()}

        {modalRegistroHostAberto && (
          <div className="commander-modal-backdrop" role="presentation" onClick={() => setModalRegistroHostAberto(false)}>
            <div className="commander-modal" role="dialog" aria-modal="true" aria-labelledby="host-elimination-title" onClick={(event) => event.stopPropagation()}>
              <div className="commander-modal-header">
                <div>
                  <h2 id="host-elimination-title">Registrar eliminação</h2>
                  <p>Informe quem foi eliminado e quem deu o último golpe.</p>
                </div>
                <button type="button" className="commander-modal-close" onClick={() => setModalRegistroHostAberto(false)} aria-label="Fechar">×</button>
              </div>
              <div className="host-elimination-form">
                <label>
                  Jogador eliminado
                  <select
                    value={vitimaSelecionadaId}
                    onChange={(event) => {
                      setVitimaSelecionadaId(event.target.value);
                      if (event.target.value === eliminadorSelecionadoId) setEliminadorSelecionadoId('');
                    }}
                  >
                    <option value="">Selecione...</option>
                    {jogadoresVivos.filter((jogador) => jogador.vivo !== false).map((jogador) => (
                      <option key={jogador.id} value={jogador.id}>{jogador.cor ? `${jogador.cor.nome} - ` : ''}{jogador.nome}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Responsável pelo último golpe
                  <select value={eliminadorSelecionadoId} onChange={(event) => setEliminadorSelecionadoId(event.target.value)} disabled={!vitimaSelecionadaId}>
                    <option value="">Selecione...</option>
                    {jogadoresVivos
                      .filter((jogador) => jogador.vivo !== false && jogador.id !== vitimaSelecionadaId)
                      .map((jogador) => (
                        <option key={jogador.id} value={jogador.id}>{jogador.cor ? `${jogador.cor.nome} - ` : ''}{jogador.nome}</option>
                      ))}
                  </select>
                </label>
                <button type="button" className="confirm-host-elimination" onClick={confirmarEliminacaoPeloHost} disabled={!vitimaSelecionadaId || !eliminadorSelecionadoId}>
                  Confirmar eliminação
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
