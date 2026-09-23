import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@/test/fetch-routes';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const auth = vi.hoisted(() => ({ user: null, isAuthReady: true, isLoggingOut: false, login: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/lib/auth-store', () => ({
  logoutAuthSession: vi.fn(async () => undefined),
  setAccessToken: vi.fn(),
  waitForLogoutCompletion: vi.fn(async () => undefined),
}));

import LoginPage from '@/app/login/page';
import OAuthSuccessPage from '@/app/auth/oauth-success/page';
import SocialCompletePage from '@/app/auth/social/complete/page';

const jsdom = (globalThis as unknown as { jsdom: { reconfigure: (options: { url: string }) => void } }).jsdom;
const API = 'https://api.gamerin.test';

// 모듈을 불러온 뒤에 설정을 바꿔, 주소를 모듈 로드 시점이 아니라 요청할 때 계산하는지 확인한다.
function applyRequestTimeApi() {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', ` ${API}/ `);
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => json(401, { success: false, message: 'denied' })));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.stubGlobal('alert', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  jsdom.reconfigure({ url: 'http://localhost:3000/' });
});

describe('인증 흐름 화면의 API 주소', () => {
  it('로그인은 요청 시점의 API 주소로 보낸다', async () => {
    render(<LoginPage />);
    applyRequestTimeApi();

    fireEvent.click(screen.getByRole('button', { name: /ID로 로그인/ }));
    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'demo01' } });
    fireEvent.change(screen.getByPlaceholderText('비밀번호'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`${API}/api/v1/auth/login`, expect.anything()));
  });

  it('OAuth 성공 화면은 마운트 시점의 API 주소로 refresh한다', async () => {
    applyRequestTimeApi();
    render(<OAuthSuccessPage />);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`${API}/api/v1/auth/refresh`, expect.anything()));
  });

  it('소셜 회원가입 완료는 요청 시점의 API 주소로 보낸다', async () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/auth/social/complete#signupToken=signup-token' });
    render(<SocialCompletePage />);
    applyRequestTimeApi();

    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'demo_01' } });
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '데모' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입 완료' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`${API}/api/v1/auth/social-signup`, expect.anything()));
  });
});
