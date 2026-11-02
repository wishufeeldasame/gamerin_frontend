'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { Header } from '@/app/home/components/Header';
import { MobileTabBar, Sidebar } from '@/app/home/components/Sidebar';
import { SessionUnavailableNotice } from '@/app/home/components/SessionUnavailableNotice';
import { PopupProvider } from '@/app/context/PopupContext';
import { PendingPostsProvider } from '@/app/context/PendingPostsContext';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthReady, isSessionUnavailable } = useAuth();

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
    <div className="min-h-screen bg-background">
      <Header />

      <div className="flex max-w-[1440px] mx-auto pt-16">
        <aside className="hidden lg:block w-64 h-[calc(100vh-4rem)] sticky top-16 border-r border-zinc-100 p-4 dark:border-line dark:bg-surface">
          <Sidebar />
        </aside>

        <main className="min-w-0 flex-1 min-h-[calc(100dvh-4rem)] pb-[var(--tab-bar-height)]">{children}</main>
      </div>

      <MobileTabBar />
    </div>
    </PendingPostsProvider>
    </PopupProvider>
  );
}
