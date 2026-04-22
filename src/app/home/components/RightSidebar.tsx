'use client';

import { UserPlus, Flame } from "lucide-react";

const trendingGames = [
  { name: "Marvel Rivals", meta: "12.4K posts" },
  { name: "Elden Ring", meta: "9.8K posts" },
  { name: "VALORANT", meta: "7.2K posts" },
  { name: "Minecraft", meta: "5.9K posts" },
];

const suggestedFriends = [
  { name: "Jin Park", tag: "@jinplays", badge: "FPS coach" },
  { name: "Luna Choi", tag: "@lunaraid", badge: "MMO guild lead" },
  { name: "Theo Han", tag: "@theostream", badge: "Creator" },
];

export function RightSidebar() {
  return (
    <aside className="space-y-6">
      {/* 1. Trending Games 섹션 */}
      <section className="rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Flame size={20} className="text-black fill-black" />
          <h2 className="text-[17px] font-black text-black tracking-tight uppercase">Trending Games</h2>
        </div>
        
        <div className="space-y-2">
          {trendingGames.map((game, idx) => (
            <div
              key={game.name}
              className="group flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-4 transition-all hover:bg-black hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-zinc-400 group-hover:text-white/50">{idx + 1}</span>
                <p className="text-sm font-black text-black group-hover:text-white transition-colors">{game.name}</p>
              </div>
              <p className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-500">{game.meta}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Suggested Friends 섹션 */}
      <section className="rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <UserPlus size={20} className="text-black" />
          <h2 className="text-[17px] font-black text-black tracking-tight uppercase">Suggested Friends</h2>
        </div>

        <div className="space-y-5">
          {suggestedFriends.map((friend) => (
            <div key={friend.tag} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                {/* 아바타: 노란색 대신 블랙으로 변경하여 무게감 확보 */}
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-xs font-black text-white shadow-inner group-hover:scale-110 transition-transform">
                  {friend.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black text-black leading-tight">
                    {friend.name}
                  </p>
                  <p className="truncate text-[11px] font-bold text-zinc-400">{friend.tag}</p>
                </div>
              </div>
              
              {/* 뱃지: 더 작고 세련되게 수정 */}
              <span className="shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-[9px] font-black text-zinc-600 uppercase tracking-wider group-hover:bg-black group-hover:text-white transition-colors">
                {friend.badge}
              </span>
            </div>
          ))}
        </div>

        <button className="w-full mt-6 py-3 text-sm font-black text-zinc-400 hover:text-black transition-colors">
          모두 보기
        </button>
      </section>

      {/* 푸터 영역 (선택사항) */}
      <footer className="px-6 text-[11px] text-zinc-400 font-bold space-x-3">
        <a href="#" className="hover:underline">이용약관</a>
        <a href="#" className="hover:underline">개인정보처리방침</a>
        <span>© 2026 GamerIN</span>
      </footer>
    </aside>
  );
}
