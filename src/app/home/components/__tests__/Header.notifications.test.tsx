import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchUnreadNotificationCount: vi.fn(),
  logout: vi.fn(),
  push: vi.fn(),
  pathname: '/home',
  user: {
    id: 'user-1',
    nickname: '테스터',
    gameTier: 'Gold',
    profileImageUrl: null as string | null,
  },
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, logout: mocks.logout }),
}));

vi.mock('@/lib/notification-api', () => ({
  fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
}));

vi.mock('@/hooks/useVisiblePolling', () => ({
  useVisiblePolling: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));

vi.mock('../NotificationPanel', () => ({
  NotificationPanel: () => <div>알림 패널</div>,
}));

import { invalidateNotifications } from '@/lib/notification-sync';
import { Header } from '../Header';

describe('Header notification freshness', () => {
  beforeEach(() => {
    mocks.fetchUnreadNotificationCount.mockReset();
    mocks.logout.mockReset();
  });

  it('refreshes the unread count after DM SSE and conversation read invalidations', async () => {
    mocks.fetchUnreadNotificationCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);

    render(<Header />);
    expect(await screen.findByText('2')).toBeInTheDocument();

    invalidateNotifications('message-created');

    expect(await screen.findByText('4')).toBeInTheDocument();

    invalidateNotifications('conversation-read');

    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(mocks.fetchUnreadNotificationCount).toHaveBeenCalledTimes(3);
  });

  it('aborts the previous unread request when the authenticated user changes', async () => {
    let firstSignal: AbortSignal | undefined;
    mocks.fetchUnreadNotificationCount
      .mockImplementationOnce(({ signal }: { signal?: AbortSignal }) => {
        firstSignal = signal;
        return new Promise<number>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      })
      .mockResolvedValueOnce(1);

    const view = render(<Header />);
    await waitFor(() => expect(firstSignal).toBeDefined());

    mocks.user = { ...mocks.user, id: 'user-2', nickname: '다른 사용자' };
    view.rerender(<Header />);

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});

describe('Header mobile search', () => {
  beforeEach(() => {
    mocks.fetchUnreadNotificationCount.mockReset();
    mocks.fetchUnreadNotificationCount.mockResolvedValue(0);
    mocks.push.mockReset();
    mocks.pathname = '/home';
  });

  it('opens the search field with the toggle, focuses it, and closes it after searching', async () => {
    render(<Header />);

    const toggle = screen.getByRole('button', { name: '검색 열기' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    const input = screen.getByRole('textbox', { name: '통합 검색' });
    await waitFor(() => expect(input).toHaveFocus());
    expect(screen.getByRole('button', { name: '검색 닫기' })).toHaveAttribute('aria-expanded', 'true');

    fireEvent.change(input, { target: { value: ' 발로란트 ' } });
    fireEvent.submit(input);

    expect(mocks.push).toHaveBeenCalledWith('/search?q=%EB%B0%9C%EB%A1%9C%EB%9E%80%ED%8A%B8');
    expect(screen.getByRole('button', { name: '검색 열기' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the search field with Escape', () => {
    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: '통합 검색' }), { key: 'Escape' });

    expect(screen.getByRole('button', { name: '검색 열기' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes the search field when the route changes without searching', () => {
    const view = render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));
    expect(screen.getByRole('button', { name: '검색 닫기' })).toBeInTheDocument();

    mocks.pathname = '/bookmarks';
    view.rerender(<Header />);
    expect(screen.getByRole('button', { name: '검색 열기' })).toHaveAttribute('aria-expanded', 'false');

    // 검색창을 열었던 페이지로 돌아와도 다시 열리지 않는다.
    mocks.pathname = '/home';
    view.rerender(<Header />);
    expect(screen.getByRole('button', { name: '검색 열기' })).toHaveAttribute('aria-expanded', 'false');
  });
});
