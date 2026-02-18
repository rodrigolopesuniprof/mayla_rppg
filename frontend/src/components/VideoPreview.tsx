import React from 'react';

export type VideoPreviewProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  width: number;
  height: number;

  /** If true, render as a full-bleed stage with face ring overlay (competitor-like). */
  stage?: boolean;
  /** Optional stop action (only used in stage mode). */
  onStop?: () => void;
};

export default function VideoPreview({ videoRef, width, height, stage, onStop }: VideoPreviewProps) {
  if (stage) {
    return (
      <div className="videoStage">
        <video ref={videoRef as any} autoPlay playsInline muted />
        <div className="videoOverlay" />
        {onStop ? (
          <button className="btn danger videoStopBtn" onClick={onStop}>
            Parar
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontWeight: 800 }}>Prévia</div>
        <small className="muted">
          {width}×{height}
        </small>
      </div>

      <div className="videoWrap" style={{ marginTop: 10 }}>
        <video
          ref={videoRef as any}
          autoPlay
          playsInline
          muted
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      <div style={{ marginTop: 10 }}>
        <small className="muted">
          A captura envia frames comprimidos (JPEG) em lotes de ~1s.
        </small>
      </div>
    </div>
  );
}