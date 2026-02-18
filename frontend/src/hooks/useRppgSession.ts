import { useCallback, useEffect, useRef, useState } from 'react';
import { captureJpegFrame } from '../utils/image';
import {
  ChunkPayload,
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
  videoEl: HTMLVideoElement | null;
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

export function useRppgSession(opts: UseRppgSessionOpts) {
  const {
    sessionId,
    captureSeconds,
    targetFps,
    width,
    height,
    jpegQuality,
    maxChunkSize,
    videoEl,
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

      // Optional per-chunk signals
      if ((msg as any)?.type === 'chunk_signal') {
        const face = Boolean((msg as any).face_detected);
        onFaceDetected?.(face);
        return;
      }

      // Result
      if ((msg as any)?.bpm !== undefined && (msg as any)?.quality) {
        onResult(msg as any as SessionResultMessage);
        return;
      }

      if ((msg as any)?.type === 'error') {
        setState((s) => ({ ...s, error: (msg as any).message ?? 'Erro no servidor' }));
      }
    },
    [onResult, onFaceDetected],
  );

  const connect = useCallback(async () => {
    const url = `${getWsBase()}/ws/sessions/${encodeURIComponent(sessionId)}`;
    const client = new RppgWebSocketClient(
      url,
      handleServerMessage,
      () => setState((s) => ({ ...s, error: s.isCapturing ? 'Conexão perdida.' : s.error })),
      () => setState((s) => ({ ...s, error: 'Erro na conexão WebSocket.' })),
    );
    clientRef.current = client;
    await client.connect();
  }, [handleServerMessage, sessionId]);

  const stop = useCallback(() => {
    cleanupTimers();
    setState((s) => ({ ...s, isCapturing: false }));
    // keep socket open; server will finalize when enough frames/duration or client closes
    disconnect();
  }, [cleanupTimers, disconnect]);

  const start = useCallback(async () => {
    if (!videoEl) {
      setState((s) => ({ ...s, error: 'Câmera não pronta.' }));
      return;
    }

    reset();
    setState((s) => ({ ...s, isCapturing: true, error: null }));

    try {
      await connect();
    } catch (e: any) {
      setState((s) => ({ ...s, isCapturing: false, error: 'Falha ao conectar no servidor.' }));
      return;
    }

    const captureEveryMs = Math.max(80, Math.floor(1000 / Math.max(1, targetFps)));

    // Capture loop (throttled)
    captureIntervalRef.current = window.setInterval(async () => {
      if (!clientRef.current?.isOpen()) return;
      const now = Date.now();
      // Basic throttle/backpressure: if we are more than 2 seconds without ack progress,
      // slow down by skipping captures.
      const ackLag = chunkSeqRef.current - (ackedChunkSeqRef.current + 1);
      if (ackLag > 2) return;
      if (now - lastSendAtRef.current < captureEveryMs - 5) return;

      lastSendAtRef.current = now;
      try {
        const jpeg = await captureJpegFrame({
          video: videoEl,
          canvas: workCanvas,
          width,
          height,
          jpegQuality,
        });
        pendingFramesRef.current.push(jpeg);
      } catch (e) {
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
      const payload: ChunkPayload = {
        chunk_seq,
        ts_start_ms: Date.now(),
        fps_est: frames.length,
        width,
        height,
        n: frames.length,
        frames,
      };

      try {
        client.sendChunk(payload);
        setState((s) => ({
          ...s,
          chunksSent: s.chunksSent + 1,
          framesSent: s.framesSent + frames.length,
        }));
      } catch (e: any) {
        setState((s) => ({ ...s, error: e?.message ?? 'Falha ao enviar chunk' }));
      }
    }, 1000);

    // Timer
    const startedAt = Date.now();
    timerIntervalRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setState((s) => ({ ...s, secondsElapsed: Math.floor(elapsed) }));
      if (elapsed >= captureSeconds) {
        // Stop capture and close socket to signal end.
        stop();
      }
    }, 250);
  }, [captureSeconds, connect, height, jpegQuality, maxChunkSize, reset, stop, targetFps, videoEl, width, workCanvas]);

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
