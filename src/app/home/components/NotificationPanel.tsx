'use client';

import { useToast } from '@/app/context/ToastContext';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
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
} from '@/lib/notification-api';
import {
  getNotificationPresentation,
  type NotificationIconKind,
} from '@/lib/notification-presentation';
import { subscribeToNotificationInvalidation } from '@/lib/notification-sync';
import { getInitials } from '@/lib/feed-api';
import { RelativeTime } from './RelativeTime';
import { MembershipBadge } from './MembershipBadge';

interface NotificationPanelProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  id?: string;
  panelRef?: RefObject<HTMLDivElement | null>;
}

const PAGE_SIZE = 20;

function getNotificationIcon(kind: NotificationIconKind) {
  switch (kind) {
    case 'heart':
      return <Heart size={16} className="fill-red-500 text-red-500" />;
    case 'message-circle':
      return <MessageCircle size={16} className="text-zinc-900 dark:text-zinc-100" />;
    case 'user-plus':
      return <UserPlus size={16} className="text-blue-500" />;
    case 'repeat':
      return <Repeat2 size={16} className="text-emerald-600" />;
    case 'mail':
      return <Mail size={16} className="text-violet-500" />;
    case 'at-sign':
      return <AtSign size={16} className="text-[#d69a1f]" />;
    case 'star':
      return <Star size={16} className="fill-[#f5b93d] text-[#d69a1f]" />;
    case 'graduation-cap':
      return <GraduationCap size={16} className="text-zinc-700 dark:text-zinc-200" />;
    case 'bell':
      return <Bell size={16} className="text-zinc-500" />;
  }
}

function mergeNotifications(current: NotificationRecord[], incoming: NotificationRecord[]) {
  const seen = new Set<string>();
  return [...current, ...incoming].filter((notification) => {
    if (seen.has(notification.notificationId)) return false;
    seen.add(notification.notificationId);
    return true;
  });
}

export function NotificationPanel({ onClose, onUnreadCountChange, id, panelRef }: NotificationPanelProps) {
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
      { root: listRef.current, rootMargin: '200px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNext, nextCursor]);

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
      updateUnreadCount(0);
      await syncUnreadCount().catch(() => undefined);
    } catch (markAllError) {
      toast.error(markAllError instanceof Error ? markAllError.message : '전체 읽음 처리에 실패했습니다.');
    } finally {
      setMarkingAll(false);
    }
  };

  // 헤더(z-40)의 쌓임 맥락에 갇히면 하단 탭바(z-40)에 가려지므로 body로 렌더링한다.
  return createPortal(
    <>
      <div className="fixed inset-0 z-[60]" onClick={onClose} />

      <motion.div
        id={id}
        ref={panelRef}
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed right-4 top-20 z-[70] flex max-h-[calc(100dvh-6rem)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-2xl dark:border-line dark:bg-surface"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-100 bg-white p-5 dark:border-line dark:bg-surface">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-black dark:text-zinc-100" />
            <div>
              <h2 className="text-lg font-black text-black dark:text-zinc-100">알림</h2>
              <p className="text-xs font-bold text-zinc-400">읽지 않은 알림 {unreadCount}개</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black dark:hover:bg-surface-elevated dark:hover:text-zinc-100"
            aria-label="알림 닫기"
          >
            <X size={20} />
          </button>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
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
              const presentation = getNotificationPresentation(notification);
              const href = presentation.href;
              const pending = pendingReadId === notification.notificationId;

              return (
                <button
                  key={notification.notificationId}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  disabled={pending}
                  className={`flex w-full cursor-pointer items-start gap-3 border-b border-zinc-50 px-5 py-4 text-left transition hover:bg-zinc-50 disabled:cursor-wait dark:border-line dark:hover:bg-surface-elevated ${!href ? 'cursor-default' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-black text-xs font-black text-white dark:bg-avatar dark:text-zinc-200">
                      {notification.actor?.profileImageUrl ? (
                        <Image
                          src={notification.actor.profileImageUrl}
                          alt={actorName}
                          fill
                          unoptimized
                          sizes="40px"
                          className="object-cover"
                        />
                      ) : (
                        getInitials(actorName)
                      )}
                    </div>
                    {/* 알림 종류는 아바타 모서리 배지로 보여 준다. */}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ring-1 ring-zinc-100 dark:bg-surface dark:ring-line [&_svg]:h-3 [&_svg]:w-3">
                      {getNotificationIcon(presentation.iconKind)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm leading-snug ${notification.read ? 'font-medium text-zinc-500' : 'font-bold text-black dark:text-zinc-100'}`}>
                      {notification.actor?.membershipBadge ? (
                        <span className="mr-1 inline-flex align-middle"><MembershipBadge active /></span>
                      ) : null}
                      {presentation.message}
                    </p>
                    <p className="mt-1 text-xs font-bold text-zinc-400">
                      <RelativeTime createdAt={notification.createdAt} />
                    </p>
                  </div>

                  {!notification.read ? (
                    <span aria-label="읽지 않음" className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  ) : null}
                </button>
              );
            })
          )}
          {hasNext ? <div ref={sentinelRef} aria-hidden="true" className="h-px" /> : null}
          {loadingMore ? (
            <div role="status" className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-zinc-400">
              <Loader2 size={14} className="animate-spin" />
              불러오는 중
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 bg-zinc-50 p-4 dark:bg-background">
          <button
            type="button"
            onClick={() => void handleMarkAllAsRead()}
            disabled={unreadCount === 0 || markingAll}
            className="btn-primary flex-1"
          >
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            모두 읽음
          </button>
        </div>
      </motion.div>
    </>,
    document.body,
  );
}
