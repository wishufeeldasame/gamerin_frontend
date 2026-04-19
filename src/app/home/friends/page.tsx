'use client';

import { UserPlus, Search, MessageSquare, MoreHorizontal, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const friends = [
  { name: 'Sarah Chen', username: '@sarahgamer', game: 'Valorant', mutual: 12, initials: 'SC', online: true },
  { name: 'James Park', username: '@jamespark99', game: 'Elden Ring', mutual: 6, initials: 'JP', online: true },
  { name: 'Luna Choi', username: '@lunaraid', game: 'League of Legends', mutual: 8, initials: 'LC', online: false },
];

export default function FriendsPage() {
  return (
    <div className="max-w-5xl mx-auto py-12 px-8">
      {/* 1. 상단 헤더: 가독성을 위해 text-black과 font-black을 확실히 적용 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-black tracking-tighter italic uppercase">
            친구 관리
          </h1>
        </div>

        {/* 검색창: 배경 zinc-100과 텍스트 black의 대비 확보 */}
        <div className="relative group w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-black transition-colors" size={18} />
          <input 
            placeholder="태그나 게임으로 검색..." 
            className="w-full pl-12 pr-4 py-4 bg-zinc-100 border-none rounded-[20px] text-sm font-black text-black placeholder:text-zinc-400 focus:ring-2 focus:ring-black transition-all outline-none shadow-inner"
          />
        </div>
      </div>

      {/* 2. 섹션: 접속 중인 친구 */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <h2 className="text-xl font-black text-black uppercase tracking-tight italic">Online Friends</h2>
          </div>
          <button className="text-xs font-black text-zinc-400 hover:text-black transition-all uppercase tracking-widest">
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {friends.filter(f => f.online).map((friend) => (
            <motion.div 
              key={friend.username}
              whileHover={{ y: -5, scale: 1.01 }}
              className="p-6 border-2 border-zinc-50 rounded-[32px] bg-white hover:border-black transition-all group shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-2xl"
            >
              <div className="flex items-center gap-5">
                {/* 아바타: 묵직한 블랙 사각형 적용 */}
                <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg group-hover:rotate-3 transition-transform">
                  {friend.initials}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-[17px] text-black tracking-tight leading-none mb-1.5">{friend.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-black rounded-md uppercase tracking-tighter border border-green-100">
                      {friend.game}
                    </span>
                    <span className="text-[11px] font-bold text-zinc-400">PLAYING NOW</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="p-3.5 bg-zinc-50 rounded-2xl text-zinc-400 hover:bg-black hover:text-white transition-all shadow-sm">
                    <MessageSquare size={20} />
                  </button>
                  <button className="p-3.5 bg-zinc-50 rounded-2xl text-zinc-400 hover:bg-zinc-100 transition-all">
                    <MoreHorizontal size={20} />
                  </button>
                </div>
              </div>  
            </motion.div>
          ))}
        </div>
      </section>

      {/* 3. 추천 친구 / 친구 요청 섹션 (추가 레이아웃) */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <Users size={20} className="text-black" />
          <h2 className="text-xl font-black text-black uppercase tracking-tight italic">Suggested For You</h2>
        </div>
        
        <div className="bg-zinc-50 rounded-[40px] p-8 border border-zinc-100 border-dashed">
          <div className="flex flex-col items-center text-center py-10">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center mb-4 shadow-sm">
              <UserPlus size={28} className="text-zinc-300" />
            </div>
            <p className="text-zinc-500 font-bold text-sm">함께 게임할 새로운 친구를 찾아보세요.</p>
            <button className="mt-6 px-8 py-3 bg-black text-white font-black text-xs rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-zinc-200">
              EXPLORE GAMERS
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}