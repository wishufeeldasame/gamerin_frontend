import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminUsersTable } from '../AdminUsersTable';

describe('AdminUsersTable 한국어 검색 안내', () => {
  it('검색 입력 안내를 한국어로 표시한다', () => {
    render(<AdminUsersTable />);

    expect(screen.getByRole('searchbox', { name: '사용자 검색' })).toHaveAttribute(
      'placeholder',
      '핸들 · 닉네임 검색',
    );
    expect(screen.queryByPlaceholderText('Handle · Nickname 검색')).not.toBeInTheDocument();
  });

  it('기존 핸들·닉네임 검색과 검색 시 페이지 초기화를 유지한다', () => {
    render(<AdminUsersTable />);
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByText('@admin02')).toBeInTheDocument();

    const search = screen.getByRole('searchbox', { name: '사용자 검색' });
    fireEvent.change(search, { target: { value: ' @GaMeR01 ' } });
    expect(screen.getByText('겜돌이')).toBeInTheDocument();
    expect(screen.getByText('@gamer01')).toBeInTheDocument();
    expect(screen.queryByText('@admin02')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');

    fireEvent.change(search, { target: { value: '미드킹' } });
    expect(screen.getByText('@midking')).toBeInTheDocument();
    expect(screen.queryByText('@gamer01')).not.toBeInTheDocument();
  });
});
