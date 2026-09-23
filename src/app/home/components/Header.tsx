'use client';

import { Bell, MessageSquare, Search, LogOut, X } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext"; // 1. 경로 확인 필수!
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationPanel } from "./NotificationPanel";
import { fetchUnreadNotificationCount } from "@/lib/notification-api";
import { subscribeToNotificationInvalidation } from "@/lib/notification-sync";
import { useVisiblePolling } from "@/hooks/useVisiblePolling";

const UNREAD_REFRESH_INTERVAL_MS = 60_000;
const UNREAD_STALE_TIME_MS = 5_000;

export function Header() {
  // 2. 전역 상태에서 유저 정보와 로그아웃 함수 가져오기
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  // md 미만에서는 검색창을 숨겨 두고 돋보기 버튼으로 헤더 아래에 펼친다.
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  // 탭바 등으로 페이지를 옮기면 펼친 검색창이 새 페이지를 가리지 않게 닫는다.
  const [searchPathname, setSearchPathname] = useState(pathname);
  if (searchPathname !== pathname) {
    setSearchPathname(pathname);
    setMobileSearchOpen(false);
  }
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [notificationUnreadCount, setNotificationUnreadCount] = useState(0);
  const unreadRequestRef = useRef<Promise<void> | null>(null);
  const unreadAbortControllerRef = useRef<AbortController | null>(null);
  const lastUnreadRefreshRef = useRef(0);

  const refreshUnreadCount = useCallback(async (force = false) => {
    if (!user) {
      unreadAbortControllerRef.current?.abort();
      unreadAbortControllerRef.current = null;
      unreadRequestRef.current = null;
      lastUnreadRefreshRef.current = 0;
      setNotificationUnreadCount(0);
      return;
    }

    if (!force && Date.now() - lastUnreadRefreshRef.current < UNREAD_STALE_TIME_MS) {
      return;
    }

    if (unreadRequestRef.current) {
      return unreadRequestRef.current;
    }

    const controller = new AbortController();
    unreadAbortControllerRef.current = controller;

    const request = fetchUnreadNotificationCount({ signal: controller.signal })
      .then((count) => {
        if (!controller.signal.aborted) {
          setNotificationUnreadCount(count);
          lastUnreadRefreshRef.current = Date.now();
        }
      })
      .catch((loadError) => {
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setNotificationUnreadCount(0);
        }
      })
      .finally(() => {
        if (unreadAbortControllerRef.current === controller) {
          unreadAbortControllerRef.current = null;
          unreadRequestRef.current = null;
        }
      });

    unreadRequestRef.current = request;
    return request;
  }, [user]);

  useEffect(() => {
    void refreshUnreadCount(true);

    return () => {
      unreadAbortControllerRef.current?.abort();
      unreadAbortControllerRef.current = null;
      unreadRequestRef.current = null;
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    return subscribeToNotificationInvalidation(() => {
      void refreshUnreadCount(true);
    });
  }, [refreshUnreadCount]);

  useVisiblePolling(() => refreshUnreadCount(), {
    enabled: Boolean(user),
    intervalMs: UNREAD_REFRESH_INTERVAL_MS,
  });

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const keyword = searchQuery.trim();
    if (!keyword) {
      return;
    }

    router.push(`/search?q=${encodeURIComponent(keyword)}`);
    setMobileSearchOpen(false);
  };

  useEffect(() => {
    if (mobileSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [mobileSearchOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] border-b border-[#d69a1f] bg-[#f5b93d] dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-2 px-4 sm:gap-4 sm:px-6">
        {/* 로고 영역 */}
        <div className="min-w-0 flex-1 lg:max-w-[240px]">
          <Link
            href="/home"
            className="text-[1.6rem] font-semibold leading-none text-white sm:text-[2.05rem] dark:text-[#f5b93d]"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            GamerIN
          </Link>
        </div>

        {/* 검색 영역 */}
        <div
          className={`${
            mobileSearchOpen
              ? 'absolute inset-x-0 top-full flex border-b border-[#d69a1f] bg-[#f5b93d] px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900'
              : 'hidden'
          } flex-1 justify-start md:static md:flex md:border-0 md:bg-transparent md:p-0 md:dark:bg-transparent`}
        >
          <form
            onSubmit={handleSearchSubmit}
            role="search"
            className="flex h-10 w-full max-w-[385px] items-center gap-3 rounded-xl border border-black/10 bg-[#f3f1f7] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-neutral-700 dark:bg-neutral-800 dark:shadow-none"
          >
            <Search size={18} className="text-zinc-500 dark:text-zinc-400" strokeWidth={2.1} />
            <input
              type="text"
              value={searchQuery}
              ref={searchInputRef}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setMobileSearchOpen(false);
                }
              }}
              placeholder="게임, 플레이어, 게시글 검색..."
              aria-label="통합 검색"
              className="w-full !bg-transparent text-sm text-black caret-black outline-none placeholder:text-zinc-500 dark:!bg-transparent dark:text-zinc-100 dark:caret-zinc-100 dark:placeholder:text-zinc-400"
            />
          </form>
        </div>

        {/* 오른쪽 유저 액션 영역 */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-3 lg:max-w-md">
          {user ? (
            /* A. 로그인 상태: 알림, 메시지, 유저 아바타, 로그아웃 */
            <>
              <button
                type="button"
                onClick={() => setMobileSearchOpen((current) => !current)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5 md:hidden dark:text-zinc-200 dark:hover:bg-white/10"
                aria-label={mobileSearchOpen ? "검색 닫기" : "검색 열기"}
                aria-expanded={mobileSearchOpen}
              >
                {mobileSearchOpen ? <X size={18} strokeWidth={2.1} /> : <Search size={18} strokeWidth={2.1} />}
              </button>
              <button
                type="button"
                onClick={() => setNotificationOpen((current) => !current)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
                aria-label="알림"
                aria-expanded={notificationOpen}
              >
                <Bell size={18} strokeWidth={2.1} />
                {notificationUnreadCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-[#f5b93d] bg-red-600 px-1 text-[9px] font-black leading-none text-white dark:border-neutral-900">
                    {notificationUnreadCount}
                  </span>
                ) : null}
              </button>
              {notificationOpen ? (
                <NotificationPanel
                  onClose={() => setNotificationOpen(false)}
                  onUnreadCountChange={setNotificationUnreadCount}
                />
              ) : null}
              <Link
                href="/messages"
                className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5 dark:text-zinc-200 dark:hover:bg-white/10"
                aria-label="메시지"
              >
                <MessageSquare size={18} strokeWidth={2.1} />
              </Link>
              
              <div className="ml-1 flex items-center gap-2 border-l border-black/10 pl-2 sm:ml-2 sm:gap-3 sm:pl-3 dark:border-white/10">
                <div className="hidden lg:block text-right">
                   <p className="text-[11px] font-black text-black leading-none uppercase tracking-tighter dark:text-zinc-100">
                     {user.nickname}
                   </p>
                   <p className="text-[9px] font-bold text-black/60 uppercase mt-0.5 dark:text-zinc-400">
                     {user.gameTier}
                   </p>
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-black text-sm font-black text-white shadow-lg dark:ring-1 dark:ring-white/10">
                  {user.profileImageUrl ? (
                    <Image
                      src={user.profileImageUrl}
                      alt={user.nickname}
                      fill
                      unoptimized
                      sizes="36px"
                      className="object-cover"
                    />
                  ) : (
                    user.nickname.substring(0, 1).toUpperCase()
                  )}
                </div>
                <button 
                  onClick={() => logout()}
                  className="p-1.5 text-black/40 hover:text-black transition-colors dark:text-zinc-500 dark:hover:text-zinc-200"
                  title="로그아웃"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            /* B. 비로그인 상태: 로그인 버튼 노출 */
            <Link href="/login">
              <button className="px-5 py-2 bg-black text-white text-xs font-black rounded-xl hover:bg-zinc-800 transition-all uppercase tracking-widest shadow-lg dark:bg-[#f5b93d] dark:text-black dark:hover:bg-[#f8c957]">
                로그인
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
