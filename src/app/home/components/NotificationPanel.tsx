'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AtSign,
  Bell,
  CheckCheck,
  GraduationCap,
  Heart,
  Loader2,
  Mail,
  MessageCircle,
  Repeat2,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
  type NotificationType,
} from '@/lib/notification-api';
import { formatRelativeTime, getInitials } from '@/lib/feed-api';

interface NotificationPanelProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

const PAGE_SIZE = 20;

function getNotificationIcon(type: NotificationType) {
  if (type === 'like') return <Heart size={16} className="fill-red-500 text-red-500" />;
  if (type === 'comment') return <MessageCircle size={16} className="text-zinc-900" />;
  if (type === 'follow') return <UserPlus size={16} className="text-blue-500" />;
  if (type === 'repost') return <Repeat2 size={16} className="text-emerald-600" />;
  if (type === 'direct_message') return <Mail size={16} className="text-violet-500" />;
  if (type === 'mention') return <AtSign size={16} className="text-[#d69a1f]" />;
  if (type === 'mentoring_review') return <Star size={16} className="fill-[#f5b93d] text-[#d69a1f]" />;
  return <GraduationCap size={16} className="text-zinc-700" />;
}

function getNotificationMessage(notification: NotificationRecord) {
  const name = notification.actor?.nickname ?? '새 알림';

  switch (notification.type) {
    case 'like':
      return `${name}님이 게시글을 좋아합니다.`;
    case 'comment':
      return `${name}님이 게시글에 댓글을 남겼습니다.`;
    case 'follow':
      return `${name}님이 나를 팔로우했습니다.`;
    case 'repost':
      return `${name}님이 게시글을 리포스트했습니다.`;
    case 'direct_message':
      return `${name}님이 메시지를 보냈습니다.`;
    case 'mentoring_application':
      return `${name}님이 멘토링을 신청했습니다.`;
    case 'mentoring_cancelled':
      return '멘토링 신청이 취소되었습니다.';
    case 'mentoring_accepted':
      return '멘토링 신청이 수락되었습니다.';
    case 'mentoring_rejected':
      return '멘토링 신청이 거절되었습니다.';
    case 'mentoring_started':
      return '멘토링이 시작되었습니다.';
    case 'mentoring_finished':
      return '멘토링이 종료되었습니다.';
    case 'mentoring_completed':
      return '멘토링이 완료되었습니다.';
    case 'mentoring_review':
      return `${name}님이 멘토링 리뷰를 남겼습니다.`;
    case 'mention':
      return `${name}님이 나를 언급했습니다.`;
    default:
      return '새 알림이 도착했습니다.';
  }
}

function getNotificationHref(notification: NotificationRecord) {
  if (
    ['like', 'comment', 'repost', 'mention'].includes(notification.type) &&
    notification.postId
  ) {
    const search = notification.commentId ? '?target=comments' : '';
    return `/posts/${encodeURIComponent(notification.postId)}${search}`;
  }

  if (notification.type === 'follow' && notification.actor?.handle) {
    return `/profile/${encodeURIComponent(notification.actor.handle)}`;
  }

  if (notification.type === 'direct_message' && notification.conversationId) {
    const search = new URLSearchParams({
      conversationId: notification.conversationId,
    });

    if (notification.messageId) {
      search.set('messageId', notification.messageId);
    }

    return `/messages?${search.toString()}`;
  }

  if (notification.type.startsWith('mentoring_')) {
    const search = new URLSearchParams();

    if (notification.mentoringApplicationId) {
      search.set('applicationId', notification.mentoringApplicationId);
    }

    if (notification.mentoringReviewId) {
      search.set('reviewId', notification.mentoringReviewId);
    }

    const query = search.toString();
    return query ? `/mentoring?${query}` : '/mentoring';
  }

  return null;
}

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord[]) {
  const seen = new Set(current.map((notification) => notification.notificationId));
  return [...current, ...incoming.filter((notification) => !seen.has(notification.notificationId))];
}

