'use client';

import Image from 'next/image';
import {
  Settings,
  Edit3,
  Grid,
  BarChart3,
  Layers,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { FetchGameStatsModal } from '../components/FetchGameStatsModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { Post } from '../components/Post';
import {
  PostRecord,
  ProfileMediaItem,
  UserProfile,
  fetchMyProfile,
  fetchUserMedia,
  fetchUserPosts,
  getInitials,
} from '@/lib/feed-api';

type ProfileTab = 'posts' | 'stats' | 'media';

function formatGameStatsSummary(stats: unknown) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return String(stats ?? '');
  }

  const record = stats as Record<string, unknown>;
  const summaryParts: string[] = [];

  const kda = typeof record.kda === 'number' ? record.kda : null;
  const winRate = typeof record.winRate === 'number' ? record.winRate : null;
  const games = typeof record.games === 'number' ? record.games : null;
  const tierLabel = typeof record.tierLabel === 'string' ? record.tierLabel : null;

  if (tierLabel) {
    summaryParts.push(tierLabel);
  }

  if (kda !== null) {
    summaryParts.push(`K/D ${kda.toFixed(2)}`);
  }

  if (winRate !== null) {
    summaryParts.push(`승률 ${winRate}%`);
  }

  if (games !== null) {
    summaryParts.push(`${games}게임`);
  }

  if (summaryParts.length > 0) {
    return summaryParts.join(' · ');
  }

  return Object.entries(record)
    .filter(([key]) => key !== 'accountId')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(' · ');
}

