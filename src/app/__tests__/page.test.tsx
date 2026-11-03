import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
const auth = vi.hoisted(() => ({
  isAuthReady: false,
  user: null as { id: string } | null,
  isSessionUnavailable: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));

import RootPage from '../page';

describe('RootPage', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    auth.isAuthReady = false;
    auth.user = null;
    auth.isSessionUnavailable = false;
  });

  it('waits for authentication restoration before navigating', async () => {
    const { rerender } = render(<RootPage />);
    expect(navigation.replace).not.toHaveBeenCalled();

    auth.isAuthReady = true;
    rerender(<RootPage />);
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
  });

  it('sends authenticated users to home', async () => {
    auth.isAuthReady = true;
    auth.user = { id: 'user-1' };
    render(<RootPage />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/home'));
  });

  it('sends signed-out users to login', async () => {
    auth.isAuthReady = true;
    render(<RootPage />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/login'));
  });

  it('세션을 일시 장애로 확인하지 못했으면 로그인 화면이 아닌 /home의 재시도 안내로 보낸다', async () => {
    auth.isAuthReady = true;
    auth.isSessionUnavailable = true;
    render(<RootPage />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/home'));
    expect(navigation.replace).not.toHaveBeenCalledWith('/login');
  });
});
