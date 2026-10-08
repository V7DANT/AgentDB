import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Root-relative alias — avoids depending on Node path helpers.
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    // Proxy API calls to the FastAPI collector, which avoids CORS entirely.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
