'use client';

import { useCallback } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { requestLogin, type LoginPromptRequest } from '@/lib/login-prompt';

/** 편집·개인 조회·낙관적 변경보다 먼저 호출한다. 대기 중 작업은 저장하지 않는다. */
export function useRequireAuth() {
  const { user, isAuthReady, isSessionUnavailable, isAccountBlocked, isLoggingOut } = useAuth();
  return useCallback((message?: string, options: Omit<LoginPromptRequest, 'message'> = {}) => {
    if (isLoggingOut) return false;
    if (user) return true;
    if (isAuthReady !== false && !isSessionUnavailable && !isAccountBlocked) requestLogin({ message, ...options });
    return false;
  }, [user, isAuthReady, isSessionUnavailable, isAccountBlocked, isLoggingOut]);
}
