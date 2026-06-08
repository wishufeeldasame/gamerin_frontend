'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Settings,
  Edit3,
  Grid,
  BarChart3,
  Layers,
  Plus,
  RefreshCw,
  ExternalLink,
  Trash2,
  Tv,
  MessageCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { FetchGameStatsModal } from '../components/FetchGameStatsModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { Post } from '../components/Post';
import {
  PostRecord,
  ProfileMediaItem,
  UserProfile,
  fetchUserProfile,
  fetchMyProfile,
  fetchUserMedia,
  fetchUserPosts,
  followUser,
  getInitials,
  unfollowUser,
  updateMyProfile,
} from '@/lib/feed-api';
import { DEFAULT_PROFILE_COVER } from '@/lib/profile-constants';
import { PrivacySettings, USER_SETTINGS_CHANGED_EVENT, loadUserSettings } from '@/lib/user-settings';

type ProfileTab = 'posts' | 'stats' | 'media';

type ConnectedPlatformId = 'youtube' | 'twitch' | 'soop';

type ConnectedAccount = {
  id: ConnectedPlatformId;
  label: string;
  handle: string;
  url: string;
};

const connectedPlatformMeta: Record<
  ConnectedPlatformId,
  {
    label: string;
    placeholder: string;
    color: string;
    icon: typeof Tv;
    buildUrl: (handle: string) => string;
  }
> = {
  youtube: {
    label: 'YouTube',
    placeholder: '@johndoe_gaming',
    color: 'bg-red-500',
    icon: Tv,
    buildUrl: (handle) => `https://www.youtube.com/${handle.startsWith('@') ? handle : `@${handle}`}`,
  },
  twitch: {
    label: 'Twitch',
    placeholder: 'johndoe',
    color: 'bg-purple-600',
    icon: Tv,
    buildUrl: (handle) => `https://www.twitch.tv/${handle.replace(/^@/, '')}`,
  },
  soop: {
    label: 'SOOP (AfreecaTV)',
    placeholder: 'johndoe',
    color: 'bg-blue-500',
    icon: Tv,
    buildUrl: (handle) => `https://ch.sooplive.co.kr/${handle.replace(/^@/, '')}`,
  },
};

