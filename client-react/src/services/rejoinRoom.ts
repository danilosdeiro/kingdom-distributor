import { socket } from './socket';
import { getPlayerId } from './playerIdentity';
import { getRoomRecoveryToken } from './roomRecovery';

export function rejoinSavedRoom() {
  const codigo = localStorage.getItem('salaAtual');
  const nome = localStorage.getItem('meuNome');

  if (!codigo || !nome) return false;

  socket.emit('entrarSala', {
    codigo,
    nome,
    playerId: getPlayerId(),
    recoveryToken: getRoomRecoveryToken(codigo),
  });

  return true;
}
