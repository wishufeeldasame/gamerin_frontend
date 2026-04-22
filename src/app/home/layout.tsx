'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthReady } = useAuth();

  useEffect(() => {
    if (!isAuthReady || user) return;
    router.replace('/login');
  }, [isAuthReady, router, user]);

  if (!isAuthReady || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="flex max-w-[1440px] mx-auto pt-16">
        <aside className="hidden lg:block w-64 h-[calc(100vh-4rem)] sticky top-16 border-r border-zinc-100 p-4">
          <Sidebar />
        </aside>

        <main className="flex-1 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
