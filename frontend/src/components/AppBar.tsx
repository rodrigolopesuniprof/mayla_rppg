import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppBarProps {
  showBack?: boolean;
  dark?: boolean;
  rightIcon?: React.ReactNode;
}

const LIGHT_LOGO_CANDIDATES = [
  '/logo-mayla-dark.png',
  '/Logo%20Mayla.png',
  '/Logo%20Mayla%20VER%2002.png',
];

const DARK_LOGO_CANDIDATES = [
  '/logo-mayla-white.png',
  '/Logo%20Mayla%20Branca.png',
  '/Logo%20Mayla%20VER%20Branca.png',
];

function MaylaLogo({ dark }: { dark?: boolean }) {
  const candidates = useMemo(() => (dark ? DARK_LOGO_CANDIDATES : LIGHT_LOGO_CANDIDATES), [dark]);
  const [idx, setIdx] = useState(0);

  const src = candidates[idx] ?? null;

  if (!src) {
    return (
      <div className={dark ? 'text-white font-display text-lg' : 'text-ink font-display text-lg'}>
        Mayla Saúde
      </div>
    );
  }

  return (
    <img
      src={src}
      alt="Mayla Saúde"
      className="h-8 w-auto object-contain"
      onError={() => setIdx((v) => v + 1)}
    />
  );
}

const AppBar = ({ showBack, dark, rightIcon }: AppBarProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5 min-h-[72px]">
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className={`w-9 h-9 rounded-full flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-sand'}`}
        >
          <ArrowLeft size={16} className={dark ? 'text-white' : 'text-bark'} />
        </button>
      ) : (
        <MaylaLogo dark={dark} />
      )}
      {!showBack && !rightIcon && <div />}
      {showBack && <MaylaLogo dark={dark} />}
      {rightIcon || <div />}
    </div>
  );
};

export default AppBar;
export { MaylaLogo };