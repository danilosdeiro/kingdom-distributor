import { Download, X } from 'lucide-react';
import { useAppUpdate } from '../hooks/useAppUpdate';
import './AppUpdateNotice.css';

export function AppUpdateNotice() {
  const { update, showNotice, dismissUpdate, installUpdate } = useAppUpdate();
  if (!update || !showNotice) return null;

  return (
    <aside className="app-update-notice" aria-label="Atualização disponível">
      <div className="app-update-copy">
        <strong>MeuKingdom {update.versionName}</strong>
        <span>Nova versão disponível</span>
      </div>
      <button
        type="button"
        className="app-update-action"
        onClick={() => void installUpdate()}
      >
        <Download size={18} aria-hidden="true" />
        Atualizar
      </button>
      <button
        type="button"
        className="app-update-dismiss"
        onClick={dismissUpdate}
        aria-label="Lembrar depois"
        title="Lembrar depois"
      >
        <X size={20} aria-hidden="true" />
      </button>
    </aside>
  );
}
