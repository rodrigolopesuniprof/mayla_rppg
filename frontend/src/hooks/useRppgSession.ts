import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { captureJpegFrame } from '../utils/image';
import {
  getWsBase,
  RppgWebSocketClient,
  SessionResultMessage,
  WsServerMessage,
} from '../utils/ws';

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

  const clientRef = useRef<RppgWebSocketClient | null>(null);
  const captureIntervalRef = useRef<number | null>(null);
  const chunkIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  const pendingFramesRef = useRef<Uint8Array[]>([]);
  const chunkSeqRef = useRef(0);
  const lastSendAtRef = useRef<number>(0);

  const ackedChunkSeqRef = useRef<number>(-1);

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

  const disconnect = useCallback(() => {
    clientRef.current?.close();
    clientRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cleanupTimers();
    disconnect();
    pendingFramesRef.current = [];
    chunkSeqRef.current = 0;
    ackedChunkSeqRef.current = -1;
    lastSendAtRef.current = 0;
    setState({
      isCapturing: false,
      secondsElapsed: 0,
      chunksSent: 0,
      framesSent: 0,
      lastAckChunkSeq: null,
      error: null,
    });
  }, [cleanupTimers, disconnect]);

  const handleServerMessage = useCallback(
    (msg: WsServerMessage) => {
      if ((msg as any)?.type === 'ack') {
        const ack = msg as any as { chunk_seq: number };
        ackedChunkSeqRef.current = Math.max(ackedChunkSeqRef.current, ack.chunk_seq);
        setState((s) => ({ ...s, lastAckChunkSeq: ack.chunk_seq }));
        return;
      }

      if ((msg as any)?.type === 'chunk_signal') {
        const face = Boolean((msg as any).face_detected);
        onFaceDetected?.(face);
        return;
      }

      if ((msg as any)?.bpm !== undefined && (msg as any)?.quality) {
        onResult(msg as any as SessionResultMessage);
        // After result, we can close any remaining resources.
        cleanupTimers();
        setState((s) => ({ ...s, isCapturing: false }));
        disconnect();
        return;
      }

      if ((msg as any)?.type === 'error') {
        setState((s) => ({ ...s, error: (msg as any).message ?? 'Erro no servidor' }));
      }
    },
    [cleanupTimers, disconnect, onResult, onFaceDetected],
  );

  const connect = useCallback(
    async (sid: string) => {
      const url = `${getWsBase()}/ws/sessions/${encodeURIComponent(sid)}`;
      const client = new RppgWebSocketClient(
        url,
        handleServerMessage,
        () => setState((s) => ({ ...s, error: s.isCapturing ? 'Conexão perdida.' : s.error })),
        () => setState((s) => ({ ...s, error: 'Erro na conexão WebSocket.' })),
      );
      clientRef.current = client;
      await client.connect();
    },
    [handleServerMessage],
  );

  // User-initiated stop: stop capture AND close socket
  const stop = useCallback(() => {
    cleanupTimers();
    setState((s) => ({ ...s, isCapturing: false }));
    disconnect();
  }, [cleanupTimers, disconnect]);

  const flushPendingFramesOnce = useCallback(() => {
    const client = clientRef.current;
    if (!client || !client.isOpen()) return;

    while (pendingFramesRef.current.length > 0) {
      const frames = pendingFramesRef.current.splice(0, maxChunkSize);
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
      client.sendJson(payload);
      setState((s) => ({
        ...s,
        chunksSent: s.chunksSent + 1,
        framesSent: s.framesSent + frames.length,
      }));
    }
  }, [height, maxChunkSize, width]);

  const sendEnd = useCallback(() => {
    const client = clientRef.current;
    if (!client || !client.isOpen()) return;
    client.sendJson({ type: 'end' });
  }, []);

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
      setState((s) => ({ ...s, isCapturing: true, error: null }));

      try {
        await connect(sid);
      } catch {
        setState((s) => ({ ...s, isCapturing: false, error: 'Falha ao conectar no servidor.' }));
        return;
      }

      const captureEveryMs = Math.max(80, Math.floor(1000 / Math.max(1, targetFps)));

      // Capture loop (throttled)
      captureIntervalRef.current = window.setInterval(async () => {
        const v = videoRef.current;
        if (!v) return;
        if (!clientRef.current?.isOpen()) return;
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
          // ignore occasional frame failures
        }
      }, Math.max(30, Math.floor(captureEveryMs / 2)));

      // Chunk send loop (every 1s)
      chunkIntervalRef.current = window.setInterval(() => {
        const client = clientRef.current;
        if (!client || !client.isOpen()) return;

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

        try {
          client.sendJson(payload);
          setState((s) => ({
            ...s,
            chunksSent: s.chunksSent + 1,
            framesSent: s.framesSent + frames.length,
          }));
        } catch (e: any) {
          setState((s) => ({ ...s, error: e?.message ?? 'Falha ao enviar chunk' }));
        }
      }, 1000);

      // Timer: at the end, do NOT close the socket.
      // We flush remaining frames and send an explicit {type:'end'} so the backend finalizes.
      const startedAt = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        setState((s) => ({ ...s, secondsElapsed: Math.floor(elapsed) }));
        if (elapsed >= captureSeconds) {
          // stop capture loops, but keep WS open until result arrives
          if (captureIntervalRef.current) window.clearInterval(captureIntervalRef.current);
          if (chunkIntervalRef.current) window.clearInterval(chunkIntervalRef.current);
          captureIntervalRef.current = null;
          chunkIntervalRef.current = null;
          if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;

          setState((s) => ({ ...s, isCapturing: false }));

          try {
            flushPendingFramesOnce();
            sendEnd();
          } catch {
            // ignore
          }
        }
      }, 250);
    },
    [
      captureSeconds,
      connect,
      flushPendingFramesOnce,
      height,
      jpegQuality,
      maxChunkSize,
      reset,
      sendEnd,
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
      disconnect();
    };
  }, [cleanupTimers, disconnect]);

  return {
    ...state,
    start,
    stop,
    reset,
  };
}