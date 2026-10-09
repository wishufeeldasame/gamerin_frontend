import { fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
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
vi.mock('@/lib/auth-store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-store')>()),
  logoutAuthSession: vi.fn(async () => undefined),
  waitForLogoutCompletion: vi.fn(async () => undefined),
}));

import LoginPage from '@/app/login/page';
import OAuthSuccessPage from '@/app/auth/oauth-success/page';
import SocialCompletePage from '@/app/auth/social/complete/page';

const jsdom = (globalThis as unknown as { jsdom: { reconfigure: (options: { url: string }) => void } }).jsdom;
const API = 'https://api.gamerin.test';
const SIGNUP_ID_PLACEHOLDER = '아이디 (영문 소문자, 숫자, _ 사용 가능)';
const SIGNUP_PW_PLACEHOLDER = '비밀번호 (8~20자, 영문·숫자·특수문자 포함)';

function openSignupStep2() {
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '데모' } });
  fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'demo@gamerin.test' } });
  fireEvent.submit(screen.getByPlaceholderText('이메일').closest('form')!);
}

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

  it('회원가입은 생년월일 없이 다음 단계로 가고 요청 시점의 API 주소로 보낸다', async () => {
    render(<LoginPage />);
    applyRequestTimeApi();

    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '데모' } });
    fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'demo@gamerin.test' } });
    expect(screen.queryByText('생년월일')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    fireEvent.change(screen.getByPlaceholderText(SIGNUP_ID_PLACEHOLDER), { target: { value: 'demo01' } });
    fireEvent.change(screen.getByPlaceholderText(SIGNUP_PW_PLACEHOLDER), { target: { value: 'abcd123!' } });
    fireEvent.change(screen.getByPlaceholderText('비밀번호 확인'), { target: { value: 'abcd123!' } });
    fireEvent.click(screen.getByRole('button', { name: '가입 완료' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`${API}/api/v1/auth/signup`, expect.anything()));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toEqual({
      handle: 'demo01',
      nickname: '데모',
      email: 'demo@gamerin.test',
      password: 'abcd123!',
      passwordConfirm: 'abcd123!',
      agreedToTerms: true,
      agreedToPrivacy: true,
    });
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

  it('로그인은 Enter(폼 제출)로 보내고 자동 완성 속성을 가진다', async () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: /ID로 로그인/ }));

    const handle = screen.getByPlaceholderText('아이디');
    const password = screen.getByPlaceholderText('비밀번호');
    expect(handle).toHaveAttribute('autocomplete', 'username');
    expect(password).toHaveAttribute('autocomplete', 'current-password');

    fireEvent.change(handle, { target: { value: 'demo01' } });
    fireEvent.change(password, { target: { value: 'pw' } });
    fireEvent.submit(handle.closest('form')!);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/v1/auth/login'), expect.anything()));
  });

  it('회원가입 1단계는 이름 길이와 이메일 형식을 안내하고 다음 단계를 막는다', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: '회원가입' }));

    fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '데' } });
    fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'demo' } });

    expect(screen.getByText('닉네임은 2~20자로 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByText('올바른 이메일 형식으로 입력해주세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.getByPlaceholderText('이름')).toHaveAttribute('maxlength', '20');
  });

  it('회원가입 2단계는 대문자 아이디와 약한 비밀번호를 안내하고 제출을 막는다', () => {
    render(<LoginPage />);
    openSignupStep2();

    fireEvent.change(screen.getByPlaceholderText(SIGNUP_ID_PLACEHOLDER), { target: { value: 'Demo01' } });
    fireEvent.change(screen.getByPlaceholderText(SIGNUP_PW_PLACEHOLDER), { target: { value: 'abcdefgh1' } });
    fireEvent.change(screen.getByPlaceholderText('비밀번호 확인'), { target: { value: 'abcdefgh1' } });

    expect(screen.getByText('아이디는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByText('비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(SIGNUP_PW_PLACEHOLDER)).toHaveAttribute('maxlength', '20');

    fireEvent.submit(screen.getByPlaceholderText(SIGNUP_ID_PLACEHOLDER).closest('form')!);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('소셜 회원가입 완료는 규칙을 어긴 아이디를 제출 전에 막는다', () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/auth/social/complete#signupToken=signup-token' });
    render(<SocialCompletePage />);

    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '데모' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입 완료' }));

    expect(screen.getByText('아이디는 3~20자로 입력해주세요.')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('소셜 회원가입 완료는 /me로 확정한 사용자로 로그인하고 홈으로 이동한다', async () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/auth/social/complete#signupToken=signup-token' });
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('/api/v1/auth/social-signup')
        ? json(200, { success: true, data: { userId: 'user-id', handle: 'x', nickname: 'x', accessToken: 'token-s' } })
        : json(200, { success: true, data: { userId: 'user-id', handle: 'demo_01', nickname: '데모', role: 'USER', status: 'ACTIVE' } }));
    render(<SocialCompletePage />);

    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'demo_01' } });
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '데모' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입 완료' }));

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/home'));
    expect(auth.login).toHaveBeenCalledWith(expect.objectContaining({
      id: 'user-id', handle: 'demo_01', role: 'USER', status: 'ACTIVE', gameTier: 'Unranked',
    }));
  });

  it('소셜 회원가입은 성공했지만 로그인 확인에 실패하면 재제출 대신 로그인 화면으로 안내한다', async () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/auth/social/complete#signupToken=signup-token' });
    vi.mocked(fetch).mockImplementation(async (url) =>
      String(url).endsWith('/api/v1/auth/social-signup')
        ? json(200, { success: true, data: { userId: 'user-id', accessToken: 'token-s' } })
        : json(503, { success: false, message: 'unavailable' }));
    render(<SocialCompletePage />);

    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'demo_01' } });
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '데모' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입 완료' }));

    expect(await screen.findByText(/가입은 완료되었지만 로그인 확인에 실패했습니다/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '회원가입 완료' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인 화면으로 이동' })).toHaveAttribute('href', '/login');
    expect(auth.login).not.toHaveBeenCalled();
  });
});
