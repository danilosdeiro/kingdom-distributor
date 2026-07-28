import { useContext } from 'react';
import { AppUpdateContext } from '../contexts/appUpdateStore';

export function useAppUpdate() {
  const context = useContext(AppUpdateContext);
  if (!context) throw new Error('useAppUpdate must be used inside AppUpdateProvider.');
  return context;
}
