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

    expect(loadUserSettings()).toEqual({ theme: 'light' });
  });

  it('ignores an unsupported stored theme', () => {
    window.localStorage.setItem('gamerin_user_settings', JSON.stringify({ theme: 'system' }));

    expect(loadUserSettings()).toEqual({ theme: 'light' });
  });

  it('stores and applies the selected theme', () => {
    saveUserSettings({ theme: 'dark' });

    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"dark"}');
    expect(document.documentElement).toHaveClass('dark');
    expect(loadUserSettings()).toEqual({ theme: 'dark' });

    saveUserSettings({ theme: 'light' });
    expect(document.documentElement).not.toHaveClass('dark');
  });
});
