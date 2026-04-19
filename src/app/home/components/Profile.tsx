'use client';

import { 
  MapPin, 
  Calendar, 
  RefreshCw, 
  UserPlus, 
  UserMinus, 
  Plus, 
  MessageCircle,
  PlayCircle,
  Gamepad2,
  Tv,
  Globe
} from 'lucide-react';
import { Post } from './Post';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// ✅ 에러 해결 1: 실제 파일명 'AddAcountModal.tsx'에 맞춰 import 경로 수정
import { FetchGameStatsModal } from './FetchGameStatsModal';
import { EditProfileModal } from './EditProfileModal';
import { AddAccountModal } from './AddAcountModal'; 

// ✅ 에러 해결 3: 누락되었던 데이터 선언 추가
const gameStats = [
  { game: 'League of Legends', rank: 'Diamond II', winRate: '58%', games: 324 },
  { game: 'Valorant', rank: 'Platinum I', winRate: '52%', games: 187 },
  { game: 'Elden Ring', achievement: '100% Complete', playTime: '156h' },
];

const userPosts = [
  {
    author: '김신의',
    initials: 'KS',
    timeAgo: '3h ago',
    game: 'Elden Ring',
    content: '드디어 1회차 클리어했습니다! 보스전 손맛이 정말 미쳤네요. 櫨',
    imageUrl: 'https://images.unsplash.com/photo-1774060526585-19be7b4af255?q=80&w=1080',
    likes: 156,
    comments: 23,
    shares: 8,
  },
];

export function Profile({ isOwnProfile = true }: { isOwnProfile?: boolean }) {
  // ✅ 에러 해결 2: 누락되었던 모든 State setter 선언 추가
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFetchStatsModal, setShowFetchStatsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [profileCover, setProfileCover] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState({
    name: '김신의',
    bio: 'Next.js & TypeScript 기반 풀스택 개발자. 발로란트 불멸 티어 櫨',
    location: 'Seoul, Korea',
    website: 'https://github.com/sinui-kim',
  });

  useEffect(() => {
    const savedCover = localStorage.getItem('gamerin_profile_cover');
    const savedAvatar = localStorage.getItem('gamerin_profile_avatar');

    setProfileCover(savedCover || 'https://images.unsplash.com/photo-1607796884038-3638822d5ee2?q=80&w=1440');
    setProfileAvatar(savedAvatar);
  }, []);

  useEffect(() => {
    if (profileCover) {
      localStorage.setItem('gamerin_profile_cover', profileCover);
    }
  }, [profileCover]);

  useEffect(() => {
    if (profileAvatar) {
      localStorage.setItem('gamerin_profile_avatar', profileAvatar);
    } else {
      localStorage.removeItem('gamerin_profile_avatar');
    }
  }, [profileAvatar]);

  const handleRefreshStats = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="pb-20 bg-white">
      {/* 1. 커버 이미지 영역 */}
      <div className="relative h-64 bg-zinc-900 overflow-hidden">
        <img
          src={profileCover || 'https://images.unsplash.com/photo-1607796884038-3638822d5ee2?q=80&w=1440'}
          alt="Cover"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="max-w-4xl mx-auto px-6">
        <div className="relative flex justify-between items-end -mt-20">
          {/* 2. 프로필 이미지 */}
          <div className="relative">
            <div className="w-40 h-40 bg-black rounded-[48px] border-[6px] border-white flex items-center justify-center text-white text-4xl font-black shadow-2xl overflow-hidden">
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                'KS'
              )}
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
          </div>

          {/* 3. 액션 버튼 */}
          <div className="flex gap-3 mb-4">
            {isOwnProfile ? (
              <button
                onClick={() => setShowEditProfileModal(true)}
                className="px-8 py-3 bg-black text-white rounded-2xl font-black text-sm hover:bg-zinc-800 transition-all shadow-lg"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button className="p-3 bg-zinc-100 rounded-2xl hover:bg-zinc-200 transition-all text-black">
                  <MessageCircle size={20} />
                </button>
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-8 py-3 rounded-2xl font-black text-sm transition-all ${
                    isFollowing ? 'bg-zinc-100 text-black' : 'bg-black text-white shadow-lg'
                  }`}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 4. 유저 상세 정보 */}
        <div className="mt-6 space-y-4">
          <div>
            <h1 className="text-3xl font-black text-black tracking-tighter">{userInfo.name}</h1>
            <p className="text-zinc-400 font-bold">@sinui_kim</p>
          </div>
          <p className="text-[16px] text-zinc-800 font-medium max-w-2xl leading-relaxed italic">
            "{userInfo.bio}"
          </p>
          <div className="flex items-center gap-6 text-sm font-black text-zinc-400">
            <div className="flex items-center gap-1.5"><MapPin size={16} /> <span>{userInfo.location}</span></div>
            <div className="flex items-center gap-1.5"><Calendar size={16} /> <span>2024년 3월 가입</span></div>
          </div>
        </div>

        {/* 5. 개인 전적 (Game Stats) */}
        <div className="mt-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-black text-black tracking-tight uppercase italic">Verified Stats</h2>
            <div className="flex gap-2">
               <button 
                onClick={() => setShowFetchStatsModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-black rounded-xl font-black text-xs hover:bg-black hover:text-white transition-all"
              >
                <Plus size={14} /> STAT SYNC
              </button>
              <button onClick={handleRefreshStats} className="p-2 bg-zinc-50 rounded-xl hover:bg-zinc-100">
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gameStats.map((stat, idx) => (
              <motion.div 
                key={idx}
                whileHover={{ y: -4 }}
                className="p-6 bg-zinc-50 border border-zinc-100 rounded-[32px] flex items-center justify-between group hover:border-black transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center font-black text-white text-[10px] text-center">
                    LV.42
                  </div>
                  <div>
                    <p className="text-sm font-black text-black">{stat.game}</p>
                    <p className="text-xs font-bold text-zinc-400">{'rank' in stat ? stat.rank : stat.achievement}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-black">{'winRate' in stat ? `WIN ${stat.winRate}` : stat.playTime}</p>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Performance</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 6. 게시물 목록 */}
        <div className="mt-12 space-y-6">
           <div className="border-b border-zinc-100 mb-6">
              <button className="pb-4 border-b-4 border-black font-black text-sm px-2 italic uppercase">Posts</button>
           </div>
           {userPosts.map((post, index) => (
            <Post key={index} {...post} />
          ))}
        </div>
      </div>

      {/* 모달 렌더링 */}
      {showFetchStatsModal && <FetchGameStatsModal onClose={() => setShowFetchStatsModal(false)} />}
      {showEditProfileModal && (
        <EditProfileModal
          onClose={() => setShowEditProfileModal(false)}
          coverImage={profileCover}
          onSaveCover={(newCover) => setProfileCover(newCover)}
          avatarImage={profileAvatar}
          onSaveAvatar={(newAvatar) => setProfileAvatar(newAvatar)}
          userInfo={userInfo}
          onSaveUserInfo={(newUserInfo) => setUserInfo(newUserInfo)}
        />
      )}
      {showAddAccountModal && (
        <AddAccountModal 
          onClose={() => setShowAddAccountModal(false)} 
          onAdd={(p, u) => console.log(p, u)} 
        />
      )}
    </div>
  );
}