'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, BookOpen, Home, LogOut, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

const menuItems = [
  { icon: Home, label: '홈', href: '/home' },
  { icon: Bookmark, label: '북마크', href: '/home/friends' },
  { icon: MessageSquare, label: '메시지', href: '/home/messages' },
  { icon: BookOpen, label: '멘토링', href: '/home/mentoring' },
  { icon: User, label: '프로필', href: '/home/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col justify-between pb-4">
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-4 rounded-2xl px-4 py-3 font-black transition-all ${
                isActive
                  ? 'scale-[1.02] bg-black text-white shadow-lg'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-black'
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 3 : 2} className="shrink-0" />
              <span className="text-[15px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {user ? (
        <div className="mt-8 border-t border-zinc-100 pt-6">
          <div className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-xs font-black text-white shadow-md">
                {user.nickname ? user.nickname.substring(0, 1).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black leading-tight text-black">{user.nickname}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-tighter text-zinc-400">
                  {user.gameTier || 'Unranked'}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-500"
            >
              <LogOut size={14} strokeWidth={3} />
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
