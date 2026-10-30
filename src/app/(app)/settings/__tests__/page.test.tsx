import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '@/app/context/ConfirmContext';
import { ToastProvider } from '@/app/context/ToastContext';
import { installDialogMock } from '@/test/feedback';

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

    const email = screen.getByLabelText('이메일');
    const handle = screen.getByLabelText('사용자 이름');

    expect(email).toHaveValue('');
    expect(email).toHaveAttribute('readonly');
    expect(handle).toHaveValue('@tester');
    expect(handle).toHaveAttribute('readonly');
    expect(screen.queryByText('전화번호')).not.toBeInTheDocument();
    expect(screen.queryByText('표시 이름')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '변경사항 저장' })).not.toBeInTheDocument();
  });

  it('applies and stores a theme immediately', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '테마' }));
    fireEvent.click(screen.getByRole('button', { name: '다크 모드' }));

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"dark"}');
    expect(screen.getByRole('button', { name: '다크 모드' })).toHaveAttribute('aria-pressed', 'true');
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

    await waitFor(() => expect(auth.logout).toHaveBeenCalledWith({ redirectTo: '/login' }));
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
    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호 입력칸을 모두 채워주세요.');
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
    expect(screen.getByRole('alert')).toHaveTextContent('새 비밀번호 확인이 일치하지 않습니다.');
    expect(screen.getByLabelText('현재 비밀번호')).toHaveValue('current-password');
    expect(screen.getByLabelText('새 비밀번호')).toHaveValue('new-password');
    expect(screen.getByLabelText('새 비밀번호 확인')).toHaveValue('different-password');
  });

  it('rejects a new password that breaks the sign-up rule without calling the API', () => {
    renderSettings();
    fillPasswordForm('OldPassword1!', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('비밀번호는 8~20자로 입력해주세요.');
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
