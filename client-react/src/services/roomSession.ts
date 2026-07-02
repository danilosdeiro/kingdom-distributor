export function clearRoomSession() {
  sessionStorage.removeItem('ultimoPapel');
  localStorage.removeItem('salaAtual');
  localStorage.removeItem('jogadoresDaSala');
  localStorage.removeItem('meuId');
}
