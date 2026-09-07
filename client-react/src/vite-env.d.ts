/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_COLLECTOR_VISION_URL?: string;
  readonly VITE_CARD_SCANNER_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
