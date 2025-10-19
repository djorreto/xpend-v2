'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/ui/loading';

export default function HomePage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          // Usuario autenticado, ir al dashboard
          router.replace('/dashboard');
        } else {
          // Usuario no autenticado, ir a la landing page
          router.replace('/home');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        // En caso de error, ir a la landing page
        router.replace('/home');
      }
    };

    checkAuth();
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}