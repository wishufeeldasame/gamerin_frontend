'use client';

import { 
  Gamepad2, Settings, Edit3, Grid, BarChart3, Star, Layers, 
  UserPlus, MessageCircle 
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from "@/app/context/AuthContext"; // 1. 인증 컨텍스트 임포트

// 유저 데이터 인터페이스 (기존 유지)
interface UserData {
  id: string;
  name: string;
  handle: string;
  bio: string;
  tier: string;
  followers: number;
  following: number;
  profileColor?: string;
}

export default function ProfilePage() {
  const { user: currentUser } = useAuth(); // 2. 로그인한 내 정보 가져오기
  const [activeTab, setActiveTab] = useState('활동');

  // 3. 현재 유저가 없으면 로딩 중이거나 로그인 유도 메시지 표시
  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-400 font-black animate-pulse uppercase italic">Loading Gamer Data...</p>
      </div>
    );
  }

  // AuthContext의 데이터를 ProfilePage의 UserData 형식에 맞게 매핑
  const userData: UserData = {
    id: currentUser.id,
    name: currentUser.nickname || "Gamer",
    handle: currentUser.handle || currentUser.nickname.toLowerCase(),
    bio: currentUser.bio || "GamerIN에서 나만의 게이밍 이력을 만들어보세요.",
    tier: currentUser.gameTier || "Unranked",
    followers: 0, // 나중에 백엔드 연동 시 실제 숫자로 변경
    following: 0,
    profileColor: "bg-zinc-950"
  };

  const tabs = [
    { name: '활동', icon: <Grid size={16} /> },
    { name: '전적', icon: <BarChart3 size={16} /> },
    { name: '멘토링', icon: <Star size={16} /> },
    { name: '미디어', icon: <Layers size={16} /> },
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen pb-20">
      {/* 상단 배너 */}
      <div className={`relative h-56 ${userData.profileColor} overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />
      </div>
      
      <div className="px-8">
        <div className="relative flex justify-between items-end -mt-16 mb-8">
          {/* 프로필 이미지: 내 닉네임 첫 글자 */}
          <div className="relative">
            <div className="w-36 h-36 bg-black border-[6px] border-white rounded-[40px] overflow-hidden flex items-center justify-center text-4xl font-black text-white shadow-2xl">
              {userData.name.substring(0, 1).toUpperCase()}
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
          </div>

          {/* 버튼 영역: 내 프로필이므로 설정/편집 노출 */}
          <div className="flex gap-3 mb-2">
            <button className="p-3 bg-zinc-100 text-black rounded-2xl hover:bg-zinc-200 transition-all">
              <Settings size={20} />
            </button>
            <button className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-2xl font-black text-sm hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200">
              <Edit3 size={18} />
              프로필 편집
            </button>
          </div>
        </div>

        {/* 유저 정보 연동 */}
        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-black italic uppercase">
              {userData.name}
            </h1>
            <p className="text-zinc-400 font-bold tracking-tight">@{userData.handle}</p>
          </div>

          <p className="text-[17px] text-zinc-800 font-medium leading-relaxed max-w-xl whitespace-pre-wrap">
            {userData.bio}
          </p>

          <div className="flex gap-8 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-black tracking-tighter">
                {userData.followers.toLocaleString()}
              </span>
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Followers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-black tracking-tighter">
                {userData.following.toLocaleString()}
              </span>
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Following</span>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="mt-12 border-b border-zinc-100 flex px-8 gap-10 bg-white sticky top-16 z-10">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`pb-5 flex items-center gap-2 text-sm font-black transition-all relative uppercase tracking-widest ${
              activeTab === tab.name ? "text-black" : "text-zinc-300 hover:text-zinc-500"
            }`}
          >
            {tab.icon}
            {tab.name}
            {activeTab === tab.name && (
              <motion.div 
                layoutId="activeTab"
                className="absolute bottom-0 left-0 right-0 h-1 bg-black rounded-full" 
              />
            )}
          </button>
        ))}
      </div>
      
      {/* 콘텐츠 영역 */}
      <div className="py-24 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-50 rounded-[30px] mb-6">
          <Gamepad2 className="text-zinc-200 w-10 h-10" />
        </div>
        <h3 className="text-black font-black text-lg mb-1 italic uppercase">No Activity Yet</h3>
        <p className="text-zinc-400 font-bold text-sm">아직 {userData.name}님이 공유한 모먼트가 없습니다.</p>
      </div>
    </div>
  );
}