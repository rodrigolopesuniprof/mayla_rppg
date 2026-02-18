import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeLightingOk } from '../utils/image';

export type UseWebcamOpts = {
  width: number;
  height: number;
};

export function useWebcam(opts: UseWebcamOpts) {
  const { width, height } = opts;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const workCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const lightCanvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));

  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightingOk, setLightingOk] = useState<boolean>(true);

  const start = useCallback(async () => {
    setError(null);
    setIsReady(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error('Video element not available');
      video.srcObject = stream;

      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          video.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        video.addEventListener('loadedmetadata', onLoaded);
      });

      await video.play();
      setIsReady(true);
    } catch (e: any) {
      const msg = e?.name === 'NotAllowedError'
        ? 'Permissão de câmera negada.'
        : e?.message ?? 'Falha ao acessar a câmera.';
      setError(msg);
      throw e;
    }
  }, [width, height]);

  const stop = useCallback(() => {
    const s = streamRef.current;
    streamRef.current = null;
    if (s) s.getTracks().forEach((t) => t.stop());
    setIsReady(false);
  }, []);

  // Periodic lighting heuristic (cheap)
  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;
      try {
        const ok = await computeLightingOk({
          video,
          canvas: lightCanvasRef.current,
          width,
          height,
        });
        if (!cancelled) setLightingOk(ok);
      } catch {
        // ignore
      }
    }, 800);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isReady, width, height]);

  const workCanvas = useMemo(() => workCanvasRef.current, []);

  return {
    videoRef,
    workCanvas,
    isReady,
    error,
    lightingOk,
    start,
    stop,
  };
}
