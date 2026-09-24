import type { NotificationRecord, NotificationType } from '@/lib/notification-api';

export type NotificationIconKind =
  | 'heart'
  | 'message-circle'
  | 'user-plus'
  | 'repeat'
  | 'mail'
  | 'graduation-cap'
  | 'star'
  | 'at-sign'
  | 'bell';

export type NotificationPresentationInput = NotificationRecord<unknown>;

export interface NotificationPresentation {
  message: string;
  iconKind: NotificationIconKind;
  href: string | null;
}

const UNKNOWN_NOTIFICATION: NotificationPresentation = {
  message: '새 알림이 도착했습니다.',
  iconKind: 'bell',
  href: null,
};

const NOTIFICATION_TYPE_LOOKUP = {
  like: true,
  comment: true,
  follow: true,
  repost: true,
  direct_message: true,
  mentoring_application: true,
  mentoring_cancelled: true,
  mentoring_accepted: true,
  mentoring_rejected: true,
  mentoring_started: true,
  mentoring_finished: true,
  mentoring_completed: true,
  mentoring_review: true,
  mention: true,
} satisfies Record<NotificationType, true>;

function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === 'string' && Object.hasOwn(NOTIFICATION_TYPE_LOOKUP, value);
}

function getValue(value: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function getActorSubject(notification: NotificationPresentationInput) {
  const nickname = getValue(notification.actor?.nickname ?? null);
  return nickname ? `${nickname}님이` : '누군가';
}

function getPostHref(notification: NotificationPresentationInput, includeCommentId = false) {
  const postId = getValue(notification.postId);
  if (!postId) {
    return null;
  }

  const pathname = `/posts/${encodeURIComponent(postId)}`;
  const commentId = includeCommentId ? getValue(notification.commentId) : null;
  if (!commentId) {
    return pathname;
  }

  const search = new URLSearchParams({ commentId });
  return `${pathname}?${search.toString()}`;
}

function getProfileHref(notification: NotificationPresentationInput) {
  const handle = getValue(notification.actor?.handle ?? null);
  return handle ? `/profile/${encodeURIComponent(handle)}` : null;
}

function getMessageHref(notification: NotificationPresentationInput) {
  const conversationId = getValue(notification.conversationId);
  if (!conversationId) {
    return null;
  }

  const search = new URLSearchParams({ conversationId });
  const messageId = getValue(notification.messageId);
  if (messageId) {
    search.set('messageId', messageId);
  }

  return `/messages?${search.toString()}`;
}

function getMentoringHref(notification: NotificationPresentationInput) {
  const search = new URLSearchParams({ tab: 'mine' });
  const applicationId = getValue(notification.mentoringApplicationId);
  const reviewId = getValue(notification.mentoringReviewId);

  if (applicationId) {
    search.set('applicationId', applicationId);
  }
  if (reviewId) {
    search.set('reviewId', reviewId);
  }

  return `/mentoring?${search.toString()}`;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled notification type: ${String(value)}`);
}

function getKnownNotificationPresentation(
  type: NotificationType,
  notification: NotificationPresentationInput,
): NotificationPresentation {
  const actorSubject = getActorSubject(notification);

  switch (type) {
    case 'like':
      return {
        message: `${actorSubject} 게시글을 좋아합니다.`,
        iconKind: 'heart',
        href: getPostHref(notification),
      };
    case 'comment':
      return {
        message: `${actorSubject} 게시글에 댓글을 남겼습니다.`,
        iconKind: 'message-circle',
        href: getPostHref(notification, true),
      };
    case 'follow':
      return {
        message: `${actorSubject} 나를 팔로우했습니다.`,
        iconKind: 'user-plus',
        href: getProfileHref(notification),
      };
    case 'repost':
      return {
        message: `${actorSubject} 게시글을 리포스트했습니다.`,
        iconKind: 'repeat',
        href: getPostHref(notification),
      };
    case 'direct_message':
      return {
        message: `${actorSubject} 메시지를 보냈습니다.`,
        iconKind: 'mail',
        href: getMessageHref(notification),
      };
    case 'mentoring_application':
      return {
        message: `${actorSubject} 멘토링을 신청했습니다.`,
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_cancelled':
      return {
        message: '멘토링 신청이 취소되었습니다.',
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_accepted':
      return {
        message: '멘토링 신청이 수락되었습니다.',
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_rejected':
      return {
        message: '멘토링 신청이 거절되었습니다.',
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_started':
      return {
        message: '멘토링이 시작되었습니다.',
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_finished':
      return {
        message: '멘토링이 종료되었습니다.',
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_completed':
      return {
        message: '멘토링이 완료되었습니다.',
        iconKind: 'graduation-cap',
        href: getMentoringHref(notification),
      };
    case 'mentoring_review':
      return {
        message: `${actorSubject} 멘토링 리뷰를 남겼습니다.`,
        iconKind: 'star',
        href: getMentoringHref(notification),
      };
    case 'mention':
      return {
        message: `${actorSubject} 나를 언급했습니다.`,
        iconKind: 'at-sign',
        href: getPostHref(notification, true),
      };
    default:
      return assertNever(type);
  }
}

export function getNotificationPresentation(
  notification: NotificationPresentationInput,
): NotificationPresentation {
  if (!isNotificationType(notification.type)) {
    return UNKNOWN_NOTIFICATION;
  }

  return getKnownNotificationPresentation(notification.type, notification);
}
