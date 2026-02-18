import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// We keep the frontend in ./frontend but run Vite from the repo root.
export default defineConfig({
  root: 'frontend',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // Optional: set VITE_API_BASE/VITE_WS_BASE in production.
    // In local dev you can run the FastAPI backend on :8000 and use this proxy.
    proxy: {
      '/sessions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
