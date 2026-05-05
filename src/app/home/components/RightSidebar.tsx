'use client';

import { UserPlus, Flame } from 'lucide-react';
import { TrendingGame } from '@/lib/feed-api';

const suggestedFriends = [
  { name: 'Jin Park', tag: '@jinplays', badge: 'FPS coach' },
  { name: 'Luna Choi', tag: '@lunaraid', badge: 'MMO guild lead' },
  { name: 'Theo Han', tag: '@theostream', badge: 'Creator' },
];

interface RightSidebarProps {
  trendingGames?: TrendingGame[];
}

export function RightSidebar({ trendingGames = [] }: RightSidebarProps) {
  return (
    <aside className="space-y-6">
      <section className="rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <Flame size={20} className="fill-black text-black" />
          <h2 className="text-[17px] font-black uppercase tracking-tight text-black">Trending Games</h2>
        </div>

        <div className="space-y-2">
          {trendingGames.length === 0 ? (
            <div className="rounded-2xl bg-zinc-50 px-4 py-4 text-sm font-bold text-zinc-400">
              No trending game data yet.
            </div>
          ) : (
            trendingGames.map((game, idx) => (
              <div
                key={game.gameName}
                className="group flex cursor-pointer items-center justify-between rounded-2xl bg-zinc-50 px-4 py-4 transition-all hover:scale-[1.02] hover:bg-black"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-zinc-400 group-hover:text-white/50">{idx + 1}</span>
                  <p className="text-sm font-black text-black transition-colors group-hover:text-white">{game.gameName}</p>
                </div>
                <p className="text-[11px] font-bold text-zinc-400 group-hover:text-zinc-500">
                  {game.postCount.toLocaleString()} posts
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <UserPlus size={20} className="text-black" />
          <h2 className="text-[17px] font-black uppercase tracking-tight text-black">Suggested Friends</h2>
        </div>

        <div className="space-y-5">
          {suggestedFriends.map((friend) => (
            <div key={friend.tag} className="group flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-xs font-black text-white shadow-inner transition-transform group-hover:scale-110">
                  {friend.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-black leading-tight text-black">{friend.name}</p>
                  <p className="truncate text-[11px] font-bold text-zinc-400">{friend.tag}</p>
                </div>
              </div>

              <span className="shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-zinc-600 transition-colors group-hover:bg-black group-hover:text-white">
                {friend.badge}
              </span>
            </div>
          ))}
        </div>

        <button className="mt-6 w-full py-3 text-sm font-black text-zinc-400 transition-colors hover:text-black">
          See all
        </button>
      </section>

      <footer className="space-x-3 px-6 text-[11px] font-bold text-zinc-400">
        <a href="#" className="hover:underline">
          Terms
        </a>
        <a href="#" className="hover:underline">
          Privacy
        </a>
        <span>© 2026 GamerIN</span>
      </footer>
    </aside>
  );
}
