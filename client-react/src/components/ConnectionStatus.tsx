import { useEffect, useState } from 'react';
import { socket } from '../services/socket';
import './ConnectionStatus.css';

type ConnectionState = 'connected' | 'connecting' | 'offline';

export function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionState>(socket.connected ? 'connected' : 'connecting');

  useEffect(() => {
    const handleConnect = () => setStatus('connected');
    const handleDisconnect = () => setStatus(navigator.onLine ? 'connecting' : 'offline');
    const handleReconnectAttempt = () => setStatus(navigator.onLine ? 'connecting' : 'offline');
    const handleOnline = () => setStatus(socket.connected ? 'connected' : 'connecting');
    const handleOffline = () => setStatus('offline');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.io.on('reconnect_attempt', handleReconnectAttempt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.io.off('reconnect_attempt', handleReconnectAttempt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (status === 'connected') return null;

  return (
    <div className={`connection-status ${status}`} role="status" aria-live="polite">
      <span className="connection-status-dot" />
      {status === 'offline' ? 'Sem internet' : 'Reconectando...'}
    </div>
  );
}
