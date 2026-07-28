import { clearRoomRecovery } from './roomRecovery';
import { markRoomConnectionLeft } from './roomConnection';

export function clearRoomSession() {
  sessionStorage.removeItem('ultimoPapel');
  localStorage.removeItem('salaAtual');
  localStorage.removeItem('jogadoresDaSala');
  localStorage.removeItem('meuId');
  clearRoomRecovery();
  markRoomConnectionLeft();
}
