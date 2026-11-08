'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { MobileTabBar, Sidebar } from '@/app/home/components/Sidebar';
import { MobileTopBar } from '@/app/home/components/MobileTopBar';
import { UnreadNotificationCountContext, useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { SessionUnavailableNotice } from '@/app/home/components/SessionUnavailableNotice';
import { PopupProvider } from '@/app/context/PopupContext';
import { isPublicAppPath, requestLogin } from '@/lib/login-prompt';
import { BLOCKED_ACCOUNT_MESSAGE } from '@/lib/auth-session-policy';
import { PendingPostsProvider } from '@/app/context/PendingPostsContext';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, isAuthReady, isSessionUnavailable, isAccountBlocked, isLoggingOut, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useUnreadNotificationCount();
  // 자체 뒤로 헤더가 있는 하위 화면에서는 모바일 상단 바를 숨긴다(F15).
  const showTopBar = pathname !== '/notifications' && pathname !== '/wallet' && pathname !== '/membership' && pathname !== '/settings' && !pathname.startsWith('/posts/') && !pathname.startsWith('/hashtags/');

  const protectedPage = !isPublicAppPath(pathname);
  useEffect(() => {
    if (isAuthReady && !user && !isSessionUnavailable && !isAccountBlocked && !isLoggingOut && protectedPage) {
      requestLogin({ returnTo: window.location.pathname + window.location.search + window.location.hash, dismissTo: '/' });
    }
  }, [isAuthReady, isSessionUnavailable, isAccountBlocked, isLoggingOut, protectedPage, pathname, user]);

  if (!isAuthReady) return null;
  if (isAccountBlocked) return <main className="grid min-h-dvh place-items-center bg-canvas p-4"><section className="max-w-sm rounded-card border border-line bg-surface p-6 text-fg-primary"><p role="alert">{BLOCKED_ACCOUNT_MESSAGE}</p><button type="button" className="btn-primary mt-4" onClick={() => void logout({ redirectTo: '/' })}>로그아웃</button></section></main>;
  if (!user && isSessionUnavailable) return <SessionUnavailableNotice />;

  return (
    <PopupProvider key={user?.id ?? 'guest'}>
    <PendingPostsProvider>
    <UnreadNotificationCountContext.Provider value={setUnreadCount}>
    {/* L2 셸(F4): 상단 헤더 없이 사이드바(248)와 본문을 1212 폭으로 가운데 정렬한다. 수치는 Sidebar.tsx의 SHELL_MAX_WIDTH·SIDEBAR_WIDTH와 같다. */}
    <div
      className="min-h-screen bg-canvas"
      style={showTopBar ? undefined : ({ '--app-header-height': '0px' } as React.CSSProperties)}
    >
      {showTopBar ? <MobileTopBar unreadCount={unreadCount} /> : null}

      <div className="mx-auto flex max-w-[1212px] pt-[var(--app-header-height)]">
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 px-4 pb-4 pt-6 lg:block">
          <Sidebar unreadCount={unreadCount} onUnreadCountChange={setUnreadCount} />
        </aside>

        <main className="min-w-0 flex-1 min-h-[calc(100dvh-var(--app-header-height))] pb-[var(--tab-bar-height)]">{user || !protectedPage ? children : <p className="p-6 text-label text-fg-secondary">로그인 후 이용할 수 있습니다.</p>}</main>
      </div>

      <MobileTabBar />
    </div>
    </UnreadNotificationCountContext.Provider>
    </PendingPostsProvider>
    </PopupProvider>
  );
}
