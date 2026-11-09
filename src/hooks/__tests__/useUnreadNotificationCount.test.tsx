import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetchUnreadNotificationCount: vi.fn(),
  user: { id: 'user-1' },
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/lib/notification-api', () => ({
  fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
}));

vi.mock('@/hooks/useVisiblePolling', () => ({
  useVisiblePolling: vi.fn(),
}));

import { invalidateNotifications } from '@/lib/notification-sync';
import { useUnreadNotificationCount } from '../useUnreadNotificationCount';

function Count() {
  const [count] = useUnreadNotificationCount();
  return <p>{count}</p>;
}

describe('useUnreadNotificationCount', () => {
  beforeEach(() => {
    mocks.fetchUnreadNotificationCount.mockReset();
    mocks.user = { id: 'user-1' };
  });

  it('refreshes the unread count after DM SSE and conversation read invalidations', async () => {
    mocks.fetchUnreadNotificationCount
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);

    render(<Count />);
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

    const view = render(<Count />);
    await waitFor(() => expect(firstSignal).toBeDefined());

    mocks.user = { id: 'user-2' };
    view.rerender(<Count />);

    await waitFor(() => expect(firstSignal?.aborted).toBe(true));
    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
