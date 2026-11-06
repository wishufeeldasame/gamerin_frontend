'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Bell, Bookmark, BookOpen, Home, LogOut, MessageSquare, MoreHorizontal, Search, User, WalletCards } from 'lucide-react';
import { getInitials } from '@/lib/feed-api';
import { useAuth } from '@/app/context/AuthContext';
import { usePopup } from '@/app/context/PopupContext';
import { useDismissable } from '@/hooks/useDismissable';
import { useDesktopChange } from '@/hooks/useDesktopChange';
import { useMileageBalance } from '@/hooks/useMileageBalance';
import { MembershipBadge } from './MembershipBadge';
import { RepresentativeTierBadge } from './RepresentativeTierBadge';
import { NotificationPanel } from './NotificationPanel';
import { SearchPanel } from './SearchPanel';

const menuItems = [
  { icon: Home, label: '홈', href: '/home' },
  { icon: Bookmark, label: '북마크', href: '/bookmarks' },
  { icon: MessageSquare, label: '메시지', href: '/messages' },
  { icon: BookOpen, label: '멘토링', href: '/mentoring' },
  { icon: User, label: '프로필', href: '/profile' },
];

// 셸 치수(F4). (app)/layout.tsx의 max-w-[1212px]·w-[248px]와 같은 값이어야 패널이 사이드바 오른쪽 끝에 붙는다.
export const SHELL_MAX_WIDTH = 1212;
export const SIDEBAR_WIDTH = 248;
const PANEL_LEFT = `calc(max(0px, (100% - ${SHELL_MAX_WIDTH}px) / 2) + ${SIDEBAR_WIDTH}px)`;

// Sidebar(데스크톱)와 MobileTabBar(lg 미만)가 같은 메뉴·활성 규칙을 쓴다.
function useMenuLinks() {
  const pathname = usePathname();
  const { user } = useAuth();
  const profileHref = `/profile/${encodeURIComponent(user?.handle || user?.id || 'me')}`;

  return menuItems.map((item) => {
    const href = item.href === '/profile' ? profileHref : item.href;
    const isActive = item.href === '/profile' ? pathname.startsWith('/profile') : pathname === href;
    return { ...item, href, isActive };
  });
}

export function MobileTabBar() {
  const links = useMenuLinks();

  return (
    <nav
      aria-label="주요 메뉴"
      data-mobile-tab-bar
      data-view-occluder="bottom"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {links.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              aria-current={item.isActive ? 'page' : undefined}
              className={`flex h-full flex-col items-center justify-center gap-1 text-caption ${
                item.isActive ? 'font-medium text-fg-primary' : 'text-fg-tertiary'
              }`}
            >
              <item.icon size={22} strokeWidth={1.67} className={item.isActive ? 'text-icon-brand' : undefined} />
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const navItemClass = (active: boolean) =>
  `flex h-11 w-full items-center gap-3 rounded-control px-3.5 text-body transition focus-visible:outline-2 focus-visible:outline-line-focus ${
    active ? 'bg-nav-active font-bold text-fg-primary' : 'text-fg-secondary hover:bg-subtle hover:text-fg-primary'
  }`;

function NavIcon({ icon: Icon, active }: { icon: typeof Home; active: boolean }) {
  return <Icon size={20} strokeWidth={1.67} className={`shrink-0 ${active ? 'text-icon-brand' : 'text-icon-secondary'}`} />;
}

// 사이드바 오른쪽 끝에서 밀려 나오는 폭 400 패널(F5). 스크림은 사이드바를 뺀 영역만 덮는다.
function SlidePanel({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return createPortal(
    <>
      <div aria-hidden="true" className="fixed inset-y-0 right-0 z-[60] bg-black/50" style={{ left: PANEL_LEFT }} />
      <div className="fixed inset-y-0 z-[70] w-[400px] overflow-hidden shadow-2xl" style={{ left: PANEL_LEFT }}>
        <motion.div
          className="h-full"
          initial={{ x: '-100%' }}
          animate={{ x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.22, ease: 'easeOut' }}
        >
          {children}
        </motion.div>
      </div>
    </>,
    document.body,
  );
}

function useShellPopup() {
  const id = useId();
  const popup = usePopup(id);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { close } = popup;
  const closeAndRestoreFocus = useCallback(() => {
    close();
    triggerRef.current?.focus();
  }, [close]);
  useDismissable({ open: popup.isOpen, onDismiss: close, triggerRef, panelRef });
  return { id, ...popup, triggerRef, panelRef, closeAndRestoreFocus };
}

function AccountCard() {
  const { user, logout } = useAuth();
  const balance = useMileageBalance(user?.id, 'desktop');
  const menu = useShellPopup();

  if (!user) return null;

  return (
    <div className="rounded-card border border-line-card bg-surface p-3">
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-caption font-medium text-fg-secondary">
          {user.profileImageUrl ? (
            <Image src={user.profileImageUrl} alt={user.nickname} fill unoptimized sizes="36px" className="object-cover" />
          ) : (
            getInitials(user.nickname ?? '', 'U')
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-label font-bold text-fg-primary">
            <span className="truncate">{user.nickname}</span>
            <MembershipBadge active={user.membershipBadge} /><RepresentativeTierBadge tier={user.representativeTier} />
          </p>
          {user.handle ? <p className="truncate text-caption text-fg-tertiary">@{user.handle}</p> : null}
        </div>
        <div className="relative">
          <button
            type="button"
            ref={menu.triggerRef}
            onClick={menu.toggle}
            className="btn-icon h-8 w-8"
            aria-label="계정 메뉴"
            aria-haspopup="menu"
            aria-expanded={menu.isOpen}
            aria-controls={menu.isOpen ? menu.id : undefined}
          >
            <MoreHorizontal size={18} strokeWidth={1.67} />
          </button>
          {menu.isOpen ? (
            <div
              id={menu.id}
              ref={menu.panelRef}
              role="menu"
              className="absolute bottom-full right-0 z-10 mb-2 w-40 rounded-control bg-surface-elevated p-1 shadow-xl ring-1 ring-line"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  menu.close();
                  void logout();
                }}
                className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-label text-fg-danger transition hover:bg-danger-subtle"
              >
                <LogOut size={16} strokeWidth={1.67} />
                로그아웃
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
        <WalletCards size={20} strokeWidth={1.67} className="shrink-0 text-icon-secondary" />
        <div className="min-w-0 flex-1">
          <p className="text-caption text-fg-tertiary">마일리지</p>
          <p className="text-heading text-fg-primary">{balance === null ? '—' : balance.toLocaleString('ko-KR')}</p>
        </div>
        <Link
          href="/wallet"
          className="inline-flex h-9 items-center rounded-control px-2 text-label text-fg-brand transition hover:bg-subtle"
        >
          충전
        </Link>
      </div>
    </div>
  );
}

interface SidebarProps {
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

export function Sidebar({ unreadCount, onUnreadCountChange }: SidebarProps) {
  const links = useMenuLinks();
  const search = useShellPopup();
  const notification = useShellPopup();
  const panelOpen = search.isOpen || notification.isOpen;
  // 패널은 body에 그려서 사이드바가 숨겨져도 남는다. 모바일 폭으로 줄이면 닫는다.
  const { close: closeSearch } = search;
  const { close: closeNotification } = notification;
  useDesktopChange((isDesktop) => {
    if (isDesktop) return;
    closeSearch();
    closeNotification();
  }, panelOpen);
  const notificationOpen = notification.isOpen;
  const notificationPanelRef = notification.panelRef;
  useEffect(() => {
    // 검색 패널은 입력창이 스스로 포커스를 받는다. 알림 패널은 닫기 버튼으로 옮긴다.
    if (notificationOpen) notificationPanelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [notificationOpen, notificationPanelRef]);
  // 패널이 열려 있으면 그 메뉴만 활성으로 보인다(F5).
  const [home, ...rest] = links.map((item) => ({ ...item, isActive: item.isActive && !panelOpen }));
  // 검색 결과·해시태그 화면에서는 패널이 닫혀 있어도 검색 메뉴를 활성으로 둔다(시안).
  const pathname = usePathname();
  const onSearchRoute = !panelOpen && (pathname === '/search' || pathname.startsWith('/hashtags/'));

  const linkItem = (item: (typeof links)[number]) => (
    <li key={item.label}>
      <Link href={item.href} aria-current={item.isActive ? 'page' : undefined} className={navItemClass(item.isActive)}>
        <NavIcon icon={item.icon} active={item.isActive} />
        {item.label}
      </Link>
    </li>
  );

  const panelButton = (
    popup: ReturnType<typeof useShellPopup>,
    icon: typeof Home,
    label: string,
    badge?: ReactNode,
    active = popup.isOpen,
  ) => (
    <li>
      <button
        type="button"
        ref={popup.triggerRef}
        onClick={popup.toggle}
        aria-expanded={popup.isOpen}
        aria-controls={popup.isOpen ? popup.id : undefined}
        className={navItemClass(active)}
      >
        <NavIcon icon={icon} active={active} />
        {label}
        {badge}
      </button>
    </li>
  );

  return (
    <div className="flex h-full flex-col">
      <Link href="/home" className="mb-4 flex h-10 items-center px-3.5 text-title text-fg-primary">
        Gamer<span className="text-fg-brand">IN</span>
      </Link>

      <nav aria-label="주요 메뉴" className="min-h-0 flex-1">
        <ul className="space-y-1">
          {linkItem(home)}
          {panelButton(search, Search, '검색', undefined, onSearchRoute || search.isOpen)}
          {panelButton(
            notification,
            Bell,
            '알림',
            unreadCount > 0 ? (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-2xs font-bold text-fg-on-brand">
                <span aria-hidden="true">{unreadCount > 99 ? '99+' : unreadCount}</span>
                <span className="sr-only">, 읽지 않은 알림 {unreadCount}개</span>
              </span>
            ) : null,
          )}
          {rest.map(linkItem)}
        </ul>
      </nav>

      <AccountCard />

      {search.isOpen ? (
        <SlidePanel>
          <SearchPanel id={search.id} panelRef={search.panelRef} onClose={search.closeAndRestoreFocus} />
        </SlidePanel>
      ) : null}
      {notification.isOpen ? (
        <SlidePanel>
          <NotificationPanel
            id={notification.id}
            panelRef={notification.panelRef}
            onClose={notification.closeAndRestoreFocus}
            onUnreadCountChange={onUnreadCountChange}
          />
        </SlidePanel>
      ) : null}
    </div>
  );
}
