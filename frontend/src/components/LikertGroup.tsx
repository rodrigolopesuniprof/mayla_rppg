import React, { useId, useMemo } from 'react';

type LikertOption = {
  value: 1 | 2 | 3 | 4 | 5;
  emoji: string;
  text: string;
};

type Props = {
  label: string;
  question: string;
  options: LikertOption[];
  value: LikertOption['value'] | null;
  onChange: (value: LikertOption['value']) => void;
};

function clampIndex(i: number, len: number) {
  return Math.max(0, Math.min(len - 1, i));
}

export default function LikertGroup({ label, question, options, value, onChange }: Props) {
  const groupId = useId();

  const selectedIndex = useMemo(() => {
    if (value == null) return -1;
    return options.findIndex((o) => o.value === value);
  }, [options, value]);

  return (
    <section className="bg-card rounded-[18px] p-4 shadow-[0_2px_8px_rgba(0,0,0,.05)]">
      <p className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground mb-2">{label}</p>
      <p className="text-[14px] text-ink font-medium leading-snug mb-3">{question}</p>

      <div role="radiogroup" aria-labelledby={groupId} className="flex gap-2">
        <span id={groupId} className="sr-only">
          {label}
        </span>

        {options.map((opt, idx) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const next = e.key === 'ArrowRight' ? selectedIndex + 1 : selectedIndex - 1;
                const nextIdx = clampIndex(next < 0 ? 0 : next, options.length);
                onChange(options[nextIdx].value);
              }}
              className={`flex-1 min-w-0 rounded-[16px] px-1.5 py-2 border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-cream ${
                selected ? 'border-rose' : 'border-transparent'
              }`}
              style={{ background: selected ? 'rgba(232, 87, 74, 0.08)' : 'hsl(var(--sand))' }}
            >
              <div className="flex flex-col items-center">
                <div className="text-[22px] leading-none">{opt.emoji}</div>
                <div
                  className={`text-[10px] mt-1 leading-tight text-center ${
                    selected ? 'text-rose font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {opt.text}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
