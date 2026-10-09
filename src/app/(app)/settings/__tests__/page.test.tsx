import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('SettingsPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    auth.logout.mockReset();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('shows only real account data as read-only values', () => {
    render(<SettingsPage />);

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
    render(<SettingsPage />);

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
    render(<SettingsPage />);

    fireEvent.click(screen.getByRole('button', { name: '계정 삭제' }));

    expect(window.alert).toHaveBeenCalledWith(
      '계정 삭제 기능은 준비 중입니다. 현재 계정과 저장된 정보는 삭제되지 않습니다.',
    );
    expect(window.localStorage.getItem('gamerin_user')).toBe('stored-user');
    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"light"}');
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
