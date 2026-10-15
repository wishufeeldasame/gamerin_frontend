export type ThemeMode = 'light' | 'dark';

export type UserSettings = {
  theme: ThemeMode;
};

const USER_SETTINGS_KEY = 'gamerin_user_settings';

export const defaultUserSettings: UserSettings = {
  theme: 'light',
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
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
  applyThemeMode(settings.theme);
}
