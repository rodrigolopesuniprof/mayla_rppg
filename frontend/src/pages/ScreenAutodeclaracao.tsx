import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '../components/AppBar';
import { User } from 'lucide-react';

const moods = [
  { emoji: '😣', label: 'PÉSSIMO' },
  { emoji: '😟', label: 'MAL' },
  { emoji: '😐', label: 'OK' },
  { emoji: '😊', label: 'BEM' },
  { emoji: '🤩', label: 'ÓTIMO' },
];

export default function ScreenAutodeclaracao() {
  const navigate = useNavigate();
  const [selectedMood, setSelectedMood] = useState(4);
  const [meds, setMeds] = useState<boolean | null>(true);

  const today = new Date();
  const dayName = today.toLocaleDateString('pt-BR', { weekday: 'long' });
  const dateStr = today.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  return (
    <div className="flex flex-col min-h-screen bg-cream relative overflow-hidden">
      <div
        className="absolute -top-16 -right-16 w-56 h-56 opacity-20 animate-morph"
        style={{
          background:
            'radial-gradient(circle at 40% 40%, hsl(var(--rose-lt)), hsl(var(--peach)))',
          borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
        }}
      />

      <AppBar
        rightIcon={
          <button className="w-9 h-9 rounded-full bg-sand flex items-center justify-center">
            <User size={16} className="text-bark" />
          </button>
        }
      />

      <div className="flex-1 px-6 pb-7 flex flex-col">
        <h1 className="font-display text-[26px] font-medium text-ink leading-tight mt-1 mb-1.5">
          Como está<br />se sentindo<br />
          <em className="text-rose italic">hoje?</em>
        </h1>
        <p className="text-[13px] text-muted-foreground mb-7 capitalize">
          {dateStr} · {dayName}
        </p>

        <p className="text-[11px] font-medium tracking-wider uppercase text-muted-foreground mb-3.5">
          SEU HUMOR AGORA
        </p>

        <div className="relative mb-2">
          <div
            className="h-2 rounded-full"
            style={{
              background:
                'linear-gradient(to right, hsl(var(--rose)), hsl(var(--amber)), hsl(var(--green)))',
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-card border-[3px] border-mayla-green cursor-pointer"
            style={{
              left: `${(selectedMood / (moods.length - 1)) * 100}%`,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 2px 8px rgba(76,175,125,.3)',
            }}
          />
        </div>
        <div className="flex justify-between mt-2 mb-0">
          <span className="text-xs text-muted-foreground flex items-center gap-1">😔 Mal</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1">😊 Bem</span>
        </div>

        <div className="flex justify-between my-4 gap-2">
          {moods.map((m, i) => (
            <button
              key={i}
              onClick={() => setSelectedMood(i)}
              className={`flex-1 py-2.5 rounded-[20px] border-2 flex flex-col items-center gap-1 transition-all text-xl ${
                selectedMood === i
                  ? 'bg-card border-mayla-green shadow-[0_4px_16px_rgba(76,175,125,.15)]'
                  : 'bg-sand border-transparent'
              }`}
            >
              <span>{m.emoji}</span>
              <span
                className={`text-[9px] font-medium tracking-wider uppercase ${
                  selectedMood === i ? 'text-mayla-green' : 'text-muted-foreground'
                }`}
              >
                {m.label}
              </span>
            </button>
          ))}
        </div>

        <div className="h-px bg-sand my-1 mb-5" />

        <h3 className="font-display text-[17px] font-medium text-ink mb-3.5">Já tomou suas medicações?</h3>

        <div className="flex gap-3 mb-7">
          <button
            onClick={() => setMeds(true)}
            className={`flex-1 py-3.5 rounded-2xl font-body text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              meds === true
                ? 'bg-mayla-green text-primary-foreground shadow-[0_6px_20px_rgba(76,175,125,.3)]'
                : 'bg-sand text-bark border-2 border-border'
            }`}
          >
            ✓ Sim, tomei
          </button>
          <button
            onClick={() => setMeds(false)}
            className={`flex-1 py-3.5 rounded-2xl font-body text-sm font-medium flex items-center justify-center gap-2 transition-all ${
              meds === false
                ? 'bg-mayla-green text-primary-foreground'
                : 'bg-sand text-bark border-2 border-border'
            }`}
          >
            ✕ Ainda não
          </button>
        </div>

        <button
          onClick={() => navigate('/consentimento')}
          className="w-full py-4 rounded-[18px] text-primary-foreground font-body text-[15px] font-medium tracking-wide"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--rose)), hsl(var(--rose-lt)))',
            boxShadow: '0 8px 24px rgba(232,87,74,.3)',
          }}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
