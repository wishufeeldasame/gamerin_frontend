import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '@/app/context/ConfirmContext';
import { ToastProvider } from '@/app/context/ToastContext';
import { installDialogMock } from '@/test/feedback';

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

const auth = vi.hoisted(() => ({
  logout: vi.fn(),
  hasPassword: true as boolean | undefined,
  changePassword: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: '테스트 사용자',
      nickname: '테스트 사용자',
      handle: 'tester',
      gameTier: 'Unranked',
      hasPassword: auth.hasPassword,
    },
    logout: auth.logout,
  }),
}));

vi.mock('@/lib/auth-api', () => ({
  changePassword: auth.changePassword,
}));

const account = vi.hoisted(() => ({ deleteMyAccount: vi.fn() }));

vi.mock('@/lib/account-api', () => ({
  deleteMyAccount: account.deleteMyAccount,
}));

const saveThemeToServer = vi.hoisted(() => vi.fn());

vi.mock('@/lib/user-settings', async () => {
  const actual = await vi.importActual<typeof import('@/lib/user-settings')>('@/lib/user-settings');
  return { ...actual, saveThemeToServer };
});

// 대표 게임 섹션은 RepresentativeGameSetting.test.tsx에서 따로 검증한다.
vi.mock('../RepresentativeGameSetting', () => ({ RepresentativeGameSetting: () => <section aria-label="대표 게임" /> }));

import SettingsPage from '../page';

function renderSettings() {
  return render(<ToastProvider><ConfirmProvider><SettingsPage /></ConfirmProvider></ToastProvider>);
}

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    auth.logout.mockReset();
    auth.changePassword.mockReset();
    account.deleteMyAccount.mockReset();
    saveThemeToServer.mockReset();
    router.back.mockReset();
    router.replace.mockReset();
    installDialogMock();
    auth.hasPassword = true;
  });

  function fillPasswordForm(current: string, next: string, confirm = next) {
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: current } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: next } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
  }

  it('shows only real account data as read-only values', () => {
    renderSettings();

    const handle = screen.getByLabelText('아이디');

    // 서버가 이메일을 내려주지 않아 빈 이메일 칸은 보여주지 않는다.
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
    expect(handle).toHaveValue('@tester');
    expect(handle).toHaveAttribute('readonly');
    expect(screen.queryByText('전화번호')).not.toBeInTheDocument();
    expect(screen.queryByText('표시 이름')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '변경사항 저장' })).not.toBeInTheDocument();
  });

  it('개인화 탭에서만 테마와 대표 게임을 보여준다', () => {
    renderSettings();
    expect(screen.queryByRole('region', { name: '대표 게임' })).not.toBeInTheDocument();
    expect(screen.queryByText('테마 설정')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '개인화' }));

    expect(screen.getByRole('region', { name: '대표 게임' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '테마 설정' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '계정 정보' })).not.toBeInTheDocument();
  });

  it('applies and stores a theme immediately', async () => {
    saveThemeToServer.mockResolvedValue(undefined);
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '개인화' }));
    fireEvent.click(screen.getByRole('button', { name: /라이트 모드/ }));

    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"light"}');
    expect(screen.getByRole('button', { name: /라이트 모드/ })).toHaveAttribute('aria-pressed', 'true');
    // 서버 저장이 요청된다.
    await waitFor(() => expect(saveThemeToServer).toHaveBeenCalledWith('light'));
    expect(screen.queryByText('변경사항이 저장되었습니다.')).not.toBeInTheDocument();
  });

  it('asks for confirmation and does nothing when account deletion is cancelled', async () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('정말 계정을 삭제할까요?');

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(account.deleteMyAccount).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('deletes the account and logs out after confirmation', async () => {
    account.deleteMyAccount.mockResolvedValue(undefined);
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }));
    fireEvent.click(await screen.findByRole('button', { name: '탈퇴하기' }));

    await waitFor(() => expect(auth.logout).toHaveBeenCalledWith({ redirectTo: '/?login=1' }));
    expect(account.deleteMyAccount).toHaveBeenCalledTimes(1);
  });

  it('keeps the session and shows the server message when deletion is rejected', async () => {
    account.deleteMyAccount.mockRejectedValue(new Error('진행 중이거나 정산되지 않은 멘토링이 있어 탈퇴할 수 없습니다.'));
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }));
    fireEvent.click(await screen.findByRole('button', { name: '탈퇴하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('진행 중이거나 정산되지 않은 멘토링이 있어 탈퇴할 수 없습니다.');
    expect(auth.logout).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '계정 삭제' })).toBeEnabled();
  });

  it('announces missing password fields as an error without clearing input', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'current-password' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호 입력칸을 모두 채워 주세요.');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('current-password');
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces a password mismatch and preserves all fields', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'different-password' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(screen.getByRole('alert')).toHaveTextContent('새 비밀번호가 일치하지 않습니다.');
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('current-password');
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('new-password');
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveValue('different-password');
  });

  it('rejects a new password that breaks the sign-up rule without calling the API', () => {
    renderSettings();
    fillPasswordForm('OldPassword1!', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호는 8~20자로 입력해 주세요.');
    expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password through the API and clears the fields', async () => {
    auth.changePassword.mockResolvedValue(undefined);
    renderSettings();
    fillPasswordForm('OldPassword1!', 'NewPassword1!');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('비밀번호가 변경되었습니다.'));
    expect(auth.changePassword).toHaveBeenCalledWith('OldPassword1!', 'NewPassword1!', 'NewPassword1!');
    for (const label of ['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인']) {
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
  });

  it('shows the server error and keeps the fields when the change fails', async () => {
    auth.changePassword.mockRejectedValue(new Error('현재 비밀번호가 올바르지 않습니다.'));
    renderSettings();
    fillPasswordForm('WrongPassword1!', 'NewPassword1!');

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('현재 비밀번호가 올바르지 않습니다.'));
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('WrongPassword1!');
  });

  it('hides the password form for social-only accounts', () => {
    auth.hasPassword = false;
    renderSettings();

    expect(screen.getByText('소셜 로그인으로 가입한 계정은 비밀번호가 없어 변경할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByLabelText('현재 비밀번호')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '비밀번호 변경' })).not.toBeInTheDocument();
  });
});
