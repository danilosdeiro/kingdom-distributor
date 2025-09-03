// src/components/Lobby.tsx

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactDOM from 'react-dom';
import { socket } from '../services/socket';
import { gameState } from '../services/gameState';
import { toast } from 'react-hot-toast';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { usePopper } from 'react-popper';
import './Lobby.css';

const InfoTooltip = ({ text }: { text: string }) => {
  const [referenceElement, setReferenceElement] = useState<HTMLSpanElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: 'top',
    modifiers: [{ name: 'offset', options: { offset: [0, 8] } }],
  });

  const tooltipRoot = document.getElementById('portal-root');
  if (!tooltipRoot) return null;

  return (
    <>
      <span 
        className="info-icon" 
        ref={setReferenceElement} 
        onMouseEnter={() => setIsVisible(true)} 
        onMouseLeave={() => setIsVisible(false)}
      >
        <IoInformationCircleOutline />
      </span>
      {isVisible && ReactDOM.createPortal(
        <div ref={setPopperElement} style={styles.popper} {...attributes.popper} className="tooltip">
          {text}
        </div>,
        tooltipRoot
      )}
    </>
  );
};

interface Jogador { id: string; nome: string; }
type ModoDeJogo = 'aleatorio' | 'convencional' | 'personalizado';
type PapelSorteavel = 'Usurpador' | 'Caçador' | 'Coringa';

export function Lobby() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [meuId, setMeuId] = useState<string | null>(null);
  const [modoDeJogo, setModoDeJogo] = useState<ModoDeJogo>('aleatorio');
  const [papeisPersonalizados, setPapeisPersonalizados] = useState<PapelSorteavel[]>([]);

  useEffect(() => {
    const handleConnect = () => { if (socket.id) setMeuId(socket.id); };
    if (socket.connected) handleConnect(); else socket.on('connect', handleConnect);

    const handleAtualizarLobby = (dados: { jogadores: Jogador[], hostId: string, modoDeJogo: ModoDeJogo }) => {
      setJogadores(dados.jogadores);
      setHostId(dados.hostId);
      if (dados.modoDeJogo) setModoDeJogo(dados.modoDeJogo);
    };
    
    const handleSeuPapel = (papelInfo: { papel: string; objetivo: string }) => {
      gameState.setMeuPapel(papelInfo);
      localStorage.setItem('ultimoPapel', JSON.stringify(papelInfo));
      navigate('/role');
    };
    const handleVoceFoiRemovido = ({ mensagem }: { mensagem: string }) => { toast.error(mensagem); navigate('/'); };
    socket.on('atualizarLobby', handleAtualizarLobby);
    socket.on('seuPapel', handleSeuPapel);
    socket.on('voceFoiRemovido', handleVoceFoiRemovido);
    if (codigo) socket.emit('solicitarDadosSala', codigo);
    return () => {
      socket.off('connect', handleConnect);
      socket.off('atualizarLobby', handleAtualizarLobby);
      socket.off('seuPapel', handleSeuPapel);
      socket.off('voceFoiRemovido', handleVoceFoiRemovido);
    };
  }, [navigate, codigo]);

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

  let isButtonDisabled = true;
  if ([5, 6, 7].includes(numJogadores)) {
    if (modoDeJogo === 'personalizado') {
      isButtonDisabled = papeisPersonalizados.length !== numPapeisExtrasNecessarios;
    } else if (modoDeJogo === 'convencional') {
      isButtonDisabled = numJogadores !== 5;
    } else {
      isButtonDisabled = false;
    }
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
        </div>

        <div className="players-list">
          <h3>Jogadores na Sala ({numJogadores} / 7)</h3>
          <ul>
            {numJogadores > 0 ? jogadores.map((jogador) => (
              <li key={jogador.id}>
                <span className="player-name">{jogador.nome}</span>
                <div className="player-actions">
                  {jogador.id === hostId && <span className="host-tag">👑 Host</span>}
                  {euSouOHost && jogador.id !== meuId && (<button className="remove-button" onClick={() => handleRemoverJogador(jogador.id)}>Remover</button>)}
                </div>
              </li>
            )) : <li className="no-players">Aguardando jogadores...</li>}
          </ul>
        </div>
        
        <div className={`host-options ${!euSouOHost ? 'read-only' : ''}`}>
          <h4>MODO DE JOGO</h4>
          <div className="modo-jogo-options">
            <button className={`mode-button ${modoDeJogo === 'aleatorio' ? 'active' : ''}`} onClick={() => euSouOHost && handleMudarModo('aleatorio')} disabled={!euSouOHost}>
              Aleatório
              <InfoTooltip text="Para 5-7 jogadores. Funções extras são sorteadas." />
            </button>
            <button className={`mode-button ${modoDeJogo === 'convencional' ? 'active' : ''} ${numJogadores !== 5 ? 'disabled' : ''}`} onClick={() => euSouOHost && numJogadores === 5 && handleMudarModo('convencional')} disabled={!euSouOHost || numJogadores !== 5}>
              Convencional
              <InfoTooltip text="Apenas para 5 jogadores. A 5ª função é sempre o Usurpador." />
            </button>
             <button className={`mode-button ${modoDeJogo === 'personalizado' ? 'active' : ''}`} onClick={() => euSouOHost && handleMudarModo('personalizado')} disabled={!euSouOHost}>
              Personalizado
              <InfoTooltip text="O Host escolhe as funções extras para a partida." />
            </button>
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
            {isButtonDisabled && ![5,6,7].includes(numJogadores) ? `Aguardando 5, 6 ou 7 jogadores` : `Distribuir Papéis para ${numJogadores} Jogadores`}
          </button>
        )}
        {!euSouOHost && ( <div className="waiting-message"><p>Aguardando o Host iniciar o jogo...</p></div> )}
      </div>
    </div>
  );
}