import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  user: null,
  isAuthReady: true,
  isLoggingOut: false,
  login: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));
vi.mock('@/lib/auth-store', () => ({
  logoutAuthSession: vi.fn(),
  setAccessToken: vi.fn(),
  waitForLogoutCompletion: vi.fn(),
}));

import LoginPage from '../page';

describe('LoginPage', () => {
  it('shows the development warning banner', () => {
    render(<LoginPage />);

    expect(
      screen.getByText('GamerIN은 현재 개발 단계입니다. 이용 중 오류나 데이터 변경이 발생할 수 있습니다.'),
    ).toBeInTheDocument();
  });
});
