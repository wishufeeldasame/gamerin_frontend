import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from '@/test/fetch-routes';

const saveThemeToServer = vi.hoisted(() => vi.fn());
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/app/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn() }) }));
vi.mock('@/lib/user-settings', async (original) => ({ ...(await original<typeof import('@/lib/user-settings')>()), saveThemeToServer }));

import { useThemeToggle } from '../useThemeToggle';

describe('useThemeToggle', () => {
  beforeEach(() => {
    saveThemeToServer.mockReset();
    window.localStorage.setItem('gamerin_user_settings', '{"theme":"light"}');
  });

  it('저장 중 다시 누르면 무시하고, 다른 인스턴스도 바뀐 테마를 따라간다', async () => {
    const pending = deferred<void>();
    saveThemeToServer.mockReturnValue(pending.promise);
    const first = renderHook(() => useThemeToggle());
    const second = renderHook(() => useThemeToggle());

    act(() => { void first.result.current.toggle(); });
    expect(first.result.current.theme).toBe('dark');
    expect(second.result.current.theme).toBe('dark');

    act(() => { void second.result.current.toggle(); });
    expect(saveThemeToServer).toHaveBeenCalledTimes(1);
    expect(second.result.current.theme).toBe('dark');

    await act(async () => pending.resolve());
    saveThemeToServer.mockResolvedValue(undefined);
    await act(async () => { await second.result.current.toggle(); });
    expect(saveThemeToServer).toHaveBeenLastCalledWith('light');
    expect(first.result.current.theme).toBe('light');
  });
});
