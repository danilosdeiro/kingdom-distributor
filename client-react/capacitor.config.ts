import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meukingdom.app',
  appName: 'MeuKingdom',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
