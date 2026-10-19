import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { json } from '@/test/fetch-routes';

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
  vi.stubGlobal('fetch', vi.fn(async () =>
    json(200, { success: true, data: { maskedHandle: 'de***1', createdAt: '2026-09-23' } })));
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

  it.each([
    {
      name: '비밀번호 찾기',
      element: <ForgotPasswordPage />,
      submit: pages[1].submit,
      fallback: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    },
    {
      name: '비밀번호 재설정',
      element: <ResetPasswordPage />,
      submit: pages[2].submit,
      fallback: '비밀번호 변경에 실패했습니다.',
    },
  ])('$name 네트워크 TypeError는 영어 원문 대신 한국어 오류를 안내한다', async ({ element, submit, fallback }) => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { container } = render(element);

    submit();
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText(fallback)).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it.each([
    { name: '비밀번호 찾기', element: <ForgotPasswordPage />, submit: pages[1].submit },
    { name: '비밀번호 재설정', element: <ResetPasswordPage />, submit: pages[2].submit },
  ])('$name 거절은 한국어 fallback보다 서버 message를 우선 안내한다', async ({ element, submit }) => {
    vi.mocked(fetch).mockResolvedValueOnce(json(400, { success: false, message: '서버가 전한 오류입니다.' }));
    const { container } = render(element);

    submit();
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('서버가 전한 오류입니다.')).toBeInTheDocument();
  });

  it('비밀번호 재설정은 규칙을 어긴 비밀번호를 제출 전에 막는다', () => {
    const { container } = render(<ResetPasswordPage />);
    const password = screen.getByPlaceholderText('새 비밀번호');

    expect(password).toHaveAttribute('maxlength', '20');
    fireEvent.change(password, { target: { value: 'abcdefgh1' } });
    fireEvent.change(screen.getByPlaceholderText('새 비밀번호 확인'), { target: { value: 'abcdefgh1' } });
    fireEvent.submit(container.querySelector('form')!);

    expect(screen.getAllByText('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.').length).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
