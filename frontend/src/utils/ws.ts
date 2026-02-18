import { decode } from '@msgpack/msgpack';

export type AckMessage = { type: 'ack'; chunk_seq: number; received: number };

export type SessionResultMessage = {
  type?: 'result';
  bpm: number | null;
  confidence: number;
  quality: 'good' | 'medium' | 'poor';
  message?: string;
  duration_s: number;
  frames_received: number;
  face_detect_rate: number;
  snr_db: number | null;
  bpm_series?: number[];
};

export type WsServerMessage = AckMessage | SessionResultMessage | { type: 'error'; message: string };

export function getApiBase(): string {
  return (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:8000';
}

export function getWsBase(): string {
  const env = (import.meta as any).env?.VITE_WS_BASE;
  if (env) return env;

  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//localhost:8000`;
}

export class RppgWebSocketClient {
  private ws: WebSocket | null = null;
  private openPromise: Promise<void> | null = null;

  constructor(
    private url: string,
    private onMessage: (msg: WsServerMessage) => void,
    private onClose: (ev: CloseEvent) => void,
    private onError: (ev: Event) => void,
  ) {}

  connect(): Promise<void> {
    if (this.openPromise) return this.openPromise;

    this.openPromise = new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => resolve();
      this.ws.onclose = (ev) => this.onClose(ev);
      this.ws.onerror = (ev) => {
        this.onError(ev);
        reject(new Error('WebSocket error'));
      };
      this.ws.onmessage = (ev) => {
        try {
          if (typeof ev.data === 'string') {
            const msg = JSON.parse(ev.data);
            this.onMessage(msg);
          } else {
            // If we ever use binary server messages later.
            const msg = decode(new Uint8Array(ev.data as ArrayBuffer)) as any;
            this.onMessage(msg);
          }
        } catch (e: any) {
          this.onMessage({ type: 'error', message: e?.message ?? 'Invalid server message' });
        }
      };
    });

    return this.openPromise;
  }

  isOpen() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  close() {
    this.ws?.close();
  }

  sendJson(payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.ws.send(JSON.stringify(payload));
  }
}