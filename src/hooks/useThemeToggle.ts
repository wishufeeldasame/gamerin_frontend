'use client';

import { useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useToast } from '@/app/context/ToastContext';
import { type ThemeMode, loadUserSettings, saveThemeToServer, saveUserSettings } from '@/lib/user-settings';

// 모바일 메뉴와 데스크톱 계정 메뉴가 함께 쓰는 테마 전환. 화면에는 바로 적용하고 로그인 상태면 서버에도 저장한다.
export function useThemeToggle() {
  const { user } = useAuth();
  const toast = useToast();
  const [theme, setTheme] = useState<ThemeMode>(() => loadUserSettings().theme);

  const toggle = async () => {
    // 다른 곳에서 바뀐 값을 놓치지 않게 저장된 현재 값을 기준으로 뒤집는다.
    const next: ThemeMode = loadUserSettings().theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    saveUserSettings({ theme: next });
    if (!user) return;
    try {
      await saveThemeToServer(next);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '테마를 저장하지 못했습니다.');
    }
  };

  return { theme, toggle };
}
