import { describe, expect, it } from 'vitest';
import type { NotificationType } from '@/lib/notification-api';
import {
  getNotificationPresentation,
  type NotificationIconKind,
  type NotificationPresentationInput,
} from '@/lib/notification-presentation';

function createNotification(
  overrides: Partial<NotificationPresentationInput> = {},
): NotificationPresentationInput {
  return {
    notificationId: 'notification-id',
    type: 'like',
    actor: {
      userId: 'actor-id',
      handle: 'actor/handle',
      nickname: '플레이어',
      profileImageUrl: null,
      verifiedBadge: false,
    },
    postId: 'post/id',
    commentId: 'comment/id',
    conversationId: 'conversation/id',
    messageId: 'message/id',
    mentoringApplicationId: 'application/id',
    mentoringReviewId: 'review/id',
    read: false,
    createdAt: '2026-09-18T12:00:00+09:00',
    ...overrides,
  };
}

describe('getNotificationPresentation', () => {
  const cases = [
    {
      type: 'like',
      message: '플레이어님이 게시글을 좋아합니다.',
      iconKind: 'heart',
      href: '/posts/post%2Fid',
    },
    {
      type: 'comment',
      message: '플레이어님이 게시글에 댓글을 남겼습니다.',
      iconKind: 'message-circle',
      href: '/posts/post%2Fid?commentId=comment%2Fid',
    },
    {
      type: 'follow',
      message: '플레이어님이 나를 팔로우했습니다.',
      iconKind: 'user-plus',
      href: '/profile/actor%2Fhandle',
    },
    {
      type: 'repost',
      message: '플레이어님이 게시글을 리포스트했습니다.',
      iconKind: 'repeat',
      href: '/posts/post%2Fid',
    },
    {
      type: 'direct_message',
      message: '플레이어님이 메시지를 보냈습니다.',
      iconKind: 'mail',
      href: '/messages?conversationId=conversation%2Fid&messageId=message%2Fid',
    },
    {
      type: 'mentoring_application',
      message: '플레이어님이 멘토링을 신청했습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_cancelled',
      message: '멘토링 신청이 취소되었습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_accepted',
      message: '멘토링 신청이 수락되었습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_rejected',
      message: '멘토링 신청이 거절되었습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_started',
      message: '멘토링이 시작되었습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_finished',
      message: '멘토링이 종료되었습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_completed',
      message: '멘토링이 완료되었습니다.',
      iconKind: 'graduation-cap',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mentoring_review',
      message: '플레이어님이 멘토링 리뷰를 남겼습니다.',
      iconKind: 'star',
      href: '/mentoring?tab=mine&applicationId=application%2Fid&reviewId=review%2Fid',
    },
    {
      type: 'mention',
      message: '플레이어님이 나를 언급했습니다.',
      iconKind: 'at-sign',
      href: '/posts/post%2Fid?commentId=comment%2Fid',
    },
  ] satisfies ReadonlyArray<{
    type: NotificationType;
    message: string;
    iconKind: NotificationIconKind;
    href: string;
  }>;

  it.each(cases)('maps $type notification presentation', (expected) => {
    expect(getNotificationPresentation(createNotification({ type: expected.type }))).toEqual({
      message: expected.message,
      iconKind: expected.iconKind,
      href: expected.href,
    });
  });

  it('returns a non-navigable fallback for an unknown runtime type', () => {
    expect(getNotificationPresentation(createNotification({ type: 'future_event' }))).toEqual({
      message: '새 알림이 도착했습니다.',
      iconKind: 'bell',
      href: null,
    });
  });

  it('uses a generic actor message and does not create an invalid profile URL', () => {
    expect(getNotificationPresentation(createNotification({ type: 'follow', actor: null }))).toEqual({
      message: '누군가 나를 팔로우했습니다.',
      iconKind: 'user-plus',
      href: null,
    });
  });

  it.each([
    ['like', { postId: null }],
    ['comment', { postId: null, commentId: null }],
    ['mention', { postId: null, commentId: null }],
    ['direct_message', { conversationId: null, messageId: null }],
  ] satisfies ReadonlyArray<readonly [NotificationType, Partial<NotificationPresentationInput>]>) (
    'does not create an invalid destination for %s without its required reference',
    (type, references) => {
      expect(getNotificationPresentation(createNotification({ type, ...references })).href).toBeNull();
    },
  );

  it('keeps the mentoring mine tab when optional reference IDs are null', () => {
    const presentation = getNotificationPresentation(createNotification({
      type: 'mentoring_completed',
      mentoringApplicationId: null,
      mentoringReviewId: null,
    }));

    expect(presentation.href).toBe('/mentoring?tab=mine');
  });
});