export function NotificationPanel({ onClose, onUnreadCountChange }: NotificationPanelProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncUnreadCount = async () => {
    const count = await fetchUnreadNotificationCount();
    setUnreadCount(count);
    onUnreadCountChange?.(count);
  };

  useEffect(() => {
    let cancelled = false;

    const loadInitialNotifications = async () => {
      try {
        setLoading(true);
        setError(null);
        const [page, count] = await Promise.all([
          fetchNotifications(null, PAGE_SIZE),
          fetchUnreadNotificationCount(),
        ]);

        if (cancelled) {
          return;
        }

        setNotifications(page.items);
        setNextCursor(page.nextCursor);
        setHasNext(page.hasNext);
        setUnreadCount(count);
        onUnreadCountChange?.(count);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '알림을 불러오지 못했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInitialNotifications();

    return () => {
      cancelled = true;
    };
  }, [onUnreadCountChange]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchNotifications(nextCursor, PAGE_SIZE);
      setNotifications((current) => mergeNotifications(current, page.items));
      setNextCursor(page.nextCursor);
      setHasNext(page.hasNext);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : '알림을 더 불러오지 못했습니다.');
    } finally {
      setLoadingMore(false);
    }
  };

  const markAsRead = async (notification: NotificationRecord) => {
    if (notification.read) {
      return;
    }

    setPendingReadId(notification.notificationId);
    setNotifications((current) =>
      current.map((item) =>
        item.notificationId === notification.notificationId ? { ...item, read: true } : item,
      ),
    );
    setUnreadCount((current) => {
      const next = Math.max(0, current - 1);
      onUnreadCountChange?.(next);
      return next;
    });

    try {
      await markNotificationRead(notification.notificationId);
      await syncUnreadCount();
    } catch (readError) {
      setNotifications((current) =>
        current.map((item) =>
          item.notificationId === notification.notificationId ? { ...item, read: false } : item,
        ),
      );
      await syncUnreadCount().catch(() => undefined);
      throw readError;
    } finally {
      setPendingReadId(null);
    }
  };

  const handleNotificationClick = async (notification: NotificationRecord) => {
    const href = getNotificationHref(notification);

    try {
      await markAsRead(notification);
    } catch (readError) {
      alert(readError instanceof Error ? readError.message : '알림 읽음 처리에 실패했습니다.');
      return;
    }

    if (!href) {
      return;
    }

    onClose();
    router.push(href);
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0 || markingAll) {
      return;
    }

    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
      setUnreadCount(0);
      onUnreadCountChange?.(0);
      await syncUnreadCount();
    } catch (markAllError) {
      alert(markAllError instanceof Error ? markAllError.message : '전체 읽음 처리에 실패했습니다.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed right-4 top-20 z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[28px] border border-zinc-100 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-black dark:text-zinc-100" />
            <div>
              <h2 className="text-lg font-black text-black dark:text-zinc-100">알림</h2>
              <p className="text-[11px] font-bold text-zinc-400">읽지 않은 알림 {unreadCount}개</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black dark:hover:bg-neutral-800 dark:hover:text-zinc-100"
            aria-label="알림 닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[450px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-5 py-16 text-sm font-black text-zinc-400">
              <Loader2 size={18} className="animate-spin" />
              알림을 불러오는 중
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-black text-red-500">{error}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <Bell size={24} className="mx-auto text-zinc-300" />
              <p className="mt-3 text-sm font-black text-zinc-400">아직 알림이 없습니다.</p>
            </div>
          ) : (
            notifications.map((notification) => {
              const actorName = notification.actor?.nickname ?? 'GamerIN';
              const href = getNotificationHref(notification);
              const pending = pendingReadId === notification.notificationId;

              return (
                <button
                  key={notification.notificationId}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  disabled={pending}
                  className={`flex w-full cursor-pointer items-start gap-4 border-b border-zinc-50 p-5 text-left transition hover:bg-zinc-50 disabled:cursor-wait dark:border-neutral-800 dark:hover:bg-neutral-800 ${
                    !notification.read ? 'bg-[#f5b93d]/10' : ''
                  } ${!href ? 'cursor-default' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-black text-xs font-black text-white shadow-lg">
                      {notification.actor?.profileImageUrl ? (
                        <Image
                          src={notification.actor.profileImageUrl}
                          alt={actorName}
                          fill
                          unoptimized
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : (
                        getInitials(actorName)
                      )}
                    </div>
                    {!notification.read ? (
                      <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-neutral-900" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-zinc-700 dark:text-zinc-200">
                      {getNotificationMessage(notification)}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-zinc-400">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>

                  <div className="shrink-0 self-center">{getNotificationIcon(notification.type)}</div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 p-4 dark:bg-neutral-950">
          <button
            type="button"
            onClick={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0 || markingAll}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-xs font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-[#f5b93d] dark:text-black dark:hover:bg-[#f8c957] dark:disabled:bg-neutral-800 dark:disabled:text-zinc-500"
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            모두 읽음
          </button>
          {hasNext ? (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-zinc-300 dark:hover:border-zinc-400"
            >
              {loadingMore ? '로딩 중' : '더보기'}
            </button>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
