'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { MobileTabBar, Sidebar } from '@/app/home/components/Sidebar';
import { MobileTopBar } from '@/app/home/components/MobileTopBar';
import { UnreadNotificationCountContext, useUnreadNotificationCount } from '@/hooks/useUnreadNotificationCount';
import { SessionUnavailableNotice } from '@/app/home/components/SessionUnavailableNotice';
import { PopupProvider } from '@/app/context/PopupContext';
import { PendingPostsProvider } from '@/app/context/PendingPostsContext';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthReady, isSessionUnavailable } = useAuth();
  const [unreadCount, setUnreadCount] = useUnreadNotificationCount();
  // 알림·게시물 상세·해시태그·지갑은 자체 뒤로 헤더를 쓰므로 모바일 상단 바를 숨긴다(F15).
  const showTopBar = pathname !== '/notifications' && pathname !== '/wallet' && !pathname.startsWith('/posts/') && !pathname.startsWith('/hashtags/');

  useEffect(() => {
    if (!isAuthReady) return;

    // 세션을 일시 장애로 확인하지 못한 것은 로그아웃이 아니므로 로그인 화면으로 보내지 않는다.
    if (!user && !isSessionUnavailable) {
      router.replace('/login');
    }
  }, [isAuthReady, isSessionUnavailable, user, router]);

  if (!isAuthReady) {
    return null;
  }

  if (!user) {
    return isSessionUnavailable ? <SessionUnavailableNotice /> : null;
  }

  return (
    <PopupProvider key={user.id}>
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

        <main className="min-w-0 flex-1 min-h-[calc(100dvh-var(--app-header-height))] pb-[var(--tab-bar-height)]">{children}</main>
      </div>

      <MobileTabBar />
    </div>
    </UnreadNotificationCountContext.Provider>
    </PendingPostsProvider>
    </PopupProvider>
  );
}
