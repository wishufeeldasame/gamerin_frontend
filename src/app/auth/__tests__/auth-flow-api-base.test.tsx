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

const codeSent = () => json(200, { success: true, data: { expiresInSeconds: 300, resendCooldownSeconds: 60 } });
const codeConfirmed = () => json(200, { success: true, data: { verificationToken: 'verify-token', expiresInSeconds: 1800 } });

function fillSignupStep1() {
  fireEvent.click(screen.getByRole('button', { name: '회원가입' }));
  fireEvent.change(screen.getByPlaceholderText('이름'), { target: { value: '데모' } });
  fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'demo@gamerin.test' } });
}

// 인증번호 발송·확인 응답을 차례로 받아 이메일 인증을 끝낸다.
async function verifySignupEmail() {
  vi.mocked(fetch).mockResolvedValueOnce(codeSent()).mockResolvedValueOnce(codeConfirmed());
  fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
  fireEvent.change(await screen.findByLabelText('인증번호'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: '확인' }));
  await screen.findByText('이메일 인증이 완료되었습니다.');
}

async function openSignupStep2() {
  fillSignupStep1();
  await verifySignupEmail();
  fireEvent.click(screen.getByRole('button', { name: '다음' }));
}

function fillSignupStep2() {
  fireEvent.change(screen.getByPlaceholderText(SIGNUP_ID_PLACEHOLDER), { target: { value: 'demo01' } });
  fireEvent.change(screen.getByPlaceholderText(SIGNUP_PW_PLACEHOLDER), { target: { value: 'abcd123!' } });
  fireEvent.change(screen.getByPlaceholderText('비밀번호 확인'), { target: { value: 'abcd123!' } });
}

