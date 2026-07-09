export type ThemeMode = 'light' | 'dark';
export type LanguageCode = 'ko' | 'en' | 'ja' | 'zh';

export type AccountSettings = {
  email: string;
  username: string;
  displayName: string;
  phone: string;
};

export type PrivacySettings = {
  profilePublic: boolean;
  showEmail: boolean;
  showStats: boolean;
  allowMessages: boolean;
};

export type NotificationSettings = {
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  messages: boolean;
};

export type UserSettings = {
  account: AccountSettings;
  privacy: PrivacySettings;
  notifications: NotificationSettings;
  theme: ThemeMode;
  language: LanguageCode;
};

export const USER_SETTINGS_CHANGED_EVENT = 'gamerin:user-settings-changed';

const USER_SETTINGS_KEY = 'gamerin_user_settings';
const THEME_KEY = 'gamerin_theme';

export const defaultUserSettings: UserSettings = {
  account: {
    email: 'user@gamerin.com',
    username: '@user123',
    displayName: 'GamerIN User',
    phone: '+82 10-1234-5678',
  },
  privacy: {
    profilePublic: true,
    showEmail: false,
    showStats: true,
    allowMessages: true,
  },
  notifications: {
    likes: true,
    comments: true,
    follows: true,
    mentions: true,
    messages: true,
  },
  theme: 'light',
  language: 'ko',
};

function mergeSettings(value: Partial<UserSettings> | null): UserSettings {
  return {
    ...defaultUserSettings,
    ...value,
    account: {
      ...defaultUserSettings.account,
      ...value?.account,
    },
    privacy: {
      ...defaultUserSettings.privacy,
      ...value?.privacy,
    },
    notifications: {
      ...defaultUserSettings.notifications,
      ...value?.notifications,
    },
  };
}

export function loadUserSettings(): UserSettings {
  if (typeof window === 'undefined') {
    return defaultUserSettings;
  }

  const stored = window.localStorage.getItem(USER_SETTINGS_KEY);
  const parsed = stored ? (JSON.parse(stored) as Partial<UserSettings>) : null;
  const merged = mergeSettings(parsed);
  const storedTheme = window.localStorage.getItem(THEME_KEY);

  if (storedTheme === 'dark' || storedTheme === 'light') {
    merged.theme = storedTheme;
  }

  return merged;
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
  window.localStorage.setItem(THEME_KEY, settings.theme);
  applyThemeMode(settings.theme);
  window.dispatchEvent(new Event(USER_SETTINGS_CHANGED_EVENT));
}
