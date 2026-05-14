'use client';

import Image from 'next/image';
import { Calendar, MapPin, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PostRecord } from '@/lib/feed-api';
import { Post } from './Post';
import { FetchGameStatsModal } from './FetchGameStatsModal';
import { EditProfileModal } from './EditProfileModal';
import { AddAccountModal } from './AddAcountModal';

const gameStats = [
  { game: 'League of Legends', rank: 'Diamond II', winRate: '58%', games: 324 },
  { game: 'Valorant', rank: 'Platinum I', winRate: '52%', games: 187 },
  { game: 'Elden Ring', achievement: '100% Complete', playTime: '156h' },
];

const userPosts: PostRecord[] = [
  {
    postId: 'profile-sample-1',
    author: 'GamerIN User',
    authorHandle: 'sinui_kim',
    authorProfileImageUrl: null,
    authorVerifiedBadge: false,
    game: 'Elden Ring',
    content: 'Elden Ring boss clear. What a run.',
    media: [
      {
        mediaId: 'profile-sample-media-1',
        mediaType: 'IMAGE',
        mediaUrl: 'https://images.unsplash.com/photo-1774060526585-19be7b4af255?q=80&w=1080',
        thumbnailUrl: null,
        sortOrder: 0,
        durationSeconds: null,
      },
    ],
    externalLink: null,
    likes: 156,
    comments: 23,
    shares: 8,
    likedByMe: false,
    mine: true,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
];

export function Profile({ isOwnProfile = true }: { isOwnProfile?: boolean }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFetchStatsModal, setShowFetchStatsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [profileCover, setProfileCover] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState({
    name: 'GamerIN User',
    bio: 'Next.js and TypeScript player building a gaming story.',
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
    <div className="bg-white pb-20">
      <div className="relative h-64 overflow-hidden bg-zinc-900">
        <Image
          src={profileCover || 'https://images.unsplash.com/photo-1607796884038-3638822d5ee2?q=80&w=1440'}
          alt="Cover"
          fill
          unoptimized
          sizes="(max-width: 768px) 100vw, 1024px"
          className="object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-white to-transparent" />
      </div>

      <div className="mx-auto max-w-4xl px-6">
        <div className="relative -mt-20 flex items-end justify-between">
          <div className="relative">
            <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-[48px] border-[6px] border-white bg-black text-4xl font-black text-white shadow-2xl">
              {profileAvatar ? (
                <Image src={profileAvatar} alt="Profile" fill unoptimized sizes="160px" className="object-cover" />
              ) : (
                'GU'
              )}
            </div>
            <div className="absolute bottom-2 right-2 h-8 w-8 rounded-full border-4 border-white bg-green-500" />
          </div>

          <div className="mb-4 flex gap-3">
            {isOwnProfile ? (
              <button
                onClick={() => setShowEditProfileModal(true)}
                className="rounded-2xl bg-black px-8 py-3 text-sm font-black text-white shadow-lg transition-all hover:bg-zinc-800"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button className="rounded-2xl bg-zinc-100 p-3 text-black transition-all hover:bg-zinc-200">
                  <MessageCircle size={20} />
                </button>
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`rounded-2xl px-8 py-3 text-sm font-black transition-all ${
                    isFollowing ? 'bg-zinc-100 text-black' : 'bg-black text-white shadow-lg'
                  }`}
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-black">{userInfo.name}</h1>
            <p className="font-bold text-zinc-400">@sinui_kim</p>
          </div>
          <p className="max-w-2xl text-[16px] font-medium italic leading-relaxed text-zinc-800">
            &quot;{userInfo.bio}&quot;
          </p>
          <div className="flex items-center gap-6 text-sm font-black text-zinc-400">
            <div className="flex items-center gap-1.5">
              <MapPin size={16} />
              <span>{userInfo.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={16} />
              <span>Joined March 2024</span>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-black uppercase italic tracking-tight text-black">Verified Stats</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFetchStatsModal(true)}
                className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2 text-xs font-black text-black transition-all hover:bg-black hover:text-white"
              >
                <Plus size={14} />
                STAT SYNC
              </button>
              <button onClick={handleRefreshStats} className="rounded-xl bg-zinc-50 p-2 hover:bg-zinc-100">
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {gameStats.map((stat) => (
              <motion.div
                key={stat.game}
                whileHover={{ y: -4 }}
                className="group flex items-center justify-between rounded-[32px] border border-zinc-100 bg-zinc-50 p-6 transition-all hover:border-black"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-center text-[10px] font-black text-white">
                    LV.42
                  </div>
                  <div>
                    <p className="text-sm font-black text-black">{stat.game}</p>
                    <p className="text-xs font-bold text-zinc-400">
                      {'rank' in stat ? stat.rank : stat.achievement}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-black">
                    {'winRate' in stat ? `WIN ${stat.winRate}` : stat.playTime}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Performance</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-12 space-y-6">
          <div className="mb-6 border-b border-zinc-100">
            <button className="border-b-4 border-black px-2 pb-4 text-sm font-black uppercase italic">Posts</button>
          </div>
          {userPosts.map((post) => (
            <Post key={post.postId} post={post} />
          ))}
        </div>
      </div>

      {showFetchStatsModal ? <FetchGameStatsModal onClose={() => setShowFetchStatsModal(false)} /> : null}
      {showEditProfileModal ? (
        <EditProfileModal
          onClose={() => setShowEditProfileModal(false)}
          coverImage={profileCover}
          onSaveCover={(newCover) => setProfileCover(newCover)}
          avatarImage={profileAvatar}
          onSaveAvatar={(newAvatar) => setProfileAvatar(newAvatar)}
          userInfo={userInfo}
          onSaveUserInfo={(newUserInfo) => setUserInfo(newUserInfo)}
        />
      ) : null}
      {showAddAccountModal ? (
        <AddAccountModal onClose={() => setShowAddAccountModal(false)} onAdd={(platform, url) => console.log(platform, url)} />
      ) : null}
    </div>
  );
}
