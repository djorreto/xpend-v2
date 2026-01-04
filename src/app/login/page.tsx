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
  const [creatingUser, setCreatingUser] = useState(false);

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

    console.log('Intentando hacer login con:', email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Resultado del login:', { data, error });

      if (error) {
        console.error('Error en login:', error);
        setError(`Error: ${error.message}`);
        return;
      }

      if (data.user) {
        console.log('Login exitoso, redirigiendo al dashboard...');
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

  const createTestUser = async () => {
    setCreatingUser(true);
    setError(null);

    try {
      console.log('Creando usuario de prueba...');

      const { data, error } = await supabase.auth.signUp({
        email: 'test@xpend.cl',
        password: 'test123456',
        options: {
          data: {
            full_name: 'Usuario de Prueba',
            role: 'admin'
          }
        }
      });

      if (error) {
        console.error('Error creando usuario:', error);
        setError(`Error: ${error.message}`);
      } else {
        console.log('Usuario creado exitosamente:', data);
        setEmail('test@xpend.cl');
        setPassword('test123456');
        setError('Usuario de prueba creado. Puedes hacer login con test@xpend.cl / test123456');
      }
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Error inesperado al crear usuario');
    } finally {
      setCreatingUser(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="xl" variant="default" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <h1 className="text-2xl font-semibold text-center">Iniciar sesión</h1>

          <input
            type="email"
            className="w-full border rounded p-2"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
          />

          <input
            type="password"
            className="w-full border rounded p-2"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white rounded p-2"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <p className="text-sm text-center">
            <a href="/reset-password" className="underline">¿Olvidaste tu contraseña?</a>
          </p>

          {/* Botón temporal para crear usuario de prueba */}
          <button
            type="button"
            onClick={createTestUser}
            disabled={creatingUser}
            className="w-full bg-blue-500 text-white rounded p-2 text-sm"
          >
            {creatingUser ? 'Creando...' : 'Crear Usuario de Prueba'}
          </button>

          <p className="text-sm text-center">
            ¿Aún no tienes cuenta? <a href="/signup" className="underline">Crear cuenta</a>
          </p>
        </form>
      </div>
    </div>
  );
}
