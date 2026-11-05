import { act, fireEvent, screen, within } from '@testing-library/react';
import { render } from '@/test/renderWithPopup';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pathname: '/home',
  push: vi.fn(),
  logout: vi.fn(),
  fetchMyMileageBalance: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1', handle: 'tester', nickname: '테스터', profileImageUrl: null },
    logout: mocks.logout,
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));
vi.mock('@/lib/mileage-api', () => ({ fetchMyMileageBalance: mocks.fetchMyMileageBalance }));
vi.mock('../NotificationPanel', () => ({ NotificationPanel: () => <div>알림 패널</div> }));

import { invalidateMileage } from '@/lib/mileage-sync';
import { Sidebar } from '../Sidebar';

describe('Sidebar (L2)', () => {
  beforeEach(() => {
    mocks.pathname = '/home';
    mocks.push.mockReset();
    mocks.logout.mockReset();
    mocks.fetchMyMileageBalance.mockReset();
    mocks.fetchMyMileageBalance.mockResolvedValue({ currentBalance: 12400 });
  });

  it('lists the L2 menu in order with the unread badge on 알림', () => {
    render(<Sidebar unreadCount={120} onUnreadCountChange={vi.fn()} />);
    const items = within(screen.getByRole('navigation', { name: '주요 메뉴' })).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '홈', '검색', '알림99+, 읽지 않은 알림 120개', '북마크', '메시지', '멘토링', '프로필',
    ]);
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows only the open panel menu as active', () => {
    render(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '알림' }));
    expect(screen.getByText('알림 패널')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈' })).not.toHaveAttribute('aria-current');
  });

  it('searches from the slide panel', () => {
    render(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
    const searchMenu = screen.getByRole('button', { name: '검색' });
    fireEvent.click(searchMenu);
    const input = screen.getByRole('textbox', { name: '통합 검색' });
    fireEvent.change(input, { target: { value: '#클러치' } });
    fireEvent.submit(input);
    expect(mocks.push).toHaveBeenCalledWith('/search?q=%23%ED%81%B4%EB%9F%AC%EC%B9%98');
    expect(searchMenu).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the mileage balance with a charge link and logs out from the account menu', async () => {
    render(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
    expect(await screen.findByText('12,400')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '충전' })).toHaveAttribute('href', '/wallet');
    expect(screen.getByText('@tester')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '계정 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '로그아웃' }));
    expect(mocks.logout).toHaveBeenCalled();
  });

  it('shows a dash when the balance cannot be loaded', async () => {
    mocks.fetchMyMileageBalance.mockRejectedValue(new Error('fail'));
    render(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('reloads the balance on a mileage signal and when the tab becomes visible, not on navigation', async () => {
    mocks.fetchMyMileageBalance
      .mockResolvedValueOnce({ currentBalance: 12400 })
      .mockResolvedValueOnce({ currentBalance: 9400 })
      .mockResolvedValueOnce({ currentBalance: 10400 });
    const view = render(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
    expect(await screen.findByText('12,400')).toBeInTheDocument();

    mocks.pathname = '/bookmarks';
    view.rerender(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
    expect(mocks.fetchMyMileageBalance).toHaveBeenCalledTimes(1);

    act(() => invalidateMileage());
    expect(await screen.findByText('9,400')).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(await screen.findByText('10,400')).toBeInTheDocument();
    expect(mocks.fetchMyMileageBalance).toHaveBeenCalledTimes(3);
  });

  it('closes an open slide panel when the window narrows to the mobile shell', () => {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
    })));
    try {
      render(<Sidebar unreadCount={0} onUnreadCountChange={vi.fn()} />);
      const bell = screen.getByRole('button', { name: '알림' });
      fireEvent.click(bell);
      expect(screen.getByText('알림 패널')).toBeInTheDocument();

      act(() => listeners.forEach((listener) => listener({ matches: false })));
      expect(screen.queryByText('알림 패널')).not.toBeInTheDocument();
      expect(bell).toHaveAttribute('aria-expanded', 'false');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
