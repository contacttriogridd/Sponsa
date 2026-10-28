'use client';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth-context';
import { registerServiceWorker } from '@/lib/push-client';
import { SplashScreen } from '@/components/layout/SplashScreen';
import { Toaster } from '@/components/ui/sonner';
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => { registerServiceWorker(); }, []);
  return <AuthProvider><SplashScreen />{children}<Toaster position="top-center" richColors /></AuthProvider>;
}
