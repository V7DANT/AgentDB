/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'mock' (default) or 'api' — selects the service implementation. */
  readonly VITE_AGENTDB_DATA_SOURCE?: 'mock' | 'api';
  /** Base URL of the FastAPI backend, e.g. http://localhost:8000/api */
  readonly VITE_AGENTDB_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
