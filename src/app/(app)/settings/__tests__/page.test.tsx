import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/app/context/ToastContext';

const auth = vi.hoisted(() => ({
  logout: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      name: '테스트 사용자',
      nickname: '테스트 사용자',
      handle: 'tester',
      gameTier: 'Unranked',
    },
    logout: auth.logout,
  }),
}));

import SettingsPage from '../page';

function renderSettings() {
  return render(<ToastProvider><SettingsPage /></ToastProvider>);
}

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    auth.logout.mockReset();
  });

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

  it('does not clear local data or log out when account deletion is clicked', () => {
    window.localStorage.setItem('gamerin_user', 'stored-user');
    window.localStorage.setItem('gamerin_user_settings', '{"theme":"light"}');
    renderSettings();

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      '계정 삭제 기능은 준비 중입니다. 현재 계정과 저장된 정보는 삭제되지 않습니다.',
    );
    expect(window.localStorage.getItem('gamerin_user')).toBe('stored-user');
    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"light"}');
    expect(auth.logout).not.toHaveBeenCalled();
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

  it('shows the existing preview notice, clears fields, and does not send a password request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderSettings();
    fireEvent.change(screen.getByLabelText('현재 비밀번호'), { target: { value: 'current-password' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 변경' }));
    expect(screen.getByRole('status')).toHaveTextContent('현재는 프론트 미리보기입니다. 비밀번호 변경 API가 연결되면 실제 저장됩니다.');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    for (const label of ['현재 비밀번호', '새 비밀번호', '새 비밀번호 확인']) {
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
