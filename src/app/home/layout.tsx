'use client';

import { Header } from "./components/Header";
import { Sidebar } from "./components/Sidebar";

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* 모든 홈 하위 페이지에 공통으로 뜨는 헤더 */}
      <Header />

      <div className="flex max-w-[1440px] mx-auto pt-16">
        {/* 왼쪽 사이드바 고정 (여기서 Link 기능을 넣은 Sidebar를 호출) */}
        <aside className="hidden lg:block w-64 h-[calc(100vh-4rem)] sticky top-16 border-r border-zinc-100 p-4">
          <Sidebar />
        </aside>

        {/* 여기가 핵심!
            children 자리에는 /home/friends, /home/profile 등
            선택한 하위 페이지의 내용(page.tsx)이 들어옵니다.
        */}
        <main className="flex-1 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}