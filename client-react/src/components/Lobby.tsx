// src/components/Lobby.tsx

import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../services/socket';
import { gameState } from '../services/gameState';
import './Lobby.css';

interface Jogador {
  id: string;
  nome: string;
}

export function Lobby() {
  const { codigo } = useParams<{ codigo: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [jogadores, setJogadores] = useState<Jogador[]>(location.state?.jogadoresIniciais || []);
  const [hostId, setHostId] = useState<string | null>(location.state?.jogadoresIniciais?.[0]?.id || null);
  const [meuId, setMeuId] = useState<string | null>(null);

  useEffect(() => {
    const handleConnect = () => { if (socket.id) setMeuId(socket.id); };
    if (socket.connected) handleConnect();
    else socket.on('connect', handleConnect);

    const handleAtualizarLobby = ({ jogadores, hostId }: { jogadores: Jogador[], hostId: string }) => {
      setJogadores(jogadores);
      setHostId(hostId);
    };

    const handleSeuPapel = (papelInfo: { papel: string; objetivo: string }) => {
      gameState.setMeuPapel(papelInfo);
      navigate('/role');
    };

    socket.on('atualizarLobby', handleAtualizarLobby);
    socket.on('seuPapel', handleSeuPapel);

    // CORREÇÃO FINAL: Pede ao servidor os dados da sala assim que o componente estiver pronto.
    if (codigo) {
      socket.emit('solicitarDadosSala', codigo);
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('atualizarLobby', handleAtualizarLobby);
      socket.off('seuPapel', handleSeuPapel);
    };
  }, [navigate, codigo]); // Adicionamos 'codigo' à dependência para garantir que o emit é feito

  const handleDistribuirPapeis = () => {
    socket.emit('distribuirPapeis', { codigo });
  };

  const euSouOHost = meuId !== null && meuId === hostId;

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h2>SALA: {codigo?.toUpperCase()}</h2>
        <p className="share-code">Compartilhe este código com seus amigos!</p>
        <div className="lista-jogadores">
          <h3>Jogadores na Sala ({jogadores.length}):</h3>
          <ul>
            {jogadores.map((jogador) => (
              <li key={jogador.id}>
                <span className="player-name">{jogador.nome}</span>
                {jogador.id === hostId && <span className="host-tag">👑 Host</span>}
              </li>
            ))}
          </ul>
        </div>
        {euSouOHost && (<button className="start-button" onClick={handleDistribuirPapeis}>Distribuir Papéis</button>)}
        {!euSouOHost && (<p className="aguardando-host">Aguardando o Host iniciar o jogo...</p>)}
      </div>
    </div>
  );
}