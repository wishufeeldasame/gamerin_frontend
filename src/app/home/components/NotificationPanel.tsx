'use client';

import { useToast } from '@/app/context/ToastContext';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  AtSign,
  Bell,
  CheckCheck,
  ChevronLeft,
  GraduationCap,
  Heart,
  Loader2,
  Mail,
  MessageCircle,
  Repeat2,
  Star,
  UserPlus,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
} from '@/lib/notification-api';
import {
  getNotificationPresentation,
  type NotificationIconKind,
} from '@/lib/notification-presentation';
import { subscribeToNotificationInvalidation } from '@/lib/notification-sync';
import { RelativeTime } from './RelativeTime';
import { MembershipBadge } from './MembershipBadge';
import { RepresentativeTierBadge } from './RepresentativeTierBadge';

interface NotificationPanelProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  id?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
  // panel: 데스크톱 사이드바 슬라이드 패널(닫기 버튼), page: 모바일 알림 페이지(뒤로 버튼).
  variant?: 'panel' | 'page';
}

const PAGE_SIZE = 20;

const NOTIFICATION_ICONS: Record<NotificationIconKind, LucideIcon> = {
  heart: Heart,
  'message-circle': MessageCircle,
  'user-plus': UserPlus,
  repeat: Repeat2,
  mail: Mail,
  'at-sign': AtSign,
  star: Star,
  'graduation-cap': GraduationCap,
  bell: Bell,
};

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord[]) {
  const seen = new Set<string>();
  return [...current, ...incoming].filter((notification) => {
    if (seen.has(notification.notificationId)) return false;
    seen.add(notification.notificationId);
    return true;
  });
}

