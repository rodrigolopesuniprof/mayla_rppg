import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppBarProps {
  showBack?: boolean;
  dark?: boolean;
  rightIcon?: React.ReactNode;
}

const MaylaLogo = ({ dark }: { dark?: boolean }) => (
  // Logos oficiais: coloque os PNGs em frontend/public com estes nomes.
  // (Neste ambiente, não consigo materializar binários PNG diretamente em src/assets via código.)
  <img
    src={dark ? '/logo-mayla-white.png' : '/logo-mayla-dark.png'}
    alt="Mayla Saúde"
    className="h-8 w-auto object-contain"
  />
);

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