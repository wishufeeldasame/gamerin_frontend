'use client';

import {
  ClipboardList,
  FileText,
  Flag,
  Gamepad2,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/app/context/AuthContext';

export type AdminPageKey =
  | 'dashboard'
  | 'users'
  | 'content'
  | 'reports'
  | 'auditLogs'
  | 'mentoring'
  | 'settings';

type Breadcrumb = {
  label: string;
  href?: string;
};

type AdminShellProps = {
  activePage: AdminPageKey;
  title: string;
  description?: string;
  breadcrumbs?: Breadcrumb[];
  showRefresh?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
};

const navigationItems = [
  { key: 'dashboard', label: '대시보드', icon: LayoutDashboard, href: '/admin' },
  { key: 'users', label: '사용자 관리', icon: UsersRound, href: '/admin/users' },
  { key: 'content', label: '숨김 콘텐츠 관리', icon: FileText, href: '/admin/content' },
  { key: 'reports', label: '신고 관리', icon: Flag, href: '/admin/reports' },
  { key: 'auditLogs', label: '작업 이력', icon: ClipboardList, href: '/admin/audit-logs' },
  { key: 'mentoring', label: '멘토링 관리', icon: Gamepad2, href: '/admin/mentoring' },
  { key: 'settings', label: '시스템 설정', icon: Settings, href: '/admin/settings' },
] satisfies Array<{
  key: AdminPageKey;
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
}>;

type AdminSidebarProps = {
  activePage: AdminPageKey;
  className?: string;
  onNavigate?: () => void;
};

function AdminSidebar({ activePage, className = '', onNavigate }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const displayName = user?.nickname || user?.name || '관리자';
  const adminHandle = user?.handle ? `@${user.handle.replace(/^@/, '')}` : '';
  const initial = displayName.trim().charAt(0) || '관';
  return (
    <aside className={`flex h-dvh min-h-[640px] w-60 flex-col overflow-y-auto bg-[#102a56] px-4 py-6 ${className}`}>
      <Link href="/admin" onClick={onNavigate} className="flex h-[38px] items-center gap-2.5 px-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#315ef5_0%,#102a56_100%)] text-lg leading-[27px] font-black text-white">
          G
        </span>
        <span>
          <span className="block text-[15px] leading-[22.5px] font-black tracking-[-0.375px] text-white">GamerIN</span>
          <span className="block text-[10px] leading-[15px] font-semibold tracking-[1px] text-[#7b8aa8]">ADMIN CONSOLE</span>
        </span>
      </Link>

      <nav className="mt-8" aria-label="관리자 메뉴">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activePage;

            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm leading-[21px] font-semibold transition ${
                    isActive
                      ? 'bg-[#eef3ff] text-[#102a56]'
                      : 'text-[#b7c3da] hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {isActive ? <span className="absolute top-2.5 left-0 h-6 w-1 rounded-r bg-[#315ef5]" /> : null}
                  <Icon
                    className={`size-[18px] shrink-0 ${isActive ? 'text-[#315ef5]' : 'text-[#b7c3da]'}`}
                    strokeWidth={1.7}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t border-white/10 pt-[17px]">
        <div className="flex items-center gap-3 p-2">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#315ef5] text-[14px] font-bold text-white">{initial}</div>
          <div className="min-w-0">
            <p className="truncate text-[13px] leading-[19.5px] font-bold text-white">{displayName}</p>
            <p className="truncate text-[11px] leading-[16.5px] text-[#7b8aa8]">{adminHandle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void logout({ redirectTo: '/admin/login' })}
          className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-[13px] leading-[19.5px] font-semibold text-[#b7c3da] transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}

type AdminHeaderProps = Pick<
  AdminShellProps,
  'title' | 'description' | 'breadcrumbs' | 'showRefresh' | 'headerActions'
> & {
  onMenuOpen: () => void;
};

function AdminHeader({
  title,
  description,
  breadcrumbs,
  showRefresh,
  headerActions,
  onMenuOpen,
}: AdminHeaderProps) {
  const { user } = useAuth();
  const displayName = user?.nickname || user?.name || '관리자';
  const initial = displayName.trim().charAt(0) || '관';

  return (
    <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-[#e4e7ec] bg-[rgba(255,255,255,0.95)] px-4 py-3 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onMenuOpen}
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl border border-[#e4e7ec] bg-white text-[#344054] lg:hidden"
          aria-label="관리자 메뉴 열기"
        >
          <Menu className="size-5" strokeWidth={1.8} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          {breadcrumbs?.length ? (
            <nav aria-label="현재 위치" className="hidden sm:block">
              <ol className="flex items-center gap-1.5 text-xs leading-[18px]">
                {breadcrumbs.map((item, index) => (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
                    {index > 0 ? <span className="text-[#d0d5dd]">/</span> : null}
                    {item.href ? (
                      <Link href={item.href} className="text-[#667085] hover:text-[#315ef5]">{item.label}</Link>
                    ) : (
                      <span className="text-[#98a2b3]">{item.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <h1 className="truncate text-xl leading-[30px] font-bold tracking-[-0.5px] text-[#172033] sm:text-[22px] sm:leading-[33px]">{title}</h1>
          {description ? <p className="mt-0.5 hidden text-[13px] leading-[19.5px] text-[#667085] sm:block">{description}</p> : null}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        {headerActions}
        {showRefresh && !headerActions ? (
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-2xl border border-[#d0d5dd] bg-white px-3 text-[13px] font-semibold text-[#344054] transition hover:bg-[#f9fafb]"
            onClick={() => window.location.reload()}
            aria-label="화면 새로고침"
          >
            <RefreshCw className="size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden sm:inline">새로고침</span>
          </button>
        ) : null}
        <div className="hidden items-center gap-2 border-l border-[#e4e7ec] pl-[13px] md:flex">
          <div className="grid size-8 place-items-center rounded-full bg-[#315ef5] text-[12.8px] font-bold text-white">{initial}</div>
          <div>
            <p className="text-xs leading-[15px] font-bold text-[#172033]">{displayName}</p>
            <span className="mt-1 inline-flex rounded-full bg-[#eef3ff] px-1.5 py-0.5 text-[10px] font-semibold text-[#1d46c7]">관리자</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function AdminShell({
  activePage,
  title,
  description,
  breadcrumbs,
  showRefresh = true,
  headerActions,
  children,
}: AdminShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-[#f6f7f9] text-[#172033] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <AdminSidebar activePage={activePage} className="sticky top-0 hidden lg:flex" />

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[rgba(16,24,40,0.5)]"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="관리자 메뉴 닫기"
          />
          <AdminSidebar
            activePage={activePage}
            className="relative z-10 shadow-2xl"
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-5 left-[252px] z-20 grid size-9 place-items-center rounded-full bg-white text-[#344054] shadow-lg"
            aria-label="관리자 메뉴 닫기"
          >
            <X className="size-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="min-w-0">
        <AdminHeader
          title={title}
          description={description}
          breadcrumbs={breadcrumbs}
          showRefresh={showRefresh}
          headerActions={headerActions}
          onMenuOpen={() => setIsMobileMenuOpen(true)}
        />
        {children}
      </div>
    </div>
  );
}
