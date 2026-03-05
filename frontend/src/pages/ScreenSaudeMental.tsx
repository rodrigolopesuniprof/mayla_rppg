import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '../components/AppBar';
import LikertGroup from '../components/LikertGroup';

const STORAGE_KEY = 'mayla:mental_health';

type MentalHealth = {
  depression_phq: 1 | 2 | 3 | 4 | 5;
  anxiety_gad: 1 | 2 | 3 | 4 | 5;
  stress_pss: 1 | 2 | 3 | 4 | 5;
  energy_level: 1 | 2 | 3 | 4 | 5;
  sleep_quality: 1 | 2 | 3 | 4 | 5;
  social_support: 1 | 2 | 3 | 4 | 5;
};

type Answers = {
  [K in keyof MentalHealth]: MentalHealth[K] | null;
};

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ScreenSaudeMental() {
  const navigate = useNavigate();

  const [answers, setAnswers] = useState<Answers>({
    depression_phq: null,
    anxiety_gad: null,
    stress_pss: null,
    energy_level: null,
    sleep_quality: null,
    social_support: null,
  });

  const isComplete = useMemo(() => Object.values(answers).every((v) => v != null), [answers]);

  const today = new Date();
  const day = today.toLocaleDateString('pt-BR', { day: 'numeric' });
  const month = today.toLocaleDateString('pt-BR', { month: 'long' });
  const weekday = capitalize(today.toLocaleDateString('pt-BR', { weekday: 'long' }));
  const dateStr = `${day} de ${month} · ${weekday}`;

  function handleContinue() {
    if (!isComplete) return;

    const mental_health: MentalHealth = {
      depression_phq: answers.depression_phq!,
      anxiety_gad: answers.anxiety_gad!,
      stress_pss: answers.stress_pss!,
      energy_level: answers.energy_level!,
      sleep_quality: answers.sleep_quality!,
      social_support: answers.social_support!,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ mental_health }));
    navigate('/consentimento');
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[420px] mx-auto flex flex-col min-h-screen">
        <AppBar showBack />

        <div className="flex-1 overflow-y-auto px-6 pb-44">
          <h1 className="font-display text-[26px] font-medium text-ink leading-tight mt-1 mb-1.5">
            Como está sua
            <br />
            <em className="text-rose italic">mente hoje?</em>
          </h1>
          <p className="text-[13px] text-muted-foreground mb-6">{dateStr}</p>

          <div className="flex flex-col gap-4">
            <LikertGroup
              label="HUMOR"
              question="Nas últimas 2 semanas, você se sentiu desanimado ou sem esperança?"
              value={answers.depression_phq}
              onChange={(v) => setAnswers((a) => ({ ...a, depression_phq: v }))}
              options={[
                { value: 1, emoji: '😞', text: 'Sempre' },
                { value: 2, emoji: '😟', text: 'Frequente' },
                { value: 3, emoji: '😐', text: 'Às vezes' },
                { value: 4, emoji: '🙂', text: 'Raramente' },
                { value: 5, emoji: '😊', text: 'Nunca' },
              ]}
            />

            <LikertGroup
              label="ANSIEDADE"
              question="Você se sentiu nervoso ou ansioso hoje?"
              value={answers.anxiety_gad}
              onChange={(v) => setAnswers((a) => ({ ...a, anxiety_gad: v }))}
              options={[
                { value: 1, emoji: '😨', text: 'Muito' },
                { value: 2, emoji: '😰', text: 'Bastante' },
                { value: 3, emoji: '😬', text: 'Moderado' },
                { value: 4, emoji: '😐', text: 'Pouco' },
                { value: 5, emoji: '😌', text: 'Nada' },
              ]}
            />

            <LikertGroup
              label="ESTRESSE"
              question="Você sentiu que as coisas estavam fora do seu controle?"
              value={answers.stress_pss}
              onChange={(v) => setAnswers((a) => ({ ...a, stress_pss: v }))}
              options={[
                { value: 1, emoji: '😫', text: 'Completo' },
                { value: 2, emoji: '😟', text: 'Bastante' },
                { value: 3, emoji: '😐', text: 'Moderado' },
                { value: 4, emoji: '🙂', text: 'Pouco' },
                { value: 5, emoji: '😎', text: 'Nada' },
              ]}
            />

            <LikertGroup
              label="ENERGIA"
              question="Como está seu nível de energia agora?"
              value={answers.energy_level}
              onChange={(v) => setAnswers((a) => ({ ...a, energy_level: v }))}
              options={[
                { value: 1, emoji: '🪫', text: 'Sem energia' },
                { value: 2, emoji: '😪', text: 'Baixo' },
                { value: 3, emoji: '😐', text: 'Regular' },
                { value: 4, emoji: '⚡', text: 'Bom' },
                { value: 5, emoji: '🔥', text: 'Ótimo' },
              ]}
            />

            <LikertGroup
              label="SONO"
              question="Como você dormiu na última noite?"
              value={answers.sleep_quality}
              onChange={(v) => setAnswers((a) => ({ ...a, sleep_quality: v }))}
              options={[
                { value: 1, emoji: '😫', text: 'Muito mal' },
                { value: 2, emoji: '😞', text: 'Mal' },
                { value: 3, emoji: '😐', text: 'Regular' },
                { value: 4, emoji: '😴', text: 'Bem' },
                { value: 5, emoji: '🌟', text: 'Muito bem' },
              ]}
            />

            <LikertGroup
              label="SUPORTE SOCIAL"
              question="Você sente que tem pessoas com quem pode contar quando precisa?"
              value={answers.social_support}
              onChange={(v) => setAnswers((a) => ({ ...a, social_support: v }))}
              options={[
                { value: 1, emoji: '😔', text: 'Nenhuma' },
                { value: 2, emoji: '😕', text: 'Quase' },
                { value: 3, emoji: '😐', text: 'Algumas' },
                { value: 4, emoji: '🤝', text: 'Sim' },
                { value: 5, emoji: '💛', text: 'Sim, muito' },
              ]}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-cream px-6 pt-3 pb-6 border-t border-sand/60">
          <button
            type="button"
            onClick={handleContinue}
            disabled={!isComplete}
            className={`w-full py-4 rounded-[18px] font-body text-[15px] font-medium tracking-wide transition-all ${
              isComplete ? 'text-primary-foreground' : 'text-bark'
            }`}
            style={
              isComplete
                ? {
                    background: 'linear-gradient(135deg, hsl(var(--rose)), hsl(var(--rose-lt)))',
                    boxShadow: '0 8px 24px rgba(232,87,74,.3)',
                  }
                : { background: 'hsl(var(--sand))' }
            }
          >
            Continuar →
          </button>

          <p className="text-[11.5px] text-muted-foreground text-center mt-2">
            Suas respostas são sigilosas e não compartilhadas.
          </p>
          <p className="text-[10px] text-muted-foreground tracking-wider uppercase text-center mt-2">
            TELA 1B · SAÚDE MENTAL
          </p>
        </div>
      </div>
    </div>
  );
}
