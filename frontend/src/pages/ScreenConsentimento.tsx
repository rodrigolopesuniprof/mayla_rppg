import { useNavigate } from 'react-router-dom';
import AppBar from '../components/AppBar';
import { Check } from 'lucide-react';

const consentItems = [
  {
    icon: '🔒',
    title: 'Imagem não armazenada',
    desc: 'nenhuma foto ou vídeo é salvo no servidor.',
  },
  {
    icon: '📊',
    title: 'Só dados numéricos',
    desc: 'BPM, respiração, HRV e estresse são registrados.',
  },
  {
    icon: '⏱️',
    title: 'Leva 25 segundos',
    desc: 'mantenha o rosto enquadrado e imóvel na câmera.',
  },
];

export default function ScreenConsentimento() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <AppBar showBack />

      <div className="flex-1 px-5 pb-5 flex flex-col justify-between">
        <div>
          <div
            className="w-[52px] h-[52px] rounded-full flex items-center justify-center mb-2.5 text-[22px]"
            style={{ background: 'linear-gradient(135deg, #FDE8E5, #FCEBD5)' }}
          >
            📷
          </div>

          <h2 className="font-display text-[19px] font-medium text-ink leading-tight mb-1.5">
            Antes de <em className="text-rose italic">iniciar</em>
            <br />a leitura
          </h2>
          <p className="text-[11.5px] text-muted-foreground leading-relaxed mb-3">
            Vamos usar a câmera frontal para medir seus sinais vitais de forma não-invasiva. O processo leva apenas 25
            segundos.
          </p>

          <div className="flex flex-col gap-1.5 mb-3">
            {consentItems.map((item, i) => (
              <div key={i} className="bg-sand rounded-[14px] p-2.5 px-3 flex items-center gap-2.5">
                <span className="text-base flex-shrink-0">{item.icon}</span>
                <p className="text-[11.5px] text-bark leading-snug">
                  <strong className="font-semibold text-ink text-xs">{item.title}</strong> — {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2.5 mb-3">
            <div className="w-5 h-5 rounded bg-mayla-green flex items-center justify-center mt-0.5">
              <Check size={12} className="text-primary-foreground" />
            </div>
            <p className="text-[11.5px] text-bark leading-snug">
              <strong className="text-ink">Ao continuar</strong>, você concorda com nossa política de privacidade.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-[11px] text-rose font-medium underline underline-offset-2 cursor-pointer">
              Política de Privacidade
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-[11px] text-rose font-medium underline underline-offset-2 cursor-pointer">
              Termo de Consentimento
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="text-[11px] text-rose font-medium underline underline-offset-2 cursor-pointer">
              Termos de Uso
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/camera')}
            className="w-full py-4 rounded-[18px] text-primary-foreground font-body text-[15px] font-medium"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--rose)), hsl(var(--rose-lt)))',
              boxShadow: '0 8px 24px rgba(232,87,74,.3)',
            }}
          >
            Permitir câmera e iniciar
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 rounded-[18px] bg-sand text-bark font-body text-[14px] font-medium"
          >
            Pular para o aplicativo
          </button>
        </div>
      </div>
    </div>
  );
}
