'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { Logo } from '@/components/ui/logo';

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, redirige al dashboard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled && user) router.replace('/dashboard');
    })();
    return () => { cancelled = true; };
  }, [router, supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        router.replace('/dashboard');
      } else {
        setError('No se pudo obtener información del usuario');
      }
    } catch (err) {
      console.error('Error inesperado:', err);
      setError(err instanceof Error ? err.message : 'Error inesperado al hacer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-canvas relative flex min-h-screen items-center justify-center overflow-hidden p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-10 top-10 h-72 w-72 rounded-full bg-accent-mint/45 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent-turquoise/35 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-56 w-56 rounded-full bg-accent-lime/25 blur-3xl" />
      </div>

      <div className="glass-card relative w-full max-w-sm p-8">
        <div className="mb-6 flex justify-center">
          <Logo size="xl" variant="default" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="mb-5 text-center">
            <h1 className="text-lg font-medium tracking-tight text-petrol-blue">Iniciar sesión</h1>
            <p className="mt-1 text-xs text-petrol-blue/75">Entra a tu espacio de procurement</p>
          </div>

          <input
            type="email"
            className="w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-[13px] text-petrol-blue shadow-sm outline-none transition-all duration-200 placeholder:text-petrol-blue/35 focus:border-accent-turquoise/50 focus:ring-2 focus:ring-accent-turquoise/25"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />

          <input
            type="password"
            className="w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-[13px] text-petrol-blue shadow-sm outline-none transition-all duration-200 placeholder:text-petrol-blue/35 focus:border-accent-turquoise/50 focus:ring-2 focus:ring-accent-turquoise/25"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl bg-accent-mint px-3 py-2 text-[13px] font-medium text-petrol-blue shadow-sm shadow-accent-mint/40 transition-all duration-200 hover:-translate-y-px hover:bg-accent-mint/85 disabled:opacity-60"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <p className="pt-2 text-center text-xs text-petrol-blue/75">
            <a href="/reset-password" className="transition-colors hover:text-petrol-blue">¿Olvidaste tu contraseña?</a>
          </p>

          <p className="text-center text-xs text-petrol-blue/75">
            ¿Aún no tienes cuenta? <a href="/signup" className="font-medium text-petrol-blue hover:text-accent-turquoise">Crear cuenta</a>
          </p>
        </form>
      </div>
    </div>
  );
}
