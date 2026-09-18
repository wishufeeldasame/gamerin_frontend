import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationRecord } from '@/lib/notification-api';

const mocks = vi.hoisted(() => ({
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('@/lib/notification-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/notification-api')>();
  return {
    ...actual,
    fetchNotifications: mocks.fetchNotifications,
    fetchUnreadNotificationCount: mocks.fetchUnreadNotificationCount,
    markAllNotificationsRead: mocks.markAllNotificationsRead,
    markNotificationRead: mocks.markNotificationRead,
  };
});

vi.mock('@/lib/feed-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feed-api')>();
  return {
    ...actual,
    formatRelativeTime: () => '방금 전',
    getInitials: (name: string) => name.slice(0, 1),
  };
});

import { invalidateNotifications } from '@/lib/notification-sync';
import { NotificationPanel } from '../NotificationPanel';

function notification(id: string, nickname: string, read = false): NotificationRecord {
  return {
    notificationId: id,
    type: 'like',
    actor: {
      userId: `user-${id}`,
      handle: `handle-${id}`,
      nickname,
      profileImageUrl: null,
      verifiedBadge: false,
    },
    postId: `post-${id}`,
    commentId: null,
    conversationId: null,
    messageId: null,
    mentoringApplicationId: null,
    mentoringReviewId: null,
    read,
    createdAt: '2026-09-18T00:00:00Z',
  };
}

function page(items: NotificationRecord[], nextCursor: string | null, hasNext: boolean) {
  return { items, nextCursor, hasNext };
}

describe('NotificationPanel server synchronization', () => {
  beforeEach(() => {
    mocks.fetchNotifications.mockReset();
    mocks.fetchUnreadNotificationCount.mockReset();
    mocks.markAllNotificationsRead.mockReset();
    mocks.markNotificationRead.mockReset();
    mocks.push.mockReset();
    mocks.markNotificationRead.mockResolvedValue(undefined);
    mocks.markAllNotificationsRead.mockResolvedValue(undefined);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it('replaces the first page after invalidation so removed server items disappear', async () => {
    mocks.fetchNotifications
      .mockResolvedValueOnce(page([notification('1', '첫 번째'), notification('2', '두 번째')], null, false))
      .mockResolvedValueOnce(page([notification('2', '두 번째')], null, false));
    mocks.fetchUnreadNotificationCount.mockResolvedValue(1);

    render(<NotificationPanel onClose={vi.fn()} />);
    expect(await screen.findByText('첫 번째님이 게시글을 좋아합니다.')).toBeInTheDocument();

    invalidateNotifications('message-created');

    await waitFor(() => {
      expect(screen.queryByText('첫 번째님이 게시글을 좋아합니다.')).not.toBeInTheDocument();
    });
    expect(screen.getByText('두 번째님이 게시글을 좋아합니다.')).toBeInTheDocument();
  });

  it('deduplicates cursor results and stops when hasNext has no nextCursor', async () => {
    mocks.fetchNotifications
      .mockResolvedValueOnce(page([notification('1', '첫 번째')], 'cursor-1', true))
      .mockResolvedValueOnce(
        page([notification('1', '첫 번째'), notification('2', '두 번째')], null, true),
      );
    mocks.fetchUnreadNotificationCount.mockResolvedValue(2);

    render(<NotificationPanel onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '더보기' }));

    await screen.findByText('두 번째님이 게시글을 좋아합니다.');
    expect(screen.getAllByText('첫 번째님이 게시글을 좋아합니다.')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument();
    expect(mocks.fetchNotifications).toHaveBeenCalledTimes(2);
  });

  it('rolls back an optimistic read when the mutation fails', async () => {
    mocks.fetchNotifications.mockResolvedValue(page([notification('1', '첫 번째')], null, false));
    mocks.fetchUnreadNotificationCount.mockResolvedValue(1);
    mocks.markNotificationRead.mockRejectedValue(new Error('읽음 실패'));

    render(<NotificationPanel onClose={vi.fn()} />);
    const item = await screen.findByRole('button', { name: /첫 번째님이 게시글을 좋아합니다/ });
    fireEvent.click(item);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('읽음 실패'));
    expect(screen.getByText('읽지 않은 알림 1개')).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('keeps the read state when only the follow-up unread count request fails', async () => {
    mocks.fetchNotifications.mockResolvedValue(page([notification('1', '첫 번째')], null, false));
    mocks.fetchUnreadNotificationCount
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('count failed'));

    render(<NotificationPanel onClose={vi.fn()} />);
    const panel = await screen.findByRole('button', { name: /첫 번째님이 게시글을 좋아합니다/ });
    fireEvent.click(panel);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/posts/post-1'));
    expect(within(document.body).getByText('읽지 않은 알림 0개')).toBeInTheDocument();
    expect(window.alert).not.toHaveBeenCalled();
  });
});
