'use client';

import {
  Gamepad2,
  Settings,
  Edit3,
  Grid,
  BarChart3,
  Star,
  Layers,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from "@/app/context/AuthContext";
import { FetchGameStatsModal } from '../components/FetchGameStatsModal';
import { EditProfileModal } from '../components/EditProfileModal';

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

const gameStats = [
  {
    game: 'League of Legends',
    rank: 'Diamond II',
    kd: '3.2',
    winRate: '58%',
    games: '324게임',
  },
  {
    game: 'Valorant',
    rank: 'Platinum I',
    kd: '1.8',
    winRate: '52%',
    games: '187게임',
  },
  {
    game: 'Elden Ring',
    achievement: '100% Complete',
    playTime: '156h',
  },
];

export default function ProfilePage() {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('전적');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFetchStatsModal, setShowFetchStatsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileCover, setProfileCover] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);

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

  if (!currentUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-zinc-400 font-black animate-pulse uppercase italic">
          Loading Gamer Data...
        </p>
      </div>
    );
  }

  const userData: UserData = {
    id: currentUser.id,
    name: currentUser.nickname || "Gamer",
    handle: currentUser.handle || currentUser.nickname?.toLowerCase() || "gamer",
    bio: currentUser.bio || "GamerIN에서 나만의 게이밍 이력을 만들어보세요.",
    tier: currentUser.gameTier || "Unranked",
    followers: 0,
    following: 0,
    profileColor: "bg-zinc-950",
  };

  const tabs = [
    { name: '활동', icon: <Grid size={16} /> },
    { name: '전적', icon: <BarChart3 size={16} /> },
    { name: '멘토링', icon: <Star size={16} /> },
    { name: '미디어', icon: <Layers size={16} /> },
  ];

  const handleRefreshStats = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white min-h-screen pb-20">
      {/* 상단 배너 */}
      <div
        className={`relative h-56 ${userData.profileColor} overflow-hidden`}
        style={{
          backgroundImage: `url(${profileCover || 'https://images.unsplash.com/photo-1607796884038-3638822d5ee2?q=80&w=1440'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />
      </div>

      <div className="px-8">
        <div className="relative flex justify-between items-end -mt-16 mb-8">
          {/* 프로필 이미지 */}
          <div className="relative">
            <div className="w-36 h-36 bg-black border-[6px] border-white rounded-[40px] overflow-hidden flex items-center justify-center text-4xl font-black text-white shadow-2xl">
              {profileAvatar ? (
                <img
                  src={profileAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                userData.name.substring(0, 1).toUpperCase()
              )}
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full" />
          </div>

          {/* 버튼 영역 */}
          <div className="flex gap-3 mb-2">
            <button className="p-3 bg-zinc-100 text-black rounded-2xl hover:bg-zinc-200 transition-all">
              <Settings size={20} />
            </button>
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-2xl font-black text-sm hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
            >
              <Edit3 size={18} />
              프로필 편집
            </button>
          </div>
        </div>

        {/* 유저 정보 */}
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
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                Followers
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-black tracking-tighter">
                {userData.following.toLocaleString()}
              </span>
              <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                Following
              </span>
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
              activeTab === tab.name
                ? "text-black"
                : "text-zinc-300 hover:text-zinc-500"
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
      <div className="px-8 pt-10">
        {activeTab === '전적' && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl font-black text-black">개인 전적</h2>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFetchStatsModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 transition"
                >
                  <Plus size={16} />
                  stat+
                </button>

                <button
                  onClick={handleRefreshStats}
                  className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 transition"
                >
                  <RefreshCw
                    size={18}
                    className={isRefreshing ? 'animate-spin' : ''}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {gameStats.map((stat, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-5 md:px-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-zinc-300" />
                    <div>
                      <p className="text-xl font-black text-black">
                        {stat.game}
                      </p>
                      <p className="text-base text-slate-600">
                        {'rank' in stat ? stat.rank : stat.achievement}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {'kd' in stat ? (
                      <>
                        <p className="text-xl font-black text-black">
                          K/D {stat.kd} · 승률 {stat.winRate}
                        </p>
                        <p className="text-base text-slate-600">{stat.games}</p>
                      </>
                    ) : (
                      <p className="text-xl text-slate-600">{stat.playTime}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === '활동' && (
          <div className="py-24 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-50 rounded-[30px] mb-6">
              <Gamepad2 className="text-zinc-200 w-10 h-10" />
            </div>
            <h3 className="text-black font-black text-lg mb-1 italic uppercase">
              No Activity Yet
            </h3>
            <p className="text-zinc-400 font-bold text-sm">
              아직 {userData.name}님이 공유한 모먼트가 없습니다.
            </p>
          </div>
        )}

        {activeTab === '멘토링' && (
          <div className="py-24 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-50 rounded-[30px] mb-6">
              <Star className="text-zinc-200 w-10 h-10" />
            </div>
            <h3 className="text-black font-black text-lg mb-1 italic uppercase">
              No Mentoring Yet
            </h3>
            <p className="text-zinc-400 font-bold text-sm">
              아직 등록된 멘토링 정보가 없습니다.
            </p>
          </div>
        )}

        {activeTab === '미디어' && (
          <div className="py-24 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-zinc-50 rounded-[30px] mb-6">
              <Layers className="text-zinc-200 w-10 h-10" />
            </div>
            <h3 className="text-black font-black text-lg mb-1 italic uppercase">
              No Media Yet
            </h3>
            <p className="text-zinc-400 font-bold text-sm">
              아직 등록된 미디어가 없습니다.
            </p>
          </div>
        )}
      </div>

      {showFetchStatsModal && (
        <FetchGameStatsModal onClose={() => setShowFetchStatsModal(false)} />
      )}
      {showEditProfileModal && (
        <EditProfileModal
          onClose={() => setShowEditProfileModal(false)}
          coverImage={profileCover}
          onSaveCover={(newCover) => setProfileCover(newCover)}
          avatarImage={profileAvatar}
          onSaveAvatar={(newAvatar) => setProfileAvatar(newAvatar)}
        />
      )}
    </div>
  );
}