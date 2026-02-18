import React, { useMemo, useState } from 'react';

export type ConsentModalProps = {
  open: boolean;
  onClose?: () => void;
  onAccept: () => void;
};

const CONSENT_ITEMS = [
  {
    id: 'purpose',
    label:
      'Entendi que a finalidade é estimar BPM via câmera, e que isso não é um dispositivo médico.',
  },
  {
    id: 'no-storage',
    label:
      'Entendi que as imagens são processadas temporariamente e não são armazenadas (sem gravação em disco).',
  },
  {
    id: 'rights',
    label:
      'Li os documentos e entendi meus direitos e limitações do MVP (qualidade depende de luz/movimento).',
  },
];

export default function ConsentModal({ open, onClose, onAccept }: ConsentModalProps) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const allOk = useMemo(
    () => CONSENT_ITEMS.every((i) => checks[i.id]),
    [checks],
  );

  if (!open) return null;

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <h2>Consentimento (LGPD)</h2>
        <p>
          Para continuar, precisamos do seu consentimento para usar a câmera durante a medição.
        </p>

        <div className="card" style={{ marginBottom: 12 }}>
          <b>Dicas para melhor medição</b>
          <ul style={{ marginTop: 8, marginBottom: 0 }}>
            <li>Fique com o rosto centralizado e o celular/computador estável.</li>
            <li>Prefira luz frontal (evite contraluz).</li>
            <li>Evite falar, sorrir muito ou mexer a cabeça durante a captura.</li>
          </ul>
        </div>

        <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
          {CONSENT_ITEMS.map((item) => (
            <label key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={!!checks[item.id]}
                onChange={(e) => setChecks((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                style={{ marginTop: 4 }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <a href="/docs/CONSENT.md" target="_blank" rel="noreferrer">
            CONSENT.md
          </a>
          <a href="/docs/PRIVACY.md" target="_blank" rel="noreferrer">
            PRIVACY.md
          </a>
          <a href="/docs/API_SPEC.md" target="_blank" rel="noreferrer">
            API_SPEC.md
          </a>
          <a href="/docs/TEST_PLAN.md" target="_blank" rel="noreferrer">
            TEST_PLAN.md
          </a>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
          <button className="btn primary" disabled={!allOk} onClick={onAccept}>
            Aceito e quero medir
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <small className="muted">
            Observação: você pode parar a captura a qualquer momento.
          </small>
        </div>
      </div>
    </div>
  );
}
