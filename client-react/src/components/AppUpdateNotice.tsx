import { useState } from 'react';
import { Download, LoaderCircle, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { InstallPermissionRequiredError } from '../services/appUpdate';
import './AppUpdateNotice.css';

export function AppUpdateNotice() {
  const { update, showNotice, dismissUpdate, installUpdate } = useAppUpdate();
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [permissionRequested, setPermissionRequested] = useState(false);
  if (!update || !showNotice) return null;

  const handleInstall = async () => {
    setInstalling(true);
    setProgress(0);
    setPermissionRequested(false);
    try {
      await installUpdate(setProgress);
    } catch (error) {
      const needsPermission = error instanceof InstallPermissionRequiredError;
      setPermissionRequested(needsPermission);
      const message = needsPermission
        ? error.message
        : 'Não foi possível baixar a atualização. Tente novamente.';
      toast.error(message, { duration: 7000 });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <aside className="app-update-notice" aria-label="Atualização disponível">
      <div className="app-update-copy">
        <strong>MeuKingdom {update.versionName}</strong>
        <span>
          {permissionRequested
            ? 'Depois de autorizar, toque em Atualizar novamente'
            : 'Nova versão disponível'}
        </span>
      </div>
      <button
        type="button"
        className="app-update-action"
        onClick={() => void handleInstall()}
        disabled={installing}
      >
        {installing
          ? <LoaderCircle size={18} className="app-update-spinner" aria-hidden="true" />
          : <Download size={18} aria-hidden="true" />}
        {installing ? `Baixando ${progress}%` : 'Atualizar'}
      </button>
      <button
        type="button"
        className="app-update-dismiss"
        onClick={dismissUpdate}
        aria-label="Lembrar depois"
        title="Lembrar depois"
        disabled={installing}
      >
        <X size={20} aria-hidden="true" />
      </button>
    </aside>
  );
}
