'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, MessageSquare, BookOpen, User, LogOut } from 'lucide-react';
import { useAuth } from "@/app/context/AuthContext"; // 1. AuthContext 임포트

const menuItems = [
  { icon: Home, label: '홈', href: '/home' },
  { icon: Users, label: '친구', href: '/home/friends' },
  { icon: MessageSquare, label: '메시지', href: '/home/messages' },
  { icon: BookOpen, label: '멘토링', href: '/home/mentoring' },
  { icon: User, label: '프로필', href: '/home/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth(); // 2. 로그인 유저 정보와 로그아웃 함수 가져오기

  return (
    <div className="flex flex-col h-full justify-between pb-4">
      {/* 상단 네비게이션 메뉴 */}
      <nav className="space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-4 px-4 py-3 rounded-2xl font-black transition-all group ${
                isActive 
                  ? 'bg-black text-white shadow-lg scale-[1.02]' 
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-black'
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 3 : 2} className="shrink-0" />
              <span className="text-[15px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 3. 하단 미니 프로필 카드 (로그인 시 노출) */}
      {user && (
        <div className="mt-8 pt-6 border-t border-zinc-100">
          <div className="p-4 bg-zinc-50 rounded-[28px] border border-zinc-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              {/* 유저 이니셜 아바타 */}
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center text-white font-black text-xs shadow-md">
                {user.nickname ? user.nickname.substring(0, 1).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-black text-black truncate leading-tight">
                  {user.nickname}
                </p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter mt-0.5">
                  {user.gameTier || 'Unranked'}
                </p>
              </div>
            </div>
            
            {/* 로그아웃 버튼 */}
            <button 
              onClick={() => logout()}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-white border border-zinc-200 rounded-xl text-[10px] font-black text-zinc-400 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all uppercase tracking-widest"
            >
              <LogOut size={14} strokeWidth={3} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
