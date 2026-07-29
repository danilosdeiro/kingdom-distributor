import { socket } from './socket';
import { getPlayerId } from './playerIdentity';
import { getRoomRecoveryToken } from './roomRecovery';
import {
  beginRoomSync,
  isRoomReady,
  isRoomSyncing,
  markRoomConnectionError,
} from './roomConnection';

const CONNECTION_WAIT_TIMEOUT_MS = 70000;

let connectionHandler: (() => void) | null = null;
let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

function clearConnectionWait() {
  if (connectionHandler) {
    socket.off('connect', connectionHandler);
    connectionHandler = null;
  }
  if (connectionTimeout) {
    clearTimeout(connectionTimeout);
    connectionTimeout = null;
  }
}

export function cancelSavedRoomRejoin() {
  clearConnectionWait();
}

export function rejoinSavedRoom(force = false) {
  const codigo = localStorage.getItem('salaAtual');
  const nome = localStorage.getItem('meuNome');

  if (!codigo || !nome) return false;
  if (!socket.connected) {
    beginRoomSync(codigo);

    if (!connectionHandler) {
      connectionHandler = () => {
        clearConnectionWait();
        rejoinSavedRoom(force);
      };
      socket.once('connect', connectionHandler);
      connectionTimeout = setTimeout(() => {
        clearConnectionWait();
        markRoomConnectionError();
      }, CONNECTION_WAIT_TIMEOUT_MS);
    }

    socket.connect();
    return true;
  }
  if (!force && (isRoomReady(codigo) || isRoomSyncing(codigo))) return true;

  beginRoomSync(codigo);

  socket.emit('entrarSala', {
    codigo,
    nome,
    playerId: getPlayerId(),
    recoveryToken: getRoomRecoveryToken(codigo),
  });

  return true;
}
