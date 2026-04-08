/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HELP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
