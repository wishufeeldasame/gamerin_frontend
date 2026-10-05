'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();

  useEffect(() => {
    if (!isAuthReady) return;
    router.replace(user ? '/home' : '/login');
  }, [isAuthReady, router, user]);

  return null;
}
