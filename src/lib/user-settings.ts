import { APP_THEME_COLORS } from '@/lib/theme-colors';
import { apiRequest } from '@/lib/api-client';

export type ThemeMode = 'light' | 'dark';

export type UserSettings = {
  theme: ThemeMode;
};

/** 백엔드 enum LIGHT/DARK를 프론트 ThemeMode로 변환한다. */
export function themeFromServer(value: unknown): ThemeMode | null {
  if (value === 'LIGHT') return 'light';
  if (value === 'DARK') return 'dark';
  return null;
}

/** 프론트 ThemeMode를 백엔드 enum으로 변환한다. */
function themeToServer(theme: ThemeMode): 'LIGHT' | 'DARK' {
  return theme === 'light' ? 'LIGHT' : 'DARK';
}

/** 서버에 테마를 저장한다. 로그인한 사용자만 호출해야 한다. */
export async function saveThemeToServer(theme: ThemeMode) {
  await apiRequest<null>('/api/v1/users/me/settings', {
    toError: ({ message }) => new Error(message ?? '테마를 저장하지 못했습니다.'),
  }, {
    method: 'PATCH',
    body: JSON.stringify({ theme: themeToServer(theme) }),
  });
}

/**
 * 서버 테마로 기기 설정을 덮는다(F16).
 * 서버 테마가 null이면 기기 캐시 또는 기본 다크를 유지한다.
 * 관리자 화면에서는 DOM 적용을 건너뛴다(AdminRouteGuard가 라이트를 강제하므로).
 * 적용된 ThemeMode를 반환한다.
 */
export function syncThemeFromServer(serverTheme: 'light' | 'dark' | null | undefined): ThemeMode {
  if (serverTheme && (serverTheme === 'light' || serverTheme === 'dark')) {
    // 관리자 화면의 라이트 강제를 유지한다(F20).
    const isAdmin = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin');
    if (!isAdmin) {
      applyThemeMode(serverTheme);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({ theme: serverTheme }));
    }
    return serverTheme;
  }
  return loadUserSettings().theme;
}

const USER_SETTINGS_KEY = 'gamerin_user_settings';

export const defaultUserSettings: UserSettings = {
  theme: 'dark',
};

export function loadUserSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return { ...defaultUserSettings };
  }

  try {
    const stored = window.localStorage.getItem(USER_SETTINGS_KEY);
    if (!stored) {
      return { ...defaultUserSettings };
    }

    const parsed = JSON.parse(stored) as { theme?: unknown } | null;
    return {
      theme:
        parsed?.theme === 'dark' || parsed?.theme === 'light'
          ? parsed.theme
          : defaultUserSettings.theme,
    };
  } catch {
    return { ...defaultUserSettings };
  }
}

export function applyThemeMode(theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.classList.toggle('dark', theme === 'dark');
  // 설치형 웹앱의 제목 표시줄·상태 표시줄 색을 바탕(canvas)에 맞춘다.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_THEME_COLORS[theme]);
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
  applyThemeMode(settings.theme);
}