const requestBody = (path: string) =>
  JSON.parse(String(vi.mocked(fetch).mock.calls.find(([url]) => String(url).endsWith(path))?.[1]?.body));

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

  it('로그인 네트워크 TypeError는 영어 원문 대신 한국어 오류를 안내한다', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<LoginPage />);

    fireEvent.click(screen.getByRole('button', { name: /ID로 로그인/ }));
    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'demo01' } });
    fireEvent.change(screen.getByPlaceholderText('비밀번호'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByText('로그인에 실패했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });

  it('회원가입은 생년월일 없이 다음 단계로 가고 요청 시점의 API 주소로 보낸다', async () => {
    render(<LoginPage />);
    applyRequestTimeApi();

    fillSignupStep1();
    expect(screen.queryByText('생년월일')).not.toBeInTheDocument();
    await verifySignupEmail();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    fillSignupStep2();
    fireEvent.click(screen.getByRole('button', { name: '가입 완료' }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`${API}/api/v1/auth/signup`, expect.anything()));
    expect(fetch).toHaveBeenCalledWith(`${API}/api/v1/auth/email-verifications`, expect.anything());
    expect(requestBody('/api/v1/auth/email-verifications')).toEqual({ email: 'demo@gamerin.test' });
    expect(requestBody('/api/v1/auth/email-verifications/confirm')).toEqual({ email: 'demo@gamerin.test', code: '123456' });
    expect(requestBody('/api/v1/auth/signup')).toEqual({
      handle: 'demo01',
      nickname: '데모',
      email: 'demo@gamerin.test',
      password: 'abcd123!',
      passwordConfirm: 'abcd123!',
      agreedToTerms: true,
      agreedToPrivacy: true,
      emailVerificationToken: 'verify-token',
    });
  });

  it('회원가입 네트워크 TypeError는 영어 원문 대신 한국어 오류를 안내한다', async () => {
    render(<LoginPage />);
    await openSignupStep2();

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('NetworkError when attempting to fetch resource.'));
    fillSignupStep2();
    fireEvent.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByText('회원가입에 실패했습니다.')).toBeInTheDocument();
    expect(screen.queryByText('NetworkError when attempting to fetch resource.')).not.toBeInTheDocument();
  });

  it('회원가입 거절은 한국어 fallback보다 서버 message를 우선 안내한다', async () => {
    render(<LoginPage />);
    await openSignupStep2();

    vi.mocked(fetch).mockResolvedValueOnce(json(409, { success: false, message: '이미 사용 중인 아이디입니다.' }));
    fillSignupStep2();
    fireEvent.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByText('이미 사용 중인 아이디입니다.')).toBeInTheDocument();
  });

  it('가입이 이메일 인증 만료로 거절되면 1단계로 돌아가 재인증을 안내한다', async () => {
    render(<LoginPage />);
    await openSignupStep2();

    vi.mocked(fetch).mockResolvedValueOnce(json(400, {
      success: false,
      message: '이메일 인증이 만료되었거나 유효하지 않습니다. 이메일 인증을 다시 진행해주세요.',
    }));
    fillSignupStep2();
    fireEvent.click(screen.getByRole('button', { name: '가입 완료' }));

    expect(await screen.findByText(/이메일 인증을 다시 진행해주세요/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('이메일')).toHaveValue('demo@gamerin.test');
    expect(screen.getByRole('button', { name: '인증번호 받기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('이메일 인증 전에는 다음 단계를 막고, 인증 후 이메일을 고치면 인증을 초기화한다', async () => {
    render(<LoginPage />);
    fillSignupStep1();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();

    vi.mocked(fetch).mockResolvedValueOnce(codeSent());
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    expect(await screen.findByRole('button', { name: '재발송 (60초)' })).toBeDisabled();
    expect(screen.getByText('5:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();

    vi.mocked(fetch).mockResolvedValueOnce(codeConfirmed());
    fireEvent.change(screen.getByLabelText('인증번호'), { target: { value: '12a3456' } });
    expect(screen.getByLabelText('인증번호')).toHaveValue('123456');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await screen.findByText('이메일 인증이 완료되었습니다.');
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText('이메일'), { target: { value: 'other@gamerin.test' } });
    expect(screen.queryByText('이메일 인증이 완료되었습니다.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증번호 받기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('인증번호 발송·확인 거절은 서버 message로 안내한다', async () => {
    render(<LoginPage />);
    fillSignupStep1();

    vi.mocked(fetch).mockResolvedValueOnce(json(409, { success: false, message: '이미 사용 중인 이메일입니다.' }));
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    expect(await screen.findByText('이미 사용 중인 이메일입니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();

    vi.mocked(fetch)
      .mockResolvedValueOnce(codeSent())
      .mockResolvedValueOnce(json(400, { success: false, message: '인증번호가 일치하지 않습니다. (남은 횟수: 4회)' }));
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(await screen.findByLabelText('인증번호'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('인증번호가 일치하지 않습니다. (남은 횟수: 4회)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('Google 이메일 미인증으로 돌아오면 로그인 화면에 오류를 안내한다', async () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/login?error=email_not_verified' });
    render(<LoginPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Google 계정의 이메일이 인증되지 않아');
  });

  it('알 수 없는 OAuth 오류 코드(상속 속성 이름 포함)는 무시한다', async () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/login?error=__proto__' });
    render(<LoginPage />);

    expect(await screen.findByRole('button', { name: '회원가입' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

  it('소셜 가입 전 네트워크 TypeError는 재제출 가능한 한국어 오류로 안내한다', async () => {
    jsdom.reconfigure({ url: 'http://localhost:3000/auth/social/complete#signupToken=signup-token' });
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    render(<SocialCompletePage />);

    fireEvent.change(screen.getByPlaceholderText('아이디'), { target: { value: 'demo_01' } });
    fireEvent.change(screen.getByPlaceholderText('닉네임'), { target: { value: '데모' } });
    fireEvent.click(screen.getByRole('button', { name: '회원가입 완료' }));

    expect(await screen.findByText('소셜 회원가입에 실패했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '회원가입 완료' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '로그인 화면으로 이동' })).not.toBeInTheDocument();
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

  it('회원가입 2단계는 대문자 아이디와 약한 비밀번호를 안내하고 제출을 막는다', async () => {
    render(<LoginPage />);
    await openSignupStep2();
    vi.mocked(fetch).mockClear();

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
