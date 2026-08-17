import { clearStoredAuth, ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/api-base';
import type { CursorPage } from '@/lib/feed-api';

const API_BASE = getApiBaseUrl();

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

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

export interface NotificationRecord {
  notificationId: string;
  type: NotificationType;
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

function normalizeAssetUrl(value?: string | null) {
  const url = value?.trim();
  if (!url) {
    return null;
  }

  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url;
  }

  if (url.startsWith('//')) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
    return `${protocol}${url}`;
  }

  return `${API_BASE.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
}

function normalizeActor(actor: NotificationActor | null): NotificationActor | null {
  if (!actor) {
    return null;
  }

  return {
    ...actor,
    profileImageUrl: normalizeAssetUrl(actor.profileImageUrl),
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

async function notificationRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { message?: string } | null;
    return { response, payload };
  };

  let accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw createAuthError();
  }

  let result = await send(accessToken);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw createAuthError();
    }

    result = await send(accessToken);
  }

  if (!result.response.ok) {
    if (result.response.status === 401) {
      clearStoredAuth();
      throw createAuthError();
    }

    throw new Error(result.payload?.message ?? 'Notification request failed.');
  }

  return (result.payload as ApiEnvelope<T>).data;
}

export async function fetchNotifications(cursor?: string | null, size = 20) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await notificationRequest<CursorPage<NotificationRecord>>(
    `/api/v1/notifications?${search.toString()}`,
  );

  return {
    items: Array.isArray(page.items) ? page.items.map(normalizeNotification) : [],
    nextCursor: page.nextCursor ?? null,
    hasNext: Boolean(page.hasNext),
  };
}

export async function fetchUnreadNotificationCount() {
  const data = await notificationRequest<UnreadNotificationCount>('/api/v1/notifications/unread-count');
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
