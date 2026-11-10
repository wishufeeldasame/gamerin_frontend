'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { useToast } from '@/app/context/ToastContext';
import { type ThemeMode, loadUserSettings, saveThemeToServer, saveUserSettings } from '@/lib/user-settings';

const THEME_CHANGED_EVENT = 'gamerin:theme-changed';
// 훅 인스턴스(모바일 메뉴·데스크톱 계정 메뉴)가 함께 쓰는 저장 중 표시. 요청이 겹쳐 순서가 뒤바뀌지 않게 한다.
let saving = false;

// 모바일 메뉴와 데스크톱 계정 메뉴가 함께 쓰는 테마 전환. 화면에는 바로 적용하고 로그인 상태면 서버에도 저장한다.
export function useThemeToggle() {
  const { user } = useAuth();
  const toast = useToast();
  const [theme, setTheme] = useState<ThemeMode>(() => loadUserSettings().theme);

  // 다른 메뉴에서 바꾼 테마를 따라간다.
  useEffect(() => {
    const sync = () => setTheme(loadUserSettings().theme);
    window.addEventListener(THEME_CHANGED_EVENT, sync);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, sync);
  }, []);

  const toggle = async () => {
    if (saving) return;
    const next: ThemeMode = loadUserSettings().theme === 'dark' ? 'light' : 'dark';
    saveUserSettings({ theme: next });
    window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
    if (!user) return;
    saving = true;
    try {
      await saveThemeToServer(next);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast.error(error instanceof Error ? error.message : '테마를 저장하지 못했습니다.');
    } finally {
      saving = false;
    }
  };

  return { theme, toggle };
}
