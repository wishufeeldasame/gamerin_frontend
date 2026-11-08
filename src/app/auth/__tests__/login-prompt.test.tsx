import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPromptProvider } from '@/app/auth/_components/LoginPromptProvider';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { requestLogin } from '@/lib/login-prompt';
import type { AuthUser } from '@/lib/auth-api';

const auth = vi.hoisted(() => ({ user: null as AuthUser | null, isAuthReady: true, isLoggingOut: false, isSessionUnavailable: false, isAccountBlocked: false, login: vi.fn() }));
const navigation = vi.hoisted(() => ({ pathname: '/', params: new URLSearchParams(), replace: vi.fn() }));
const loginWithPassword = vi.hoisted(() => vi.fn());
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/auth-api', () => ({ loginWithPassword }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation, usePathname: () => navigation.pathname, useSearchParams: () => navigation.params }));

const member: AuthUser = { id: 'user-1', handle: 'player', name: '플레이어', nickname: '플레이어', gameTier: 'Gold' };

function Action({ mutate }: { mutate: () => void }) {
  const requireAuth = useRequireAuth();
  return <button onClick={() => { if (requireAuth('댓글을 남기려면 로그인이 필요해요.')) mutate(); }}>댓글 작성</button>;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = null; auth.isSessionUnavailable = false; auth.isAccountBlocked = false;
  auth.login.mockImplementation((next: AuthUser) => { auth.user = next; });
  loginWithPassword.mockResolvedValue(member);
  navigation.pathname = '/'; navigation.params = new URLSearchParams();
  window.history.replaceState({}, '', '/'); sessionStorage.clear(); document.body.style.overflow = '';
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('공통 중앙 로그인 모달', () => {
  it('게스트 행동을 쓰기 전에 차단하고, 취소하면 스크롤 잠금과 포커스를 복구한다', async () => {
    const mutate = vi.fn();
    render(<LoginPromptProvider><Action mutate={mutate} /></LoginPromptProvider>);
    const trigger = screen.getByRole('button', { name: '댓글 작성' }); trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: '다시 오신 걸 환영해요' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('m-auto', 'max-w-[440px]', 'w-[calc(100%-2rem)]');
    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: '아이디' })).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    act(() => requestLogin());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe(''); expect(trigger).toHaveFocus();
  });

  it('Tab·Shift+Tab을 모달 안에 유지한다', async () => {
    render(<LoginPromptProvider><button onClick={() => requestLogin()}>로그인 열기</button></LoginPromptProvider>);
    fireEvent.click(screen.getByRole('button', { name: '로그인 열기' }));
    const dialog = await screen.findByRole('dialog');
    const first = screen.getByRole('button', { name: '로그인 닫기' });
    const last = screen.getByRole('link', { name: '개인정보 처리방침' });
    first.focus(); fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus();
    last.focus(); fireEvent.keyDown(dialog, { key: 'Tab' }); expect(first).toHaveFocus();
  });

  it('로그인 성공은 개인화만 갱신하며 보류된 쓰기를 자동 실행하지 않는다', async () => {
    window.history.replaceState({}, '', '/posts/7?target=comments#comments');
    const mutate = vi.fn();
    const view = render(<LoginPromptProvider><Action mutate={mutate} /></LoginPromptProvider>);
    fireEvent.click(screen.getByRole('button', { name: '댓글 작성' }));
    fireEvent.change(await screen.findByRole('textbox', { name: '아이디' }), { target: { value: 'player' } });
    fireEvent.change(screen.getByLabelText('비밀번호', { exact: true }), { target: { value: 'pass123!' } });
    fireEvent.submit(screen.getByRole('textbox', { name: '아이디' }).closest('form')!);
    await waitFor(() => expect(auth.login).toHaveBeenCalledWith(member));
    expect(loginWithPassword).toHaveBeenCalledExactlyOnceWith('player', 'pass123!');
    expect(mutate).not.toHaveBeenCalled(); expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<LoginPromptProvider><Action mutate={mutate} /></LoginPromptProvider>);
    fireEvent.click(screen.getByRole('button', { name: '댓글 작성' })); expect(mutate).toHaveBeenCalledOnce();
  });

  it('보호 링크 클릭은 이동 전에 모달로 막고 취소하면 탐색 화면을 유지한다', async () => {
    window.history.replaceState({}, '', '/profile/player');
    render(<LoginPromptProvider><a href="/wallet?returnTo=%2Fmentoring">지갑</a></LoginPromptProvider>);
    fireEvent.click(screen.getByRole('link', { name: '지갑' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '로그인 닫기' }));
    expect(window.location.pathname).toBe('/profile/player');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('보호 URL 직접 진입의 취소 복귀와 외부 returnTo 거부를 적용한다', async () => {
    render(<LoginPromptProvider><p>public shell</p></LoginPromptProvider>);
    act(() => requestLogin({ returnTo: '//evil.test', dismissTo: '/' }));
    fireEvent.click(await screen.findByRole('button', { name: '로그인 닫기' }));
    expect(navigation.replace).toHaveBeenCalledWith('/', { scroll: false });
  });

  it('결제 콜백에서 모달 로그인으로 승인을 재개하지 않고 먼저 공개 페이지로 벗어난다', () => {
    window.history.replaceState({}, '', '/payments/result?orderId=fixture');
    render(<LoginPromptProvider><p>payment result</p></LoginPromptProvider>);
    act(() => requestLogin());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(navigation.replace).toHaveBeenCalledWith('/?login=1&returnTo=%2Fwallet%3Ftab%3Dpayments', { scroll: false });
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('OAuth 이메일 오류를 모달에 표시하고 인증 전용 쿼리만 지운다', async () => {
    navigation.params = new URLSearchParams('login=1&error=email_not_verified&tab=all');
    render(<LoginPromptProvider><p>feed</p></LoginPromptProvider>);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Google 계정의 이메일이 인증되지 않아');
    expect(navigation.replace).toHaveBeenCalledWith('/?tab=all', { scroll: false });
  });

  it('탈퇴한 소셜 계정의 오류를 모달에 표시한다', async () => {
    navigation.params = new URLSearchParams('login=1&error=account_withdrawn');
    render(<LoginPromptProvider><p>feed</p></LoginPromptProvider>);
    expect(await screen.findByRole('dialog')).toHaveTextContent('탈퇴한 계정입니다.');
    expect(navigation.replace).toHaveBeenCalledWith('/', { scroll: false });
  });

  it('알 수 없는 OAuth 오류로 모달을 열지 않는다', () => {
    navigation.params = new URLSearchParams('error=__proto__');
    render(<LoginPromptProvider><p>feed</p></LoginPromptProvider>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each(['isSessionUnavailable', 'isAccountBlocked'] as const)('%s 상태를 정상 게스트 로그인으로 바꾸지 않는다', (state) => {
    auth[state] = true;
    const mutate = vi.fn();
    render(<LoginPromptProvider><Action mutate={mutate} /></LoginPromptProvider>);
    fireEvent.click(screen.getByRole('button', { name: '댓글 작성' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(mutate).not.toHaveBeenCalled();
  });
});
