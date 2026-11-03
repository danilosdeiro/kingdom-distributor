const DEFAULT_PUBLIC_APP_URL = 'https://meukingdom.pages.dev';

export const PUBLIC_APP_URL = (
  import.meta.env.VITE_PUBLIC_APP_URL || DEFAULT_PUBLIC_APP_URL
).replace(/\/$/, '');

export const PUBLIC_APP_HOST = new URL(PUBLIC_APP_URL).hostname;
