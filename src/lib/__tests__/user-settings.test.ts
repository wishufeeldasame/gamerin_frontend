import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadUserSettings,
  saveUserSettings,
} from '@/lib/user-settings';

describe('user settings', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('returns the default theme when the stored JSON is malformed', () => {
    window.localStorage.setItem('gamerin_user_settings', '{invalid-json');

    expect(loadUserSettings()).toEqual({ theme: 'dark' });
  });

  it('ignores an unsupported stored theme', () => {
    window.localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme: 'system' }));

    expect(loadUserSettings()).toEqual({ theme: 'dark' });
  });

  it('stores and applies the selected theme', () => {
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    document.head.append(themeColor);
    saveUserSettings({ theme: 'dark' });

    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"dark"}');
    expect(document.documentElement).toHaveClass('dark');
    expect(themeColor.content).toBe('#19191D');
    expect(loadUserSettings()).toEqual({ theme: 'dark' });

    saveUserSettings({ theme: 'light' });
    expect(document.documentElement).not.toHaveClass('dark');
    expect(themeColor.content).toBe('#FAFAFA');
    themeColor.remove();
  });
});
