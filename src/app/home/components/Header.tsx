'use client';

import { Bell, MessageSquare, Search, LogOut } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext"; // 1. 경로 확인 필수!
import Link from "next/link";

export function Header() {
  // 2. 전역 상태에서 유저 정보와 로그아웃 함수 가져오기
  const { user, logout } = useAuth();

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-[#d69a1f] bg-[#f5b93d]">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-6 lg:px-6">
        {/* 로고 영역 */}
        <div className="min-w-0 flex-1 lg:max-w-[240px]">
          <Link
            href="/home"
            className="text-[2.05rem] font-semibold leading-none text-black"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            GamerIN
          </Link>
        </div>

        {/* 검색 영역 */}
        <div className="hidden flex-1 justify-start md:flex">
          <label className="flex h-10 w-full max-w-[385px] items-center gap-3 rounded-xl border border-black/10 bg-[#f3f1f7] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
            <Search size={18} className="text-zinc-500" strokeWidth={2.1} />
            <input
              type="text"
              placeholder="Search games, players, posts..."
              className="w-full bg-transparent text-sm text-black outline-none placeholder:text-zinc-500"
            />
          </label>
        </div>

        {/* 오른쪽 유저 액션 영역 */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:max-w-md">
          {user ? (
            /* A. 로그인 상태: 알림, 메시지, 유저 아바타, 로그아웃 */
            <>
              <button className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5 relative">
                <Bell size={18} strokeWidth={2.1} />
                <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-600 rounded-full border border-[#f5b93d]" />
              </button>
              <button className="flex h-9 w-9 items-center justify-center rounded-full text-black transition hover:bg-black/5">
                <MessageSquare size={18} strokeWidth={2.1} />
              </button>
              
              <div className="flex items-center gap-3 ml-2 pl-3 border-l border-black/10">
                <div className="hidden lg:block text-right">
                   <p className="text-[11px] font-black text-black leading-none uppercase tracking-tighter">
                     {user.nickname}
                   </p>
                   <p className="text-[9px] font-bold text-black/60 uppercase mt-0.5">
                     {user.gameTier}
                   </p>
                </div>
                {/* 닉네임 첫 글자로 아바타 생성 */}
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-sm font-black text-white shadow-lg">
                  {user.nickname.substring(0, 1).toUpperCase()}
                </div>
                <button 
                  onClick={() => logout()}
                  className="p-1.5 text-black/40 hover:text-black transition-colors"
                  title="로그아웃"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </>
          ) : (
            /* B. 비로그인 상태: 로그인 버튼 노출 */
            <Link href="/login">
              <button className="px-5 py-2 bg-black text-white text-xs font-black rounded-xl hover:bg-zinc-800 transition-all uppercase tracking-widest shadow-lg">
                Login
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
