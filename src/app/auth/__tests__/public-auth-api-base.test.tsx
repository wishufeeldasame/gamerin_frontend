import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const auth = vi.hoisted(() => ({ logout: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams('token=reset-token'),
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));

import FindIdPage from '@/app/find-id/page';
import ForgotPasswordPage from '@/app/auth/forgot-password/page';
import ResetPasswordPage from '@/app/auth/reset-password/page';

const jsdom = (globalThis as unknown as { jsdom: { reconfigure: (options: { url: string }) => void } }).jsdom;

function applyConfig(pageUrl: string, apiBaseUrl: string | undefined) {
  jsdom.reconfigure({ url: pageUrl });
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', apiBaseUrl);
}

const configs = [
  { name: 'Docker/nginx(빈 빌드 인자)', pageUrl: 'https://gamerin.test/', apiBaseUrl: '', base: '' },
  { name: '로컬 개발 localhost:3000', pageUrl: 'http://localhost:3000/', apiBaseUrl: undefined, base: 'http://localhost:8080' },
  { name: '로컬 개발 127.0.0.1:3000', pageUrl: 'http://127.0.0.1:3000/', apiBaseUrl: undefined, base: 'http://127.0.0.1:8080' },
  { name: '명시적 API 주소', pageUrl: 'https://gamerin.test/', apiBaseUrl: ' https://api.gamerin.test/ ', base: 'https://api.gamerin.test' },
];

const pages: {
  name: string;
  element: ReactElement;
  path: string;
  body: unknown;
  submit: () => void;
}[] = [
  {
    name: '아이디 찾기',
    element: <FindIdPage />,
    path: '/api/v1/auth/find-id',
    body: { email: 'user@gamerin.test' },
    submit: () => {
      fireEvent.change(screen.getByPlaceholderText('이메일 입력'), { target: { value: 'user@gamerin.test' } });
    },
  },
  {
    name: '비밀번호 찾기',
    element: <ForgotPasswordPage />,
    path: '/api/v1/auth/find-password',
    body: { handle: 'demo01' },
    submit: () => {
      fireEvent.change(screen.getByPlaceholderText('아이디 입력'), { target: { value: 'demo01' } });
    },
  },
  {
    name: '비밀번호 재설정',
    element: <ResetPasswordPage />,
    path: '/api/v1/auth/reset-password',
    body: { resetToken: 'reset-token', newPassword: 'abcd123!', newPasswordConfirm: 'abcd123!' },
    submit: () => {
      fireEvent.change(screen.getByPlaceholderText('새 비밀번호'), { target: { value: 'abcd123!' } });
      fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), { target: { value: 'abcd123!' } });
    },
  },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ success: true, data: { maskedHandle: 'de***1', createdAt: '2026-09-23' } }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )));
});

afterEach(() => {
  vi.unstubAllEnvs();
  jsdom.reconfigure({ url: 'http://localhost:3000/' });
});

describe('공개 인증 화면의 API 주소', () => {
  describe.each(pages)('$name', ({ element, path, body, submit }) => {
    it.each(configs)('$name: 제출 시점의 설정으로 요청한다', async ({ pageUrl, apiBaseUrl, base }) => {
      // 렌더 시점과 다른 설정으로 바꾼 뒤 제출해, 주소를 요청할 때 계산하는지 확인한다.
      applyConfig('http://localhost:3000/', 'https://render-time.test');
      const { container } = render(element);
      applyConfig(pageUrl, apiBaseUrl);

      submit();
      fireEvent.submit(container.querySelector('form')!);

      await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      const [url, init] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(`${base}${path}`);
      expect(init).toMatchObject({ method: 'POST' });
      expect(JSON.parse(String(init?.body))).toEqual(body);
    });
  });

  it('아이디 찾기 성공 시 maskedHandle과 createdAt을 결과 화면으로 넘긴다', async () => {
    const { container } = render(<FindIdPage />);
    pages[0].submit();
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(router.push).toHaveBeenCalledWith(
      '/find-id-result?maskedHandle=de***1&createdAt=2026-09-23',
    ));
  });
});