export default function ProfilePage() {
  const { user: currentUser, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFetchStatsModal, setShowFetchStatsModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [profileCover, setProfileCover] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [mediaItems, setMediaItems] = useState<ProfileMediaItem[]>([]);
  const [postsNextCursor, setPostsNextCursor] = useState<string | null>(null);
  const [postsHasNext, setPostsHasNext] = useState(false);
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
  const [mediaHasNext, setMediaHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const myProfile = await fetchMyProfile();
        const [postPage, mediaPage] = await Promise.all([
          fetchUserPosts(myProfile.handle),
          fetchUserMedia(myProfile.handle),
        ]);

        if (cancelled) {
          return;
        }

        setProfile(myProfile);
        setPosts(postPage.items);
        setPostsNextCursor(postPage.nextCursor);
        setPostsHasNext(postPage.hasNext);
        setMediaItems(mediaPage.items);
        setMediaNextCursor(mediaPage.nextCursor);
        setMediaHasNext(mediaPage.hasNext);
        updateUser({
          handle: myProfile.handle,
          nickname: myProfile.nickname,
          bio: myProfile.bio ?? '',
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load profile.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [updateUser]);

  const gameStatEntries = useMemo(() => {
    if (!profile?.gameStats) {
      return [];
    }

    return Object.entries(profile.gameStats).map(([gameName, stats]) => ({
      gameName,
      summary: formatGameStatsSummary(stats),
    }));
  }, [profile?.gameStats]);

  const handleRefreshStats = async () => {
    if (!profile) {
      return;
    }

    try {
      setIsRefreshing(true);
      const refreshed = await fetchMyProfile();
      setProfile(refreshed);
    } catch (refreshError) {
      alert(refreshError instanceof Error ? refreshError.message : 'Failed to refresh profile.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLoadMorePosts = async () => {
    if (!profile || !postsHasNext || !postsNextCursor || loadingMorePosts) {
      return;
    }

    try {
      setLoadingMorePosts(true);
      const page = await fetchUserPosts(profile.handle, postsNextCursor);
      setPosts((current) => [...current, ...page.items]);
      setPostsNextCursor(page.nextCursor);
      setPostsHasNext(page.hasNext);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : 'Failed to load more posts.');
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const handleLoadMoreMedia = async () => {
    if (!profile || !mediaHasNext || !mediaNextCursor || loadingMoreMedia) {
      return;
    }

    try {
      setLoadingMoreMedia(true);
      const page = await fetchUserMedia(profile.handle, mediaNextCursor);
      setMediaItems((current) => [...current, ...page.items]);
      setMediaNextCursor(page.nextCursor);
      setMediaHasNext(page.hasNext);
    } catch (loadError) {
      alert(loadError instanceof Error ? loadError.message : 'Failed to load more media.');
    } finally {
      setLoadingMoreMedia(false);
    }
  };

  if (!currentUser || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="animate-pulse font-black uppercase italic text-zinc-400">Loading Gamer Data...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="font-black text-red-500">{error ?? 'Profile not found.'}</p>
      </div>
    );
  }

  const tabs = [
    { name: 'posts' as const, icon: <Grid size={16} /> },
    { name: 'stats' as const, icon: <BarChart3 size={16} /> },
    { name: 'media' as const, icon: <Layers size={16} /> },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-white pb-20">
      <div
        className="relative h-56 overflow-hidden bg-zinc-950"
        style={{
          backgroundImage: `url(${profileCover || 'https://images.unsplash.com/photo-1607796884038-3638822d5ee2?q=80&w=1440'})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent opacity-50" />
      </div>

      <div className="px-8">
        <div className="relative mb-8 flex items-end justify-between -mt-16">
          <div className="relative">
            <div className="relative flex h-36 w-36 items-center justify-center overflow-hidden rounded-[40px] border-[6px] border-white bg-black text-4xl font-black text-white shadow-2xl">
              {profileAvatar || profile.profileImageUrl ? (
                <Image
                  src={profileAvatar || profile.profileImageUrl || ''}
                  alt="Profile"
                  fill
                  unoptimized
                  sizes="144px"
                  className="object-cover"
                />
              ) : (
                getInitials(profile.nickname)
              )}
            </div>
            <div className="absolute bottom-2 right-2 h-8 w-8 rounded-full border-4 border-white bg-green-500" />
          </div>

          <div className="mb-2 flex gap-3">
            <button className="rounded-2xl bg-zinc-100 p-3 text-black transition-all hover:bg-zinc-200">
              <Settings size={20} />
            </button>
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-black px-8 py-3 text-sm font-black text-white shadow-lg shadow-zinc-200 transition-all hover:bg-zinc-800"
            >
              <Edit3 size={18} />
              Edit Profile
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-4xl font-black uppercase italic tracking-tighter text-black">{profile.nickname}</h1>
            <p className="font-bold tracking-tight text-zinc-400">@{profile.handle}</p>
          </div>

          <p className="max-w-xl whitespace-pre-wrap text-[17px] font-medium leading-relaxed text-zinc-800">
            {profile.bio || 'Tell your gaming story on GamerIN.'}
          </p>

          <div className="flex gap-8 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tighter text-black">
                {profile.followersCount.toLocaleString()}
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Followers</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tighter text-black">
                {profile.followingCount.toLocaleString()}
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Following</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tighter text-black">{profile.postCount.toLocaleString()}</span>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Posts</span>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-16 z-10 mt-12 flex gap-10 border-b border-zinc-100 bg-white px-8">
        {tabs.map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`relative flex items-center gap-2 pb-5 text-sm font-black uppercase tracking-widest transition-all ${
              activeTab === tab.name ? 'text-black' : 'text-zinc-300 hover:text-zinc-500'
            }`}
          >
            {tab.icon}
            {tab.name}
            {activeTab === tab.name ? (
              <motion.div layoutId="activeTab" className="absolute left-0 right-0 bottom-0 h-1 rounded-full bg-black" />
            ) : null}
          </button>
        ))}
      </div>

      <div className="px-8 pt-10">
        {activeTab === 'stats' ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-3xl font-black text-black">Verified Stats</h2>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowFetchStatsModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-800"
                >
                  <Plus size={16} />
                  stat+
                </button>

                <button onClick={handleRefreshStats} className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100">
                  <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {gameStatEntries.length === 0 ? (
                <div className="rounded-2xl bg-zinc-50 px-5 py-6 text-sm font-bold text-zinc-400">
                  No connected game stats yet.
                </div>
              ) : (
                gameStatEntries.map((entry) => (
                  <div
                    key={entry.gameName}
                    className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-5 md:px-5"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-xl bg-zinc-300" />
                      <div>
                        <p className="text-xl font-black text-black">{entry.gameName}</p>
                        <p className="max-w-xl truncate text-base text-slate-600">{entry.summary}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Live sync</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'posts' ? (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="py-24 text-center">
                <h3 className="mb-1 text-lg font-black uppercase italic text-black">No Posts Yet</h3>
                <p className="text-sm font-bold text-zinc-400">This profile has not published any posts yet.</p>
              </div>
            ) : (
              posts.map((post) => <Post key={post.postId} post={post} />)
            )}

            {postsHasNext ? (
              <button
                type="button"
                onClick={handleLoadMorePosts}
                disabled={loadingMorePosts}
                className="w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
              >
                {loadingMorePosts ? 'Loading...' : 'Load More Posts'}
              </button>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'media' ? (
          <div className="space-y-6">
            {mediaItems.length === 0 ? (
              <div className="py-24 text-center">
                <h3 className="mb-1 text-lg font-black uppercase italic text-black">No Media Yet</h3>
                <p className="text-sm font-bold text-zinc-400">Uploaded image and video posts will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {mediaItems.map((item) => (
                  <div key={item.mediaId} className="overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50">
                    {item.mediaType === 'VIDEO' ? (
                      <video
                        controls
                        poster={item.thumbnailUrl ?? undefined}
                        src={item.mediaUrl}
                        className="h-56 w-full bg-black object-cover"
                      />
                    ) : (
                      <div className="relative h-56 w-full">
                        <Image src={item.mediaUrl} alt="Profile media" fill unoptimized className="object-cover" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {mediaHasNext ? (
              <button
                type="button"
                onClick={handleLoadMoreMedia}
                disabled={loadingMoreMedia}
                className="w-full rounded-2xl border border-zinc-100 bg-white px-6 py-4 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
              >
                {loadingMoreMedia ? 'Loading...' : 'Load More Media'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {showFetchStatsModal ? <FetchGameStatsModal onClose={() => setShowFetchStatsModal(false)} /> : null}
      {showEditProfileModal ? (
        <EditProfileModal
          onClose={() => setShowEditProfileModal(false)}
          coverImage={profileCover}
          onSaveCover={(newCover) => setProfileCover(newCover)}
          avatarImage={profileAvatar}
          onSaveAvatar={(newAvatar) => setProfileAvatar(newAvatar)}
        />
      ) : null}
    </div>
  );
}
