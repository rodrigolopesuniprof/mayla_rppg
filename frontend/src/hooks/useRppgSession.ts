import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { captureJpegFrame } from '../utils/image';
import { getApiBase, type SessionResultMessage } from '../utils/ws';

export type UseRppgSessionOpts = {
  sessionId: string;
  captureSeconds: number;
  targetFps: number;
  width: number;
  height: number;
  jpegQuality: number;
  maxChunkSize: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  workCanvas: HTMLCanvasElement;
  onResult: (r: SessionResultMessage) => void;
  onFaceDetected?: (v: boolean) => void;
};

type State = {
  isCapturing: boolean;
  secondsElapsed: number;
  chunksSent: number;
  framesSent: number;
  lastAckChunkSeq: number | null;
  error: string | null;
};

function toBase64(u8: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    s += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(s);
}

export function useRppgSession(opts: UseRppgSessionOpts) {
  const {
    sessionId,
    captureSeconds,
    targetFps,
    width,
    height,
    jpegQuality,
    maxChunkSize,
    videoRef,
    workCanvas,
    onResult,
    onFaceDetected,
  } = opts;

  const captureIntervalRef = useRef<number | null>(null);
  const chunkIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const pendingFramesRef = useRef<Uint8Array[]>([]);
  const chunkSeqRef = useRef(0);
  const lastSendAtRef = useRef<number>(0);

  const ackedChunkSeqRef = useRef<number>(-1);
  const inFlightChunkRef = useRef(false);
  const stoppedRef = useRef(false);

  // Important: we must keep the *active* session id in a ref.
  // The parent updates sessionId via React state, which may lag behind the start() call.
  const activeSessionIdRef = useRef<string>('');

  const [state, setState] = useState<State>({
    isCapturing: false,
    secondsElapsed: 0,
    chunksSent: 0,
    framesSent: 0,
    lastAckChunkSeq: null,
    error: null,
  });

  const cleanupTimers = useCallback(() => {
    if (captureIntervalRef.current) window.clearInterval(captureIntervalRef.current);
    if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
    if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    captureIntervalRef.current = null;
    chunkIntervalRef.current = null;
    timerIntervalRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cleanupTimers();
    pendingFramesRef.current = [];
    chunkSeqRef.current = 0;
    ackedChunkSeqRef.current = -1;
    lastSendAtRef.current = 0;
    inFlightChunkRef.current = false;
    stoppedRef.current = false;
    activeSessionIdRef.current = '';
    setState({
      isCapturing: false,
      secondsElapsed: 0,
      chunksSent: 0,
      framesSent: 0,
      lastAckChunkSeq: null,
      error: null,
    });
  }, [cleanupTimers]);

  const postChunkOnce = useCallback(async () => {
    if (inFlightChunkRef.current) return;
    if (pendingFramesRef.current.length === 0) return;

    const sid = activeSessionIdRef.current || sessionId;
    if (!sid) {
      setState((s) => ({ ...s, error: 'Sessão inválida. Inicie novamente.' }));
      return;
    }

    const frames = pendingFramesRef.current.splice(0, maxChunkSize);
    if (frames.length === 0) return;

    const chunk_seq = chunkSeqRef.current++;
    const payload = {
      chunk_seq,
      ts_start_ms: Date.now(),
      fps_est: frames.length,
      width,
      height,
      n: frames.length,
      frames: frames.map(toBase64),
    };

    inFlightChunkRef.current = true;
    try {
      const resp = await fetch(`${getApiBase()}/sessions/${encodeURIComponent(sid)}/chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      const ack = (await resp.json()) as { chunk_seq: number; received: number };
      ackedChunkSeqRef.current = Math.max(ackedChunkSeqRef.current, ack.chunk_seq);

      setState((s) => ({
        ...s,
        chunksSent: s.chunksSent + 1,
        framesSent: s.framesSent + frames.length,
        lastAckChunkSeq: ack.chunk_seq,
      }));

      // We don't currently compute face detection progress in HTTP mode.
      onFaceDetected?.(true);
    } catch (e: any) {
      // Put frames back so user can retry without losing capture entirely.
      pendingFramesRef.current.unshift(...frames);
      setState((s) => ({ ...s, error: e?.message ?? 'Falha ao enviar chunk' }));
    } finally {
      inFlightChunkRef.current = false;
    }
  }, [height, maxChunkSize, onFaceDetected, sessionId, width]);

  const finalize = useCallback(async () => {
    const sid = activeSessionIdRef.current || sessionId;
    if (!sid) return;
    try {
      const resp = await fetch(`${getApiBase()}/sessions/${encodeURIComponent(sid)}/end`, {
        method: 'POST',
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }
      const result = (await resp.json()) as SessionResultMessage;
      onResult(result);
    } catch (e: any) {
      setState((s) => ({ ...s, error: e?.message ?? 'Falha ao finalizar sessão' }));
    }
  }, [onResult, sessionId]);

  // User-initiated stop
  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanupTimers();
    setState((s) => ({ ...s, isCapturing: false }));
  }, [cleanupTimers]);

  const start = useCallback(
    async (sessionIdOverride?: string) => {
      const videoEl = videoRef.current;
      if (!videoEl) {
        setState((s) => ({ ...s, error: 'Câmera não pronta.' }));
        return;
      }

      const sid = sessionIdOverride ?? sessionId;
      if (!sid) {
        setState((s) => ({ ...s, error: 'Sessão inválida. Inicie novamente.' }));
        return;
      }

      reset();
      activeSessionIdRef.current = sid;
      setState((s) => ({ ...s, isCapturing: true, error: null }));

      // Capture loop
      const captureEveryMs = Math.max(80, Math.floor(1000 / Math.max(1, targetFps)));
      captureIntervalRef.current = window.setInterval(async () => {
        const v = videoRef.current;
        if (!v) return;
        if (stoppedRef.current) return;

        const now = Date.now();
        const ackLag = chunkSeqRef.current - (ackedChunkSeqRef.current + 1);
        if (ackLag > 2) return;
        if (now - lastSendAtRef.current < captureEveryMs - 5) return;

        lastSendAtRef.current = now;
        try {
          const jpeg = await captureJpegFrame({
            video: v,
            canvas: workCanvas,
            width,
            height,
            jpegQuality,
          });
          pendingFramesRef.current.push(jpeg);
        } catch {
          // ignore
        }
      }, Math.max(30, Math.floor(captureEveryMs / 2)));

      // Chunk send loop (every 1s)
      chunkIntervalRef.current = window.setInterval(() => {
        void postChunkOnce();
      }, 1000);

      // Timer: at the end, flush and finalize
      const startedAt = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        setState((s) => ({ ...s, secondsElapsed: Math.floor(elapsed) }));

        if (elapsed >= captureSeconds) {
          if (captureIntervalRef.current) window.clearInterval(captureIntervalRef.current);
          if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
          captureIntervalRef.current = null;
          chunkIntervalRef.current = null;
          timerIntervalRef.current = null;

          setState((s) => ({ ...s, isCapturing: false }));

          // Send remaining frames and then finalize.
          void (async () => {
            await postChunkOnce();
            await postChunkOnce();
            await finalize();
          })();
        }
      }, 250);
    },
    [
      captureSeconds,
      finalize,
      height,
      jpegQuality,
      postChunkOnce,
      reset,
      sessionId,
      targetFps,
      videoRef,
      width,
      workCanvas,
    ],
  );

  useEffect(() => {
    return () => {
      cleanupTimers();
    };
  }, [cleanupTimers]);

  return {
    ...state,
    start,
    stop,
    reset,
  };
}