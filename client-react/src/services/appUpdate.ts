import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core';

const UPDATE_MANIFEST_URL = 'https://meukingdom.vercel.app/app-update.json';
const RELEASE_PATH_PREFIX = '/danilosdeiro/kingdom-distributor/releases/download/';

export interface AppUpdate {
  versionCode: number;
  versionName: string;
  downloadUrl: string;
}

export interface InstalledApp {
  versionCode: number;
  versionName: string;
}

interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number;
  percent: number;
}

interface AppUpdaterPlugin {
  canInstallPackages(): Promise<{ allowed: boolean }>;
  openInstallSettings(): Promise<void>;
  downloadAndInstall(options: { url: string; fileName: string }): Promise<{ started: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    listener: (progress: DownloadProgress) => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'downloadComplete',
    listener: () => void,
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'downloadError',
    listener: (error: { message: string }) => void,
  ): Promise<PluginListenerHandle>;
}

const AppUpdater = registerPlugin<AppUpdaterPlugin>('AppUpdater');

export class InstallPermissionRequiredError extends Error {
  constructor() {
    super('Autorize o MeuKingdom a instalar atualizações e toque em Atualizar novamente.');
    this.name = 'InstallPermissionRequiredError';
  }
}

function isOfficialDownload(downloadUrl: string) {
  try {
    const url = new URL(downloadUrl);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.pathname.startsWith(RELEASE_PATH_PREFIX);
  } catch {
    return false;
  }
}

function parseUpdateManifest(data: unknown): AppUpdate | null {
  if (!data || typeof data !== 'object') return null;

  const manifest = data as Record<string, unknown>;
  if (
    !Number.isInteger(manifest.versionCode)
    || typeof manifest.versionName !== 'string'
    || !/^\d+\.\d+(?:\.\d+)?$/.test(manifest.versionName)
    || typeof manifest.downloadUrl !== 'string'
    || !isOfficialDownload(manifest.downloadUrl)
  ) {
    return null;
  }

  return {
    versionCode: manifest.versionCode as number,
    versionName: manifest.versionName,
    downloadUrl: manifest.downloadUrl,
  };
}

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function getInstalledApp(): Promise<InstalledApp | null> {
  if (!isNativeApp()) return null;

  const info = await CapacitorApp.getInfo();
  const versionCode = Number(info.build);
  if (!Number.isInteger(versionCode)) return null;

  return {
    versionCode,
    versionName: info.version,
  };
}

export async function findAvailableUpdate(installedVersionCode: number) {
  const response = await fetch(`${UPDATE_MANIFEST_URL}?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!response.ok) return null;

  const update = parseUpdateManifest(await response.json());
  return update && update.versionCode > installedVersionCode ? update : null;
}

export async function openAppUpdate(
  update: AppUpdate,
  onProgress?: (percent: number) => void,
) {
  if (!isOfficialDownload(update.downloadUrl)) return;

  if (isNativeApp() && Capacitor.getPlatform() === 'android') {
    const { allowed } = await AppUpdater.canInstallPackages();
    if (!allowed) {
      await AppUpdater.openInstallSettings();
      throw new InstallPermissionRequiredError();
    }

    let resolveDownload: () => void = () => undefined;
    let rejectDownload: (error: Error) => void = () => undefined;
    const downloadFinished = new Promise<void>((resolve, reject) => {
      resolveDownload = resolve;
      rejectDownload = reject;
    });
    const listeners = await Promise.all([
      AppUpdater.addListener('downloadProgress', ({ percent }) => onProgress?.(percent)),
      AppUpdater.addListener('downloadComplete', resolveDownload),
      AppUpdater.addListener('downloadError', ({ message }) => rejectDownload(new Error(message))),
    ]);

    try {
      await AppUpdater.downloadAndInstall({
        url: update.downloadUrl,
        fileName: `MeuKingdom-${update.versionName}.apk`,
      });
      await downloadFinished;
    } finally {
      await Promise.all(listeners.map((listener) => listener.remove()));
    }
    return;
  }

  await Browser.open({ url: update.downloadUrl });
}

export const appUpdateTesting = {
  isOfficialDownload,
  parseUpdateManifest,
};
