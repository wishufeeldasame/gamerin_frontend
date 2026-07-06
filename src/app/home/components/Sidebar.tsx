'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Bookmark, BookOpen, Home, LogOut, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';

const menuItems = [
  { icon: Home, label: '홈', href: '/home' },
  { icon: Bookmark, label: '북마크', href: '/bookmarks' },
  { icon: MessageSquare, label: '메시지', href: '/messages' },
  { icon: BookOpen, label: '멘토링', href: '/mentoring' },
  { icon: User, label: '프로필', href: '/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const profileHref = `/profile/${encodeURIComponent(user?.handle || user?.id || 'me')}`;

  return (
    <div className="flex h-full flex-col justify-between pb-4">
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const href = item.href === '/profile' ? profileHref : item.href;
          const isActive = item.href === '/profile' ? pathname.startsWith('/profile') : pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`group flex items-center gap-4 rounded-2xl px-4 py-3 font-black transition-all ${
                isActive
                  ? 'scale-[1.02] bg-black text-white shadow-lg dark:bg-[#f5b93d] dark:text-black'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-neutral-800 dark:hover:text-zinc-100'
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 3 : 2} className="shrink-0" />
              <span className="text-[15px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {user ? (
        <div className="mt-8 border-t border-zinc-100 pt-6 dark:border-neutral-800">
          <div className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-black text-xs font-black text-white shadow-md dark:ring-1 dark:ring-white/10">
                {user.profileImageUrl ? (
                  <Image
                    src={user.profileImageUrl}
                    alt={user.nickname}
                    fill
                    unoptimized
                    sizes="40px"
                    className="object-cover"
                  />
                ) : (
                  user.nickname ? user.nickname.substring(0, 1).toUpperCase() : 'U'
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-black leading-tight text-black dark:text-zinc-100">{user.nickname}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-tighter text-zinc-400 dark:text-zinc-500">
                  {user.gameTier || 'Unranked'}
                </p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-400 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-500 dark:border-neutral-700 dark:bg-black dark:text-zinc-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300"
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