export function NotificationPanel({ onClose, onUnreadCountChange, id, panelRef, variant = 'panel' }: NotificationPanelProps) {
  const toast = useToast();
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadCountRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingReadId, setPendingReadId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstPageAbortRef = useRef<AbortController | null>(null);
  const loadMoreAbortRef = useRef<AbortController | null>(null);

  const updateUnreadCount = useCallback((count: number) => {
    unreadCountRef.current = count;
    setUnreadCount(count);
    onUnreadCountChange?.(count);
  }, [onUnreadCountChange]);

  const syncUnreadCount = async () => {
    const count = await fetchUnreadNotificationCount();
    updateUnreadCount(count);
  };

  const loadFirstPage = useCallback(async (background = false) => {
    if (background && firstPageAbortRef.current) return;

    firstPageAbortRef.current?.abort();
    loadMoreAbortRef.current?.abort();
    loadMoreAbortRef.current = null;
    setLoadingMore(false);
    const controller = new AbortController();
    firstPageAbortRef.current = controller;

    try {
      if (!background) {
        setLoading(true);
      }
      setError(null);
      const [page, count] = await Promise.all([
        fetchNotifications(null, PAGE_SIZE, { signal: controller.signal }),
        fetchUnreadNotificationCount({ signal: controller.signal }),
      ]);

      if (controller.signal.aborted) return;

      setNotifications(mergeNotifications([], page.items));
      setNextCursor(page.nextCursor);
      setHasNext(Boolean(page.hasNext && page.nextCursor));
      updateUnreadCount(count);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;

      if (!background) {
        setError(loadError instanceof Error ? loadError.message : '알림을 불러오지 못했습니다.');
      }
    } finally {
      if (firstPageAbortRef.current === controller) {
        firstPageAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [updateUnreadCount]);

  useEffect(() => {
    void loadFirstPage();

    const unsubscribe = subscribeToNotificationInvalidation(() => {
      void loadFirstPage(true);
    });


    return () => {
      unsubscribe();
      firstPageAbortRef.current?.abort();
      firstPageAbortRef.current = null;
      loadMoreAbortRef.current?.abort();
      loadMoreAbortRef.current = null;
    };
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    const controller = new AbortController();
    loadMoreAbortRef.current = controller;

    try {
      setLoadingMore(true);
      const page = await fetchNotifications(nextCursor, PAGE_SIZE, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setNotifications((current) => mergeNotifications(current, page.items));
      setNextCursor(page.nextCursor);
      setHasNext(Boolean(page.hasNext && page.nextCursor));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      toast.error(loadError instanceof Error ? loadError.message : '알림을 더 불러오지 못했습니다.');
    } finally {
      if (loadMoreAbortRef.current === controller) {
        loadMoreAbortRef.current = null;
        setLoadingMore(false);
      }
    }
  };

  // 목록 끝에 닿으면 다음 쪽을 이어 불러온다.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNext || !nextCursor) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMoreRef.current();
      },
      // 페이지는 문서 전체가 스크롤되므로 화면을, 패널은 목록 상자를 기준으로 본다.
      { root: variant === 'page' ? null : listRef.current, rootMargin: '200px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNext, nextCursor, variant]);

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
    updateUnreadCount(Math.max(0, unreadCountRef.current - 1));

    try {
      await markNotificationRead(notification.notificationId);
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

    await syncUnreadCount().catch(() => undefined);
  };

  const handleNotificationClick = async (notification: NotificationRecord) => {
    const href = getNotificationPresentation(notification).href;

    try {
      await markAsRead(notification);
    } catch (readError) {
      toast.error(readError instanceof Error ? readError.message : '알림 읽음 처리에 실패했습니다.');
      return;
    }

    if (!href) {
      return;
    }

    // 페이지의 onClose는 뒤로 가기라, 이동과 함께 부르면 기록이 엉킨다. 패널만 닫고 이동한다.
    if (variant === 'panel') onClose();
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
      updateUnreadCount(0);
      await syncUnreadCount().catch(() => undefined);
    } catch (markAllError) {
      toast.error(markAllError instanceof Error ? markAllError.message : '전체 읽음 처리에 실패했습니다.');
    } finally {
      setMarkingAll(false);
    }
  };

  const markAllButton = (
    <button
      type="button"
      onClick={() => void handleMarkAllAsRead()}
      disabled={unreadCount === 0 || markingAll}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2 text-label text-fg-brand transition hover:bg-subtle disabled:cursor-not-allowed disabled:text-fg-tertiary disabled:hover:bg-transparent"
    >
      {markingAll ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} strokeWidth={1.67} />}
      모두 읽음
    </button>
  );

  return (
    <div
      id={id}
      ref={panelRef}
      className={`flex flex-col ${variant === 'page' ? 'bg-canvas lg:rounded-card lg:bg-surface' : 'h-full min-h-0 bg-surface'}`}
    >
      <div
        className={`flex shrink-0 items-center gap-2 border-b border-line ${
          variant === 'page'
            ? 'sticky top-0 z-10 bg-canvas px-2 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] lg:static lg:rounded-t-card lg:bg-surface lg:px-6 lg:pt-5'
            : 'bg-surface px-6 py-5'
        }`}
      >
        {variant === 'page' ? (
          <button
            type="button"
            onClick={onClose}
            className="btn-icon text-icon-primary"
            aria-label="뒤로 가기"
          >
            <ChevronLeft size={24} strokeWidth={1.67} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-title text-fg-primary">알림</h2>
          <p className="text-caption text-fg-tertiary">읽지 않은 알림 {unreadCount}개</p>
        </div>
        {markAllButton}
        {variant === 'panel' ? (
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            aria-label="알림 닫기"
            data-autofocus
          >
            <X size={20} strokeWidth={1.67} />
          </button>
        ) : null}
      </div>

      <div ref={listRef} className={variant === 'page' ? undefined : 'min-h-0 flex-1 overflow-y-auto'}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-16 text-label text-fg-tertiary">
            <Loader2 size={18} className="animate-spin" />
            알림을 불러오는 중
          </div>
        ) : error ? (
          <div className="px-5 py-12 text-center">
            <p className="text-label text-fg-danger">{error}</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Bell size={24} strokeWidth={1.67} className="mx-auto text-icon-secondary" />
            <p className="mt-3 text-label text-fg-tertiary">아직 알림이 없습니다.</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const presentation = getNotificationPresentation(notification);
            const href = presentation.href;
            const pending = pendingReadId === notification.notificationId;
            const Icon = NOTIFICATION_ICONS[presentation.iconKind];

            return (
              <button
                key={notification.notificationId}
                type="button"
                onClick={() => void handleNotificationClick(notification)}
                disabled={pending}
                className={`flex w-full cursor-pointer items-start gap-3 px-5 py-3.5 text-left transition hover:bg-subtle disabled:cursor-wait ${!href ? 'cursor-default' : ''}`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-icon-brand">
                  <Icon size={18} strokeWidth={1.67} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-body text-fg-primary">
                    {notification.actor?.membershipBadge || notification.actor?.representativeTier ? (
                      <span className="mr-1 inline-flex items-center gap-0.5 align-middle">
                        <MembershipBadge active={notification.actor.membershipBadge} />
                        <RepresentativeTierBadge tier={notification.actor.representativeTier} />
                      </span>
                    ) : null}
                    {presentation.message}
                  </p>
                  <p className="mt-0.5 text-caption text-fg-tertiary">
                    <RelativeTime createdAt={notification.createdAt} />
                  </p>
                </div>

                {!notification.read ? (
                  <span aria-label="읽지 않음" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand" />
                ) : null}
              </button>
            );
          })
        )}
        {hasNext ? <div ref={sentinelRef} aria-hidden="true" className="h-px" /> : null}
        {loadingMore ? (
          <div role="status" className="flex items-center justify-center gap-2 py-4 text-caption text-fg-tertiary">
            <Loader2 size={14} className="animate-spin" />
            불러오는 중
          </div>
        ) : null}
      </div>
    </div>
  );
}
