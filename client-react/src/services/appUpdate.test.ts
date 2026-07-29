import { describe, expect, it } from 'vitest';
import { appUpdateTesting } from './appUpdate';

const officialDownload = 'https://github.com/danilosdeiro/kingdom-distributor/releases/download/v1.16/MeuKingdom-1.16.apk';

describe('app update manifest', () => {
  it('accepts an official release manifest', () => {
    expect(appUpdateTesting.parseUpdateManifest({
      versionCode: 17,
      versionName: '1.16',
      downloadUrl: officialDownload,
    })).toEqual({
      versionCode: 17,
      versionName: '1.16',
      downloadUrl: officialDownload,
    });
  });

  it.each([
    'http://github.com/danilosdeiro/kingdom-distributor/releases/download/v1.16/app.apk',
    'https://github.example.com/danilosdeiro/kingdom-distributor/releases/download/v1.16/app.apk',
    'https://github.com/outro/repositorio/releases/download/v1.16/app.apk',
    'not-a-url',
  ])('rejects an untrusted download URL: %s', (downloadUrl) => {
    expect(appUpdateTesting.isOfficialDownload(downloadUrl)).toBe(false);
  });

  it.each([
    null,
    {},
    { versionCode: 17.5, versionName: '1.16', downloadUrl: officialDownload },
    { versionCode: 17, versionName: 1.16, downloadUrl: officialDownload },
    { versionCode: 17, versionName: '../1.16', downloadUrl: officialDownload },
    { versionCode: 17, versionName: '1.16', downloadUrl: 'https://example.com/app.apk' },
  ])('rejects a malformed manifest', (manifest) => {
    expect(appUpdateTesting.parseUpdateManifest(manifest)).toBeNull();
  });
});
