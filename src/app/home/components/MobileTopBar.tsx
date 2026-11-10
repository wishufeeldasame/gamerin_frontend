'use client';

import Link from 'next/link';
import { useAuth } from '@/app/context/AuthContext';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { requestLogin } from '@/lib/login-prompt';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, Crown, LogOut, Menu, Moon, Search, Settings, Sun, WalletCards, X } from 'lucide-react';
import { useDesktopChange } from '@/hooks/useDesktopChange';
import { useThemeToggle } from '@/hooks/useThemeToggle';
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

const menuLinks = [
  { icon: Bookmark, label: '북마크', href: '/bookmarks' },
  { icon: Crown, label: '멤버십', href: '/membership' },
  { icon: WalletCards, label: '지갑', href: '/wallet' },
  { icon: Settings, label: '설정', href: '/settings' },
];
const MENU_ITEM = 'flex h-12 w-full items-center gap-3 rounded-control px-3 text-label transition hover:bg-subtle';

// 오른쪽에서 나오는 메뉴. 검색과 같이 네이티브 dialog의 showModal로 배경 비활성화와 포커스 가두기를 맡긴다.
function SideMenu({ onClose }: { onClose: () => void }) {
  const { logout } = useAuth();
  const { theme, toggle: toggleTheme } = useThemeToggle();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const close = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="메뉴"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      // 패널 밖(backdrop)을 누르면 dialog 자신이 target이 된다.
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-[min(18rem,85vw)] max-w-none translate-x-0 border-0 bg-surface p-0 transition-transform duration-200 backdrop:bg-black/60 motion-reduce:transition-none starting:translate-x-full"
    >
      <div className="flex h-full flex-col px-3 pb-[env(safe-area-inset-bottom)] pr-[calc(0.75rem+env(safe-area-inset-right))] pt-[env(safe-area-inset-top)]">
        <div className="flex h-14 items-center justify-between pl-3">
          <h2 className="text-heading text-fg-primary">메뉴</h2>
          <button type="button" onClick={close} className="btn-icon text-icon-primary" aria-label="메뉴 닫기">
            <X size={22} strokeWidth={1.67} />
          </button>
        </div>
        <nav aria-label="메뉴">
          <ul className="space-y-1">
            {menuLinks.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={close} className={`${MENU_ITEM} text-fg-primary`}>
                  <item.icon size={20} strokeWidth={1.67} className="text-icon-secondary" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <button
          type="button"
          onClick={() => {
            close();
            void logout();
          }}
          className={`${MENU_ITEM} mt-2 border-t border-line text-fg-danger`}
        >
          <LogOut size={20} strokeWidth={1.67} aria-hidden="true" />
          로그아웃
        </button>
        <button
          type="button"
          onClick={() => void toggleTheme()}
          className="btn-icon mb-3 ml-auto mt-auto text-icon-primary"
          aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
        >
          {theme === 'dark' ? <Sun size={22} strokeWidth={1.67} /> : <Moon size={22} strokeWidth={1.67} />}
        </button>
      </div>
    </dialog>
  );
}

// lg 미만 상단 바(F9): 로고·검색·메뉴. 검색은 전체 화면 패널로 연다. 알림은 하단 탭에 있다.
export function MobileTopBar() {
  const { user } = useAuth();
  const requireAuth = useRequireAuth();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    searchTriggerRef.current?.focus();
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
  }, []);
  // 데스크톱 폭으로 넓히면 상단 바가 사라지므로 열린 검색·메뉴도 닫는다(배경이 inert로 남지 않게).
  useDesktopChange((isDesktop) => {
    if (!isDesktop) return;
    setSearchOpen(false);
    setMenuOpen(false);
  }, searchOpen || menuOpen);

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
        {user ? (
          <button
            type="button"
            ref={menuTriggerRef}
            onClick={() => setMenuOpen(true)}
            className="btn-icon text-icon-primary"
            aria-label="메뉴 열기"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
          >
            <Menu size={22} strokeWidth={1.67} />
          </button>
        ) : null}
      </div>

      {/* lg:hidden인 header 밖(body)에 그려야 dialog가 숨겨진 조상에 묶이지 않는다. */}
      {searchOpen ? createPortal(<FullscreenSearch onClose={closeSearch} />, document.body) : null}
      {menuOpen ? createPortal(<SideMenu onClose={closeMenu} />, document.body) : null}
    </header>
  );
}
