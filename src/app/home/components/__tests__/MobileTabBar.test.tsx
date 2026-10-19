import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/home',
  user: { id: 'user-1', handle: 'demo 01', nickname: '테스터' },
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, logout: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

import { MobileTabBar } from '../Sidebar';

describe('MobileTabBar', () => {
  beforeEach(() => {
    mocks.pathname = '/home';
  });

  it('renders the same five menu links as the sidebar, with the profile link using the handle', () => {
    render(<MobileTabBar />);

    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['홈', '북마크', '메시지', '멘토링', '프로필']);
    expect(screen.getByRole('link', { name: '프로필' })).toHaveAttribute('href', '/profile/demo%2001');
  });

  it('marks only the current page with aria-current', () => {
    render(<MobileTabBar />);

    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '북마크' })).not.toHaveAttribute('aria-current');
  });

  it('treats any profile page as the profile tab', () => {
    mocks.pathname = '/profile/someone-else';
    render(<MobileTabBar />);

    expect(screen.getByRole('link', { name: '프로필' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current');
  });
});
