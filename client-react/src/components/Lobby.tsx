import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../services/socket';
import { gameState } from '../services/gameState';
import { rejoinSavedRoom } from '../services/rejoinRoom';
import { getPlayerId } from '../services/playerIdentity';
import { clearRoomSession } from '../services/roomSession';
import { toast } from 'react-hot-toast';
import './Lobby.css';

const TooltipWrapper = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && <div className="tooltip-content">{text}</div>}
    </div>
  );
};

interface CorMagicWar {
  id: string;
  nome: string;
  hex: string;
  textColor?: string;
}

interface Jogador { id: string; nome: string; connected?: boolean; cor?: CorMagicWar | null; }
type ModoDeJogo = 'aleatorio' | 'convencional' | 'personalizado' | 'magic-war';
type PapelSorteavel = 'Usurpador' | 'Caçador' | 'Coringa';

const PUBLIC_APP_URL = 'https://meukingdom.vercel.app';

export function Lobby() {
const handleCompartilhar = () => {
  // Se 'codigo' for undefined, vira '' (string vazia)
  const codigoLimpo = (codigo || '').toUpperCase(); 
  
  if (!codigoLimpo) {
    toast.error("Código da sala não encontrado!");
    return;
  }
  const urlConvite = `${PUBLIC_APP_URL}/${codigoLimpo}`;
  
  // No campo 'text', NÃO colocamos o link, pois o campo 'url' já vai adicioná-lo
  const mensagem = `⚔️ *Meu Kingdom* ⚔️\nEntre na sala para receber seu papel`;

  if (navigator.share) {
    navigator.share({
      title: 'Meu Kingdom',
      text: mensagem, // Apenas a frase
      url: urlConvite, // O link entra aqui e o navegador cuida de anexar uma única vez
    }).catch(console.error);
  } else {
    // Caso de fallback (PC/Cópia manual)
    const textoCompleto = `${mensagem}\n\nLink: ${urlConvite}`;
    navigator.clipboard.writeText(textoCompleto).then(() => {
      toast.success('Link de convite copiado!');
    });
  }
};
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [modoDeJogo, setModoDeJogo] = useState<ModoDeJogo>('aleatorio');
  const [papeisPersonalizados, setPapeisPersonalizados] = useState<PapelSorteavel[]>([]);
  
  useEffect(() => {
    if (!codigo) {
      navigate('/', { replace: true });
      return;
    }
    
    const handleAtualizarLobby = (dados: { jogadores: Jogador[], hostId: string, modoDeJogo: ModoDeJogo }) => {
      setJogadores(dados.jogadores);
      setHostId(dados.hostId);
      setMeuId(getPlayerId());
      if (dados.modoDeJogo) setModoDeJogo(dados.modoDeJogo);
      localStorage.setItem('jogadoresDaSala', JSON.stringify(dados.jogadores));
      localStorage.setItem('meuId', getPlayerId());
    };
    
    const handleSeuPapel = (papelInfo: { papel: string; objetivo: string }) => {
      gameState.setMeuPapel(papelInfo);
      sessionStorage.setItem('ultimoPapel', JSON.stringify(papelInfo));
      navigate('/role', { replace: true });
    };

    const handleVoceFoiRemovido = ({ mensagem }: { mensagem: string }) => { 
      toast.error(mensagem); 
      navigate('/', { replace: true }); 
    };
    
    const handleSalaFechada = ({ mensagem }: { mensagem: string }) => {
        toast.error(mensagem);
        navigate('/', { replace: true });
    };

    const handleErro = ({ mensagem }: { mensagem: string }) => {
      toast.error(mensagem);
    };

    const handleConnect = () => {
      setMeuId(getPlayerId());
      if (!rejoinSavedRoom()) {
        socket.emit('solicitarDadosSala', codigo);
      }
    };
    
    socket.on('atualizarLobby', handleAtualizarLobby);
    socket.on('seuPapel', handleSeuPapel);
    socket.on('voceFoiRemovido', handleVoceFoiRemovido);
    socket.on('salaFechada', handleSalaFechada);
    socket.on('erro', handleErro);
    socket.on('connect', handleConnect);
    
    handleConnect();

    return () => {
      socket.off('atualizarLobby', handleAtualizarLobby);
      socket.off('seuPapel', handleSeuPapel);
      socket.off('voceFoiRemovido', handleVoceFoiRemovido);
      socket.off('salaFechada', handleSalaFechada);
      socket.off('erro', handleErro);
      socket.off('connect', handleConnect);
    };
  }, [navigate, codigo]);

  const handleSairDaSala = () => {
    socket.emit('sairDaSala', { codigo });
    clearRoomSession();
    navigate('/');
  };

  const handleMudarModo = (novoModo: ModoDeJogo) => {
    setPapeisPersonalizados([]);
    socket.emit('mudarModoDeJogo', { codigo, novoModo });
  };
  
  const handleRemoverJogador = (idJogadorARemover: string) => {
    if (window.confirm("Tem a certeza de que quer remover este jogador?")) {
      socket.emit('removerJogador', { codigo, idJogadorARemover });
    }
  };

  const handleDistribuirPapeis = () => {
    socket.emit('distribuirPapeis', { codigo, papeisPersonalizados });
  };
  
  const handlePapelPersonalizadoChange = (papel: PapelSorteavel) => {
    setPapeisPersonalizados(prev => 
      prev.includes(papel) ? prev.filter(p => p !== papel) : [...prev, papel]
    );
  };

  const euSouOHost = meuId !== null && meuId === hostId;
  const numJogadores = jogadores.length;
  const numPapeisExtrasNecessarios = numJogadores > 4 ? numJogadores - 4 : 0;
  const haJogadorReconectando = jogadores.some((jogador) => jogador.connected === false);

  let isButtonDisabled = true;
  if (modoDeJogo === 'magic-war') {
    isButtonDisabled = numJogadores < 3 || numJogadores > 7;
  } else if ([5, 6, 7].includes(numJogadores)) {
    if (modoDeJogo === 'personalizado') {
      isButtonDisabled = papeisPersonalizados.length !== numPapeisExtrasNecessarios;
    } else if (modoDeJogo === 'convencional') {
      isButtonDisabled = numJogadores !== 5;
    } else {
      isButtonDisabled = false;
    }
  }

  if (haJogadorReconectando) {
    isButtonDisabled = true;
  }

  const papeisSorteaveis: PapelSorteavel[] = ['Usurpador', 'Caçador', 'Coringa'];

  return (
    <div className="lobby-container">
      <div className="lobby-card-unified">
        <div className="sala-info">
          <p>CÓDIGO DA SALA</p>
          <h1 title="Clique para copiar" onClick={() => codigo && navigator.clipboard.writeText(codigo.toUpperCase()).then(() => toast.success('Código Copiado!'))}>
            {codigo?.toUpperCase()}
          </h1>
          <button className="share-button" onClick={handleCompartilhar}>
            Compartilhar Sala
          </button>
        </div>

        <div className="players-list">
          <h3>Jogadores na Sala ({numJogadores} / 7)</h3>
          <ul>
            {jogadores.length > 0 ? jogadores.map((jogador) => (
              <li key={jogador.id}>
                <div className="player-identity">
                  <span className="player-name">{jogador.nome}</span>
                  {modoDeJogo === 'magic-war' && jogador.cor && (
                    <span className="player-color-label">
                      <span className="player-color-swatch" style={{ backgroundColor: jogador.cor.hex }} aria-hidden="true" />
                      {jogador.cor.nome}
                    </span>
                  )}
                </div>
                <div className="player-actions">
                  {jogador.connected === false && <span className="host-tag">Reconectando</span>}
                  {jogador.id === hostId && (
                    <span className="host-crown" role="img" aria-label="Host" title="Host">
                      👑
                    </span>
                  )}
                  {euSouOHost && jogador.id !== meuId && (<button className="remove-button" onClick={() => handleRemoverJogador(jogador.id)}>Remover</button>)}
                </div>
              </li>
            )) : <li className="no-players">Aguardando jogadores...</li>}
          </ul>
        </div>
        
        <div className={`host-options ${!euSouOHost ? 'read-only' : ''}`}>
          <h4>MODO DE JOGO</h4>
          <div className="modo-jogo-options">
            <TooltipWrapper text="Para 5-7 jogadores. Funções extras são sorteadas aleatoriamente.">
              <button className={`mode-button ${modoDeJogo === 'aleatorio' ? 'active' : ''}`} onClick={() => euSouOHost && handleMudarModo('aleatorio')} disabled={!euSouOHost}>
                Aleatório
              </button>
            </TooltipWrapper>

            <TooltipWrapper text="Apenas para 5 jogadores. A 5ª função é sempre o Usurpador.">
              <button className={`mode-button ${modoDeJogo === 'convencional' ? 'active' : ''} ${numJogadores !== 5 ? 'disabled' : ''}`} onClick={() => euSouOHost && numJogadores === 5 && handleMudarModo('convencional')} disabled={!euSouOHost || numJogadores !== 5}>
                Convencional
              </button>
            </TooltipWrapper>
            
            <TooltipWrapper text="O Host escolhe manualmente as funções extras para a partida.">
               <button className={`mode-button ${modoDeJogo === 'personalizado' ? 'active' : ''}`} onClick={() => euSouOHost && handleMudarModo('personalizado')} disabled={!euSouOHost}>
                Personalizado
              </button>
            </TooltipWrapper>

            <TooltipWrapper text="Para 3-7 jogadores. Cada cor recebe um alvo secreto; cumpra sua missão antes dos demais.">
              <button className={`mode-button ${modoDeJogo === 'magic-war' ? 'active magic-war-mode' : ''}`} onClick={() => euSouOHost && handleMudarModo('magic-war')} disabled={!euSouOHost}>
                Magic War
              </button>
            </TooltipWrapper>
          </div>
          
          {modoDeJogo === 'personalizado' && (
            <div className="custom-roles-container">
              <p>
                Selecione os papéis extras ({papeisPersonalizados.length} / {numPapeisExtrasNecessarios}):
              </p>
              <div className="checkbox-group">
                {papeisSorteaveis.map(papel => (
                  <label key={papel} className={`checkbox-label ${numPapeisExtrasNecessarios === 0 ? 'disabled' : ''}`}>
                    <input 
                      type="checkbox"
                      checked={papeisPersonalizados.includes(papel)}
                      onChange={() => handlePapelPersonalizadoChange(papel)}
                      disabled={!euSouOHost || numPapeisExtrasNecessarios === 0}
                    />
                    {papel}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {euSouOHost && (
          <button 
            className="start-button" 
            onClick={handleDistribuirPapeis} 
            disabled={isButtonDisabled}
          >
            {haJogadorReconectando
              ? 'Aguardando reconexão'
              : isButtonDisabled && (modoDeJogo === 'magic-war' ? numJogadores < 3 : ![5,6,7].includes(numJogadores))
                ? 'Aguardando jogadores'
                : modoDeJogo === 'magic-war'
                  ? `Iniciar Magic War com ${numJogadores} Jogadores`
                  : `Distribuir Papéis para ${numJogadores} Jogadores`}
          </button>
        )}
        {!euSouOHost && ( <div className="waiting-message"><p>Aguardando o Host iniciar o jogo...</p></div> )}

        <button className="exit-button" onClick={handleSairDaSala}>
          Sair da Sala
        </button>
      </div>
    </div>
  );
}
