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

      const attach = (cp: ChildProcessWithoutNullStreams, cmd: string) => {
        backendProcess = cp;

        cp.stdout.on('data', (d) => {
          const s = d.toString().trimEnd();
          if (s) console.log(`[backend:${cmd}] ${s}`);
        });

        cp.stderr.on('data', (d) => {
          const s = d.toString().trimEnd();
          if (s) console.error(`[backend:${cmd}] ${s}`);
        });

        cp.on('exit', (code, signal) => {
          console.error(`[backend:${cmd}] exited code=${code} signal=${signal}`);
          backendProcess = null;
        });
      };

      // Try python, then python3 (spawn() emits 'error' asynchronously when command is missing).
      const candidates = ['python', 'python3'];
      let started = false;

      const tryNext = (i: number) => {
        if (i >= candidates.length) {
          console.error('[backend] failed to start: neither "python" nor "python3" is available');
          return;
        }

        const cmd = candidates[i];
        const cp = spawnWith(cmd);

        cp.once('spawn', () => {
          started = true;
          attach(cp, cmd);
        });

        cp.once('error', (err) => {
          if (started) return;
          console.error(`[backend:${cmd}] spawn failed: ${String((err as any)?.message ?? err)}`);
          tryNext(i + 1);
        });
      };

      tryNext(0);

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
      '/mayla': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});