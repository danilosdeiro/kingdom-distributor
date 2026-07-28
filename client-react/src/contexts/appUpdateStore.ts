import { createContext } from 'react';
import type { AppUpdate, InstalledApp } from '../services/appUpdate';

export interface AppUpdateContextValue {
  installedApp: InstalledApp | null;
  update: AppUpdate | null;
  showNotice: boolean;
  dismissUpdate: () => void;
  installUpdate: () => Promise<void>;
}

export const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);
