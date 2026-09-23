import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import { type ApiClientConfig, type ApiRequestOptions, apiRequest } from '@/lib/api-client';
import type { CursorPage } from '@/lib/feed-api';

interface NotificationRequestOptions {
  signal?: AbortSignal;
}

export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'repost'
  | 'direct_message'
  | 'mentoring_application'
  | 'mentoring_cancelled'
  | 'mentoring_accepted'
  | 'mentoring_rejected'
  | 'mentoring_started'
  | 'mentoring_finished'
  | 'mentoring_completed'
  | 'mentoring_review'
  | 'mention';

export interface NotificationActor {
  userId: string;
  handle: string;
  nickname: string;
  profileImageUrl: string | null;
  verifiedBadge: boolean;
}

export interface NotificationRecord<TType = NotificationType> {
  notificationId: string;
  type: TType;
  actor: NotificationActor | null;
  postId: string | null;
  commentId: string | null;
  conversationId: string | null;
  messageId: string | null;
  mentoringApplicationId: string | null;
  mentoringReviewId: string | null;
  read: boolean;
  createdAt: string;
}

export interface UnreadNotificationCount {
  unreadCount: number;
}

function createAuthError() {
  return new Error('Authentication is required or the token has expired.');
}

const NOTIFICATION_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) =>
    reason === 'unauthenticated' || (reason === 'http' && status === 401)
      ? createAuthError()
      : new Error(message ?? 'Notification request failed.'),
};

function normalizeActor(actor: NotificationActor | null): NotificationActor | null {
  if (!actor) {
    return null;
  }

  return {
    ...actor,
    profileImageUrl: toAbsoluteAssetUrl(actor.profileImageUrl),
    verifiedBadge: Boolean(actor.verifiedBadge),
  };
}

function normalizeNotification(notification: NotificationRecord): NotificationRecord {
  return {
    ...notification,
    actor: normalizeActor(notification.actor),
    postId: notification.postId ?? null,
    commentId: notification.commentId ?? null,
    conversationId: notification.conversationId ?? null,
    messageId: notification.messageId ?? null,
    mentoringApplicationId: notification.mentoringApplicationId ?? null,
    mentoringReviewId: notification.mentoringReviewId ?? null,
    read: Boolean(notification.read),
  };
}

function notificationRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(path, NOTIFICATION_CLIENT, options);
}

export async function fetchNotifications(
  cursor?: string | null,
  size = 20,
  options: NotificationRequestOptions = {},
) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await notificationRequest<CursorPage<NotificationRecord>>(
    `/api/v1/notifications?${search.toString()}`,
    { signal: options.signal },
  );

  return {
    items: Array.isArray(page.items) ? page.items.map(normalizeNotification) : [],
    nextCursor: page.nextCursor ?? null,
    hasNext: Boolean(page.hasNext),
  };
}

export async function fetchUnreadNotificationCount(options: NotificationRequestOptions = {}) {
  const data = await notificationRequest<UnreadNotificationCount>('/api/v1/notifications/unread-count', {
    signal: options.signal,
  });
  return Number.isFinite(Number(data.unreadCount)) ? Number(data.unreadCount) : 0;
}

export async function markNotificationRead(notificationId: string) {
  await notificationRequest<null>(`/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead() {
  await notificationRequest<null>('/api/v1/notifications/read-all', {
    method: 'PATCH',
  });
}
