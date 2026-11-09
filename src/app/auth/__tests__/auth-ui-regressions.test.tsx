import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactElement } from 'react';

const navigation = vi.hoisted(() => ({
  pathname: '/',
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isAuthReady: true,
  isLoggingOut: false,
  isSessionUnavailable: false,
  isAccountBlocked: false,
  login: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.params,
}));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/app/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn() }) }));

import SignupPage from '@/app/signup/page';
import FindIdPage from '@/app/find-id/page';
import FindIdResultPage from '@/app/find-id-result/page';
import ForgotPasswordPage from '@/app/auth/forgot-password/page';
import { LoginPromptProvider } from '@/app/auth/_components/LoginPromptProvider';
import { requestLogin } from '@/lib/login-prompt';

beforeEach(() => {
  navigation.pathname = '/';
  navigation.params = new URLSearchParams();
  auth.user = null;
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

describe('인증 화면 이동', () => {
  it('회원가입 화면에서 별도 로그인 링크를 노출하지 않는다', () => {
    render(<SignupPage />);

    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument();
  });

  it.each<[string, () => ReactElement]>([
    ['아이디 찾기', () => <FindIdPage />],
    ['아이디 찾기 결과', () => <FindIdResultPage />],
    ['비밀번호 찾기', () => <ForgotPasswordPage />],
  ])('%s 화면은 로그인 창 대신 홈으로 돌아간다', (_name, renderPage) => {
    render(renderPage());

    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/');
  });
});

type MentoringTabId = 'find' | 'mine';

function MentoringTab({ onLoginRequired }: { onLoginRequired: () => void }) {
  const [activeTab, setActiveTab] = useState<MentoringTabId>('find');
  const changeTab = (tab: MentoringTabId) => {
    if (tab !== 'find') {
      onLoginRequired();
      return;
    }
    setActiveTab(tab);
  };

  return (
    <div role="tablist" aria-label="멘토링 메뉴">
      <button type="button" role="tab" aria-selected={activeTab === 'find'} onClick={() => changeTab('find')}>
        멘토 찾기
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === 'mine'}
        onFocus={() => { if (activeTab !== 'mine') changeTab('mine'); }}
        onClick={() => changeTab('mine')}
      >
        내 멘토링
      </button>
    </div>
  );
}

describe('게스트 멘토링 로그인 모달', () => {
  it('X의 포커스 복원으로 탭이 다시 로그인을 요청해도 모달을 재열지 않는다', async () => {
    const user = userEvent.setup();
    const onLoginRequired = vi.fn(() => requestLogin({ returnTo: '/mentoring?tab=mine' }));
    let connectedAtClose: boolean | undefined;
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
      connectedAtClose = this.isConnected;
      this.removeAttribute('open');
      screen.getByRole('tab', { name: '내 멘토링' }).focus();
    });

    render(
      <LoginPromptProvider>
        <MentoringTab onLoginRequired={onLoginRequired} />
      </LoginPromptProvider>,
    );

    const trigger = screen.getByRole('tab', { name: '내 멘토링' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: '다시 오신 걸 환영해요' })).toBeInTheDocument();
    const requestsBeforeClose = onLoginRequired.mock.calls.length;

    await user.click(screen.getByRole('button', { name: '로그인 닫기' }));

    expect(onLoginRequired).toHaveBeenCalledTimes(requestsBeforeClose + 1);
    expect(screen.queryByRole('dialog', { name: '다시 오신 걸 환영해요' })).not.toBeInTheDocument();
    expect(close).toHaveBeenCalledOnce();
    expect(connectedAtClose).toBe(true);
    expect(trigger).toHaveFocus();
  });
});