function normalizeHandle(value: string) {
  return value.trim().replace(/\s+/g, '');
}

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
  const params = useParams<{ userId?: string }>();
  const router = useRouter();
  const { user: currentUser, updateUser } = useAuth();
  const routeUserId = typeof params.userId === 'string' ? decodeURIComponent(params.userId) : '';
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
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
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>(() => loadUserSettings().privacy);
  const [connectedAccounts, setConnectedAccounts] = useState<Record<ConnectedPlatformId, ConnectedAccount | null>>({
    youtube: null,
    twitch: null,
    soop: null,
  });
  const [platformInputs, setPlatformInputs] = useState<Record<ConnectedPlatformId, string>>({
    youtube: '',
    twitch: '',
    soop: '',
  });
  const [loading, setLoading] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedCover = localStorage.getItem('gamerin_profile_cover');
    const savedAvatar = localStorage.getItem('gamerin_profile_avatar');

    setProfileCover(savedCover || DEFAULT_PROFILE_COVER);
    setProfileAvatar(savedAvatar);

    try {
      const savedAccounts = localStorage.getItem('gamerin_connected_accounts');
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts) as Partial<Record<ConnectedPlatformId, ConnectedAccount>>;
        setConnectedAccounts({
          youtube: parsedAccounts.youtube ?? null,
          twitch: parsedAccounts.twitch ?? null,
          soop: parsedAccounts.soop ?? null,
        });
      }
    } catch {
      localStorage.removeItem('gamerin_connected_accounts');
    }
  }, []);

  useEffect(() => {
    const syncPrivacySettings = () => {
      const nextPrivacySettings = loadUserSettings().privacy;
      setPrivacySettings(nextPrivacySettings);

      if (!nextPrivacySettings.showStats && activeTab === 'stats') {
        setActiveTab('posts');
      }
    };

    window.addEventListener(USER_SETTINGS_CHANGED_EVENT, syncPrivacySettings);
    return () => {
      window.removeEventListener(USER_SETTINGS_CHANGED_EVENT, syncPrivacySettings);
    };
  }, [activeTab]);

  useEffect(() => {
    if (profileCover && profileCover !== DEFAULT_PROFILE_COVER) {
      localStorage.setItem('gamerin_profile_cover', profileCover);
    } else {
      localStorage.removeItem('gamerin_profile_cover');
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
        const targetHandle = routeUserId || currentUser?.handle || currentUser?.id || '';
        const shouldLoadMyProfile =
          !routeUserId || routeUserId === currentUser?.handle || routeUserId === currentUser?.id;
        const loadedProfile = shouldLoadMyProfile ? await fetchMyProfile() : await fetchUserProfile(targetHandle);
        const [postPage, mediaPage] = await Promise.all([
          fetchUserPosts(loadedProfile.handle),
          fetchUserMedia(loadedProfile.handle),
        ]);

        if (cancelled) {
          return;
        }

        setProfile(loadedProfile);
        setPosts(postPage.items);
        setPostsNextCursor(postPage.nextCursor);
        setPostsHasNext(postPage.hasNext);
        setMediaItems(mediaPage.items);
        setMediaNextCursor(mediaPage.nextCursor);
        setMediaHasNext(mediaPage.hasNext);
        setIsFollowing(Boolean(loadedProfile.followedByMe));

        if (shouldLoadMyProfile) {
          updateUser({
            handle: loadedProfile.handle,
            nickname: loadedProfile.nickname,
            bio: loadedProfile.bio ?? '',
          });
        }
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
  }, [currentUser?.handle, currentUser?.id, routeUserId, updateUser]);

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
    if (!profile || (profile.handle !== currentUser?.handle && profile.id !== currentUser?.id)) {
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

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setPosts((current) =>
      current.map((item) => (item.postId === updatedPost.postId ? updatedPost : item))
    );
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((current) => current.filter((item) => item.postId !== postId));
  };

  const handleSaveUserInfo = async (userInfo: { name: string; bio: string; location: string; website: string }) => {
    if (!profile) return;

    const updatedProfile = await updateMyProfile({
      nickname: userInfo.name.trim() || profile.nickname,
      bio: userInfo.bio.trim(),
    });

    setProfile(updatedProfile);
    updateUser({
      handle: updatedProfile.handle,
      nickname: updatedProfile.nickname,
      name: updatedProfile.nickname,
      bio: updatedProfile.bio ?? '',
    });
  };

  const handleToggleFollow = async () => {
    if (!profile || followLoading) {
      return;
    }

    const previousFollowing = isFollowing;
    const previousFollowersCount = profile.followersCount;
    const nextFollowing = !previousFollowing;

    setIsFollowing(nextFollowing);
    setProfile({
      ...profile,
      followedByMe: nextFollowing,
      followersCount: Math.max(0, previousFollowersCount + (nextFollowing ? 1 : -1)),
    });

    try {
      setFollowLoading(true);
      const nextProfile = nextFollowing ? await followUser(profile.handle) : await unfollowUser(profile.handle);
      setProfile(nextProfile);
      setIsFollowing(Boolean(nextProfile.followedByMe ?? nextFollowing));
    } catch (followError) {
      setIsFollowing(previousFollowing);
      setProfile({
        ...profile,
        followedByMe: previousFollowing,
        followersCount: previousFollowersCount,
      });
      alert(followError instanceof Error ? followError.message : 'Failed to update follow.');
    } finally {
      setFollowLoading(false);
    }
  };

  const saveConnectedAccounts = (nextAccounts: Record<ConnectedPlatformId, ConnectedAccount | null>) => {
    setConnectedAccounts(nextAccounts);
    localStorage.setItem('gamerin_connected_accounts', JSON.stringify(nextAccounts));
  };

  const handleConnectPlatform = (platformId: ConnectedPlatformId) => {
    const handle = normalizeHandle(platformInputs[platformId]);
    if (!handle) {
      alert('연동할 계정 ID를 입력해주세요.');
      return;
    }

    const meta = connectedPlatformMeta[platformId];
    const nextAccounts = {
      ...connectedAccounts,
      [platformId]: {
        id: platformId,
        label: meta.label,
        handle,
        url: meta.buildUrl(handle),
      },
    };

    saveConnectedAccounts(nextAccounts);
    setPlatformInputs({ ...platformInputs, [platformId]: '' });
  };

  const handleDisconnectPlatform = (platformId: ConnectedPlatformId) => {
    const nextAccounts = {
      ...connectedAccounts,
      [platformId]: null,
    };

    saveConnectedAccounts(nextAccounts);
  };

  const renderConnectedAccounts = () => (
    <section className="rounded-2xl border border-zinc-200 bg-white p-6 md:p-8">
      <div className="mb-6">
        <h2 className="text-3xl font-black text-black">연결된 계정</h2>
        <p className="mt-1 text-sm font-bold text-zinc-400">
          YouTube, Twitch, SOOP 채널을 프로필에 표시할 수 있습니다.
        </p>
      </div>

      <div className="space-y-4">
        {(Object.keys(connectedPlatformMeta) as ConnectedPlatformId[]).map((platformId) => {
          const meta = connectedPlatformMeta[platformId];
          const account = connectedAccounts[platformId];
          const Icon = meta.icon;

          return (
            <div key={platformId} className="rounded-2xl bg-zinc-50 p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white ${meta.color}`}>
                    <Icon size={24} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-black text-black">{meta.label}</h3>
                    {account ? (
                      <a
                        href={account.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-sm font-bold text-blue-600 hover:underline"
                      >
                        {account.handle}
                      </a>
                    ) : (
                      <p className="text-sm font-bold text-zinc-400">아직 연결되지 않았습니다.</p>
                    )}
                  </div>
                </div>

                {account ? (
                  <div className="flex gap-2">
                    <a
                      href={account.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-black transition hover:bg-zinc-100"
                    >
                      <ExternalLink size={16} />
                      열기
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDisconnectPlatform(platformId)}
                      className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-red-500 transition hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      해제
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={platformInputs[platformId]}
                      onChange={(event) =>
                        setPlatformInputs({ ...platformInputs, [platformId]: event.target.value })
                      }
                      placeholder={meta.placeholder}
                      className="h-11 min-w-0 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-bold text-black outline-none transition focus:border-black"
                    />
                    <button
                      type="button"
                      onClick={() => handleConnectPlatform(platformId)}
                      className="h-11 rounded-xl bg-black px-5 text-sm font-black text-white transition hover:bg-zinc-800"
                    >
                      연결
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

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

  const isOwnProfile = profile.handle === currentUser.handle || profile.id === currentUser.id;
  const displayedCover = isOwnProfile ? profileCover || DEFAULT_PROFILE_COVER : DEFAULT_PROFILE_COVER;
  const displayedAvatar = isOwnProfile ? profileAvatar || profile.profileImageUrl : profile.profileImageUrl;
  const tabs = [
    { name: 'posts' as const, icon: <Grid size={16} /> },
    ...(privacySettings.showStats ? [{ name: 'stats' as const, icon: <BarChart3 size={16} /> }] : []),
    { name: 'media' as const, icon: <Layers size={16} /> },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-white pb-20">
      <div
        className="relative h-56 overflow-hidden bg-zinc-950"
        style={{
          backgroundImage: `url(${displayedCover})`,
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
              {displayedAvatar ? (
                <Image
                  src={displayedAvatar}
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
            {isOwnProfile ? (
              <>
            <Link
              href="/settings"
              className="rounded-2xl bg-zinc-100 p-3 text-black transition-all hover:bg-zinc-200"
              aria-label="설정"
            >
              <Settings size={20} />
            </Link>
            <button
              onClick={() => setShowEditProfileModal(true)}
              className="flex items-center gap-2 rounded-2xl bg-black px-8 py-3 text-sm font-black text-white shadow-lg shadow-zinc-200 transition-all hover:bg-zinc-800"
            >
              <Edit3 size={18} />
              Edit Profile
            </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => router.push(`/messages?recipient=${encodeURIComponent(profile.handle)}`)}
                  className="rounded-2xl bg-zinc-100 p-3 text-black transition-all hover:bg-zinc-200"
                  aria-label="Message"
                >
                  <MessageCircle size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-black shadow-lg shadow-zinc-200 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
                    isFollowing ? 'bg-zinc-100 text-black hover:bg-zinc-200' : 'bg-black text-white hover:bg-zinc-800'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </>
            )}
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

          {!privacySettings.profilePublic ? (
            <div className="inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-500">
              비공개 프로필 모드
            </div>
          ) : null}

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

              {isOwnProfile ? (
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
              ) : null}
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
              posts.map((post) => (
                <Post
                  key={post.postId}
                  post={post}
                  onShare={handlePostUpdated}
                  onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                  onBookmarkChange={handlePostUpdated}
                />
              ))
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
            {isOwnProfile ? renderConnectedAccounts() : null}

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

      {isOwnProfile && showFetchStatsModal ? <FetchGameStatsModal onClose={() => setShowFetchStatsModal(false)} /> : null}
      {isOwnProfile && showEditProfileModal ? (
        <EditProfileModal
          onClose={() => setShowEditProfileModal(false)}
          coverImage={profileCover}
          onSaveCover={(newCover) => setProfileCover(newCover)}
          avatarImage={profileAvatar}
          onSaveAvatar={(newAvatar) => setProfileAvatar(newAvatar)}
          userInfo={{
            name: profile.nickname,
            bio: profile.bio ?? '',
            location: '',
            website: '',
          }}
          onSaveUserInfo={handleSaveUserInfo}
        />
      ) : null}
    </div>
  );
}
