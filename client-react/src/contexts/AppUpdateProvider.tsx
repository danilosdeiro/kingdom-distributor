import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  findAvailableUpdate,
  getInstalledApp,
  isNativeApp,
  openAppUpdate,
} from '../services/appUpdate';
import {
  AppUpdateContext,
  type AppUpdateContextValue,
} from './appUpdateStore';

const DISMISSED_UPDATE_KEY = 'dismissedAppUpdate';

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [installedApp, setInstalledApp] = useState<AppUpdateContextValue['installedApp']>(null);
  const [update, setUpdate] = useState<AppUpdateContextValue['update']>(null);
  const [dismissedVersionCode, setDismissedVersionCode] = useState(() => (
    Number(localStorage.getItem(DISMISSED_UPDATE_KEY)) || 0
  ));

  const checkForUpdate = useCallback(async () => {
    try {
      const installed = await getInstalledApp();
      setInstalledApp(installed);
      setUpdate(installed ? await findAvailableUpdate(installed.versionCode) : null);
    } catch {
      // Update checks must never interrupt a match.
    }
  }, []);

  useEffect(() => {
    if (!isNativeApp()) return;

    void checkForUpdate();
    let active = true;
    let removeResumeListener: (() => Promise<void>) | undefined;

    void CapacitorApp.addListener('resume', () => {
      void checkForUpdate();
    }).then((handle) => {
      if (active) {
        removeResumeListener = () => handle.remove();
      } else {
        void handle.remove();
      }
    });

    return () => {
      active = false;
      void removeResumeListener?.();
    };
  }, [checkForUpdate]);

  const value = useMemo<AppUpdateContextValue>(() => ({
    installedApp,
    update,
    showNotice: Boolean(update && update.versionCode !== dismissedVersionCode),
    dismissUpdate: () => {
      if (!update) return;
      localStorage.setItem(DISMISSED_UPDATE_KEY, String(update.versionCode));
      setDismissedVersionCode(update.versionCode);
    },
    installUpdate: async (onProgress) => {
      if (update) await openAppUpdate(update, onProgress);
    },
  }), [dismissedVersionCode, installedApp, update]);

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
}
