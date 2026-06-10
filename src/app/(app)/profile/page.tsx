'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export default function ProfileRedirectPage() {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();

  useEffect(() => {
    if (!isAuthReady) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    router.replace(`/profile/${encodeURIComponent(user.handle || user.id)}`);
  }, [isAuthReady, router, user]);

  return null;
}
