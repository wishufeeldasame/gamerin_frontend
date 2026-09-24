import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchUnreadNotificationCount: vi.fn(),
  logout: vi.fn(),
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
  useRouter: () => ({ push: vi.fn() }),
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
