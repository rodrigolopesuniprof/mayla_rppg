import { useCallback, useState } from 'react';
import { getApiBase } from '../utils/ws';

export type SessionParams = {
  session_id: string;
  capture_seconds: number;
  target_fps: number;
  resolution: string;
  jpeg_quality: number;
  roi_refresh_interval: number;
  ttl_sec: number;
  max_frames: number;
  max_bytes_mb: number;
  max_chunk_size: number;
  mock_mode: boolean;
};

export function useSessionParams() {
  const [params, setParams] = useState<SessionParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const startSession = useCallback(async (consent: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${getApiBase()}/sessions/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consent }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      const data = (await resp.json()) as SessionParams;
      setParams(data);
      return data;
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao iniciar sessão');
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setParams(null);
    setError(null);
    setLoading(false);
  }, []);

  return { params, error, loading, startSession, clear };
}
