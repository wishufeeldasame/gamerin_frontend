'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, isAuthReady, isSessionUnavailable } = useAuth();

  useEffect(() => {
    if (!isAuthReady) return;
    // 세션을 일시 장애로 확인하지 못했으면 /home의 재시도 안내로 보낸다.
    router.replace(user || isSessionUnavailable ? '/home' : '/login');
  }, [isAuthReady, isSessionUnavailable, router, user]);

  return null;
}
