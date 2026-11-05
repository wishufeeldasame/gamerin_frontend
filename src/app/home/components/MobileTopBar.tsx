'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Search } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { SearchPanel } from './SearchPanel';

// lg 미만 상단 바(F9): 로고·검색·알림. 검색은 전체 화면 패널, 알림은 /notifications 페이지로 연다.
export function MobileTopBar({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchTriggerRef.current?.focus();
  }, []);
  useEscapeKey(closeSearch, searchOpen);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-canvas pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex h-14 items-center gap-1 px-4">
        <Link href="/home" className="mr-auto text-title text-fg-primary">
          Gamer<span className="text-fg-brand">IN</span>
        </Link>
        {pathname !== '/search' ? (
          <button
            type="button"
            ref={searchTriggerRef}
            onClick={() => setSearchOpen(true)}
            className="btn-icon text-icon-primary"
            aria-label="검색 열기"
            aria-expanded={searchOpen}
          >
            <Search size={22} strokeWidth={1.67} />
          </button>
        ) : null}
        <Link
          href="/notifications"
          className="btn-icon relative text-icon-primary"
          aria-label={unreadCount > 0 ? `알림, 읽지 않은 알림 ${unreadCount}개` : '알림'}
        >
          <Bell size={22} strokeWidth={1.67} />
          {unreadCount > 0 ? <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-canvas" /> : null}
        </Link>
      </div>

      {searchOpen
        ? createPortal(
            <div role="dialog" aria-modal="true" aria-label="검색" className="fixed inset-0 z-[70] lg:hidden">
              <SearchPanel variant="fullscreen" onClose={closeSearch} />
            </div>,
            document.body,
          )
        : null}
    </header>
  );
}
