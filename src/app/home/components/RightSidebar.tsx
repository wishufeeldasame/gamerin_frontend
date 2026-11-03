'use client';

import { UserPlus } from 'lucide-react';
import Link from 'next/link';

const suggestedFriends = [
  { name: 'Jin Park', tag: '@jinplays', badge: 'FPS 코치' },
  { name: 'Luna Choi', tag: '@lunaraid', badge: '길드장' },
  { name: 'Theo Han', tag: '@theostream', badge: '크리에이터' },
];

export function RightSidebar() {
  return (
    <aside className="space-y-6">
      <section className="rounded-3xl border border-zinc-100 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <UserPlus size={20} className="text-black" />
          <h2 className="text-base font-black uppercase tracking-tight text-black">추천 친구</h2>
        </div>

        <div className="space-y-5">
          {suggestedFriends.map((friend) => (
            <div key={friend.tag} className="group flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black text-xs font-black text-white dark:bg-avatar dark:text-zinc-200 shadow-inner transition-transform group-hover:scale-110">
                  {friend.name
                    .split(' ')
                    .map((part) => part[0])
                    .join('')}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-tight text-black">{friend.name}</p>
                  <p className="truncate text-xs font-bold text-zinc-400">{friend.tag}</p>
                </div>
              </div>

              <span className="shrink-0 rounded-lg bg-zinc-100 px-2 py-1 text-2xs font-black uppercase tracking-wider text-zinc-600 transition-colors group-hover:bg-black group-hover:text-white">
                {friend.badge}
              </span>
            </div>
          ))}
        </div>

        <button className="mt-6 w-full py-3 text-sm font-black text-zinc-400 transition-colors hover:text-black">
          모두 보기
        </button>
      </section>

      <footer className="space-x-3 px-6 text-xs font-bold text-zinc-400">
        <Link href="/terms" className="hover:underline">
          이용약관
        </Link>
        <Link href="/privacy" className="hover:underline">
          개인정보처리방침
        </Link>
        <span>© 2026 GamerIN</span>
      </footer>
    </aside>
  );
}
