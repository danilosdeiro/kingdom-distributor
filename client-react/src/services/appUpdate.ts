import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

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

export async function openAppUpdate(update: AppUpdate) {
  if (!isOfficialDownload(update.downloadUrl)) return;
  await Browser.open({ url: update.downloadUrl });
}

export const appUpdateTesting = {
  isOfficialDownload,
  parseUpdateManifest,
};
