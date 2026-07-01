import { socket } from './socket';

export function rejoinSavedRoom() {
  const codigo = localStorage.getItem('salaAtual');
  const nome = localStorage.getItem('meuNome');

  if (!codigo || !nome) return false;

  socket.emit('entrarSala', {
    codigo,
    nome,
  });

  return true;
}
