'use client';

import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { requestLogin } from '@/lib/login-prompt';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Search } from 'lucide-react';
import { useDesktopChange } from '@/hooks/useDesktopChange';
import { SearchPanel } from './SearchPanel';

// 전체 화면 검색(F9). 다른 모달처럼 네이티브 dialog의 showModal로 열어 배경을 비활성화(inert)하고 포커스를 안에 가둔다.
function FullscreenSearch({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // showModal은 첫 버튼(닫기)에 포커스를 준다. 바로 입력할 수 있게 입력창으로 옮긴다.
    dialog?.querySelector('input')?.focus();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  // 모달이 열려 있는 동안 배경은 inert라 검색 버튼이 포커스를 받지 못한다. 먼저 닫고 나서 부모가 포커스를 돌린다.
  const close = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="검색"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
      className="m-0 h-dvh max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-transparent"
    >
      <SearchPanel variant="fullscreen" onClose={close} />
    </dialog>
  );
}

// lg 미만 상단 바(F9): 로고·검색·알림. 검색은 전체 화면 패널, 알림은 /notifications 페이지로 연다.
export function MobileTopBar({ unreadCount }: { unreadCount: number }) {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchTriggerRef.current?.focus();
  }, []);
  // 데스크톱 폭으로 넓히면 상단 바가 사라지므로 열린 검색도 닫는다(배경이 inert로 남지 않게).
  useDesktopChange((isDesktop) => {
    if (isDesktop) setSearchOpen(false);
  }, searchOpen);

  return (
    <header data-mobile-top-bar data-view-occluder="top" className="fixed inset-x-0 top-0 z-40 bg-canvas pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)] lg:hidden">
      <div className="flex h-14 items-center gap-1 px-4">
        <Link href="/" className="mr-auto text-title text-fg-primary">
          Gamer<span className="text-[#F8C24A]">IN</span>
        </Link>
        {pathname !== '/search' ? (
          <button
            type="button"
            ref={searchTriggerRef}
            onClick={() => { if (requireAuth('검색하려면 로그인이 필요해요.')) setSearchOpen(true); }}
            className="btn-icon text-icon-primary"
            aria-label="검색 열기"
            aria-expanded={searchOpen}
          >
            <Search size={22} strokeWidth={1.67} />
          </button>
        ) : null}
        {!user ? <button type="button" className="btn-secondary shrink-0" onClick={() => requestLogin()}>로그인</button> : null}
        <Link
          href="/notifications"
          className="btn-icon relative text-icon-primary"
          aria-label={unreadCount > 0 ? `알림, 읽지 않은 알림 ${unreadCount}개` : '알림'}
        >
          <Bell size={22} strokeWidth={1.67} />
          {unreadCount > 0 ? <span aria-hidden="true" className="absolute right-2 top-2 h-2 w-2 rounded-full bg-brand ring-2 ring-canvas" /> : null}
        </Link>
      </div>

      {/* lg:hidden인 header 밖(body)에 그려야 dialog가 숨겨진 조상에 묶이지 않는다. */}
      {searchOpen ? createPortal(<FullscreenSearch onClose={closeSearch} />, document.body) : null}
    </header>
  );
}
