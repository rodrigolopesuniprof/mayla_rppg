import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppBar from '../components/AppBar';
import { maylaPatientLogin } from '../utils/maylaApi';

export default function ScreenLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const resp = await maylaPatientLogin({ user: email, password: pass });

      const token = resp?.access_token;
      const cpf = resp?.patient?.cpf;

      if (token) sessionStorage.setItem('mayla:token', token);
      if (cpf) sessionStorage.setItem('mayla:cpf', cpf);

      navigate('/camera');
    } catch (err: any) {
      const raw = err?.message ?? 'Falha no login';
      setErrorMsg(raw);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-[420px] mx-auto flex flex-col min-h-screen">
        <AppBar showBack />
        <div className="flex-1 px-6 pb-7">
          <h1 className="font-display text-[24px] font-medium text-ink mb-1.5">
            Entrar na <em className="text-rose italic">Mayla</em>
          </h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Use seu email e senha de paciente para obter o token.
          </p>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <div className="bg-card rounded-[16px] p-3 shadow-[0_2px_8px_rgba(0,0,0,.05)]">
              <label htmlFor="user" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                id="user"
                name="user"
                type="email"
                required
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-transparent outline-none text-ink placeholder:text-slate-400"
              />
            </div>

            <div className="bg-card rounded-[16px] p-3 shadow-[0_2px_8px_rgba(0,0,0,.05)]">
              <label htmlFor="password" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                className="mt-1 w-full bg-transparent outline-none text-ink placeholder:text-slate-400"
              />
            </div>

            {errorMsg ? <div className="text-[12px] text-rose">{errorMsg}</div> : null}

            <button
              type="submit"
              disabled={submitting || !email || !pass}
              className="w-full py-3 rounded-[18px] text-primary-foreground font-body text-[15px] font-medium tracking-wide disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--rose)), hsl(var(--rose-lt)))',
                boxShadow: '0 8px 24px rgba(232,87,74,.3)',
              }}
            >
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>

            <small className="text-xs text-muted-foreground block">
              Após o login, salvamos o token em sessionStorage: mayla:token e o CPF (se vier da API) em mayla:cpf.
            </small>
          </form>
        </div>
      </div>
    </div>
  );
}