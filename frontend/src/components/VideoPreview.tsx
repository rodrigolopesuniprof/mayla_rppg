import React from 'react';

export type VideoPreviewProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  width: number;
  height: number;
};

export default function VideoPreview({ videoRef, width, height }: VideoPreviewProps) {
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
          ref={videoRef}
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
