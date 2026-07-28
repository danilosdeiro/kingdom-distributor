import { socket } from './socket';
import { getPlayerId } from './playerIdentity';
import { getRoomRecoveryToken } from './roomRecovery';
import { beginRoomSync, isRoomReady, isRoomSyncing } from './roomConnection';

let waitingForConnection = false;

export function rejoinSavedRoom(force = false) {
  const codigo = localStorage.getItem('salaAtual');
  const nome = localStorage.getItem('meuNome');

  if (!codigo || !nome) return false;
  if (!socket.connected) {
    if (!waitingForConnection) {
      waitingForConnection = true;
      socket.once('connect', () => {
        waitingForConnection = false;
        rejoinSavedRoom();
      });
    }
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
