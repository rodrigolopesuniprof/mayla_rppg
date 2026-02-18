import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

let backendProcess: ChildProcessWithoutNullStreams | null = null;

function startFastApiBackend() {
  return {
    name: 'start-fastapi-backend',
    configureServer() {
      if (backendProcess) return;

      const args = [
        '-m',
        'uvicorn',
        'backend.app.main:app',
        '--host',
        '127.0.0.1',
        '--port',
        '8000',
      ];

      const spawnWith = (cmd: string) =>
        spawn(cmd, args, {
          stdio: 'pipe',
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

      try {
        backendProcess = spawnWith('python');
      } catch {
        backendProcess = spawnWith('python3');
      }

      backendProcess.on('error', () => {
        // Fallback for environments where `python` is not available
        if (backendProcess) return;
        backendProcess = spawnWith('python3');
      });

      backendProcess.stdout.on('data', (d) => {
        const s = d.toString().trimEnd();
        if (s) console.log(`[backend] ${s}`);
      });

      backendProcess.stderr.on('data', (d) => {
        const s = d.toString().trimEnd();
        if (s) console.error(`[backend] ${s}`);
      });

      const cleanup = () => {
        try {
          backendProcess?.kill();
        } catch {
          // ignore
        }
        backendProcess = null;
      };

      process.on('exit', cleanup);
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
    },
  };
}

// We keep the frontend in ./frontend but run Vite from the repo root.
export default defineConfig({
  root: 'frontend',
  plugins: [startFastApiBackend(), react()],
  server: {
    port: 5173,
    strictPort: true,
    // Optional: set VITE_API_BASE/VITE_WS_BASE in production.
    // In local dev we run the FastAPI backend on :8000 and use this proxy.
    proxy: {
      '/sessions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        // Use HTTP target + ws:true for reliable upgrade handling
        target: 'http://127.0.0.1:8000',
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