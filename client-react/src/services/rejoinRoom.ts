import { socket } from './socket';
import { getPlayerId } from './playerIdentity';

export function rejoinSavedRoom() {
  const codigo = localStorage.getItem('salaAtual');
  const nome = localStorage.getItem('meuNome');

  if (!codigo || !nome) return false;

  socket.emit('entrarSala', {
    codigo,
    nome,
    playerId: getPlayerId(),
  });

  return true;
}
