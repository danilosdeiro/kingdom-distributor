import { useEffect, useState } from 'react';
import {
  getRoomConnectionState,
  subscribeToRoomConnection,
  type RoomConnectionState,
} from '../services/roomConnection';
import { rejoinSavedRoom } from '../services/rejoinRoom';
import './ConnectionStatus.css';

export function ConnectionStatus() {
  const [status, setStatus] = useState<RoomConnectionState>(getRoomConnectionState);

  useEffect(() => {
    return subscribeToRoomConnection(setStatus);
  }, []);

  if (status === 'ready') return null;

  const label = {
    connecting: 'Reconectando...',
    offline: 'Sem internet',
    syncing: 'Sincronizando sala...',
    'room-error': 'Sala não sincronizada',
  }[status];

  return (
    <div className={`connection-status ${status}`} role="status" aria-live="polite">
      <span className="connection-status-dot" />
      <span>{label}</span>
      {status === 'room-error' && (
        <button type="button" onClick={() => rejoinSavedRoom(true)}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
