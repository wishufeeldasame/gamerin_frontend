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
  Globe,
  Play,
  Trash2,
  Tv,
  MessageCircle,
  X,
  Loader2,
  MapPin,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { FetchGameStatsModal } from '@/app/home/components/FetchGameStatsModal';
import { EditProfileModal, type EditProfileUserInfo } from '@/app/home/components/EditProfileModal';
import { Post } from '@/app/home/components/Post';
import {
  PostRecord,
  FollowUserRecord,
  ProfileMediaItem,
  UpdateMyProfilePayload,
  UserProfile,
  fetchFollowers,
  fetchFollowing,
  fetchUserProfile,
  fetchMyProfile,
  fetchUserMedia,
  fetchUserPosts,
  followUser,
  getInitials,
  likePost,
  unfollowUser,
  updateMyProfile,
  unlikePost,
  updatePostLikeState,
  uploadProfileImage,
} from '@/lib/feed-api';
import { DEFAULT_PROFILE_COVER } from '@/lib/profile-constants';
import { PrivacySettings, USER_SETTINGS_CHANGED_EVENT, loadUserSettings } from '@/lib/user-settings';
import {
  disconnectGameStats,
  fetchPubgSummary,
  refreshR6Summary,
  GameStatsApiError,
  type GameName,
  type PubgSummaryResponse,
  type R6SummaryResponse,
  type StatsMode,
} from '@/lib/game-stats-api';

type ProfileTab = 'posts' | 'stats' | 'media';
type FollowListType = 'followers' | 'following';
type PostDetailTarget = 'post' | 'comments';

const GAME_STATS_UI_CONFIG: Record<
  GameName,
  {
    displayName: string;
    disconnectable: boolean;
  }
> = {
  PUBG: {
    displayName: 'PUBG',
    disconnectable: true,
  },
  R6: {
    displayName: 'Rainbow Six Siege',
    disconnectable: true,
  },
};

function withImageCacheBust(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return imageUrl ?? null;
  }

  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}v=${Date.now()}`;
}

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
  return value.trim().replace(/\s+/g, '').toLowerCase();
}

const PROFILE_FOLLOWS_VIEWER_PAGE_SIZE = 100;

async function fetchProfileFollowsViewer(profileHandle: string, viewerHandle?: string | null) {
  if (!viewerHandle) {
    return false;
  }

  const normalizedProfileHandle = profileHandle.toLowerCase();
  const normalizedViewerHandle = viewerHandle.toLowerCase();

  if (normalizedProfileHandle === normalizedViewerHandle) {
    return false;
  }

  try {
    let cursor: string | null = null;

    while (true) {
      const page = await fetchFollowing(profileHandle, cursor, PROFILE_FOLLOWS_VIEWER_PAGE_SIZE);
      const followsViewer = page.items.some((user) => user.handle.toLowerCase() === normalizedViewerHandle);

      if (followsViewer) {
        return true;
      }

      if (!page.hasNext || !page.nextCursor) {
        return false;
      }

      cursor = page.nextCursor;
    }
  } catch {
    return false;
  }
}

type GameStatsRecord = Record<string, unknown>;

function toGameStatsRecord(stats: unknown): GameStatsRecord | null {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    return null;
  }

  return stats as GameStatsRecord;
}

function readStringStat(record: GameStatsRecord, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumberStat(record: GameStatsRecord, key: string) {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isConnectedGameStats(stats: unknown) {
  return toGameStatsRecord(stats)?.connected === true;
}

function readStatsMode(record: GameStatsRecord): StatsMode | null {
  const value = readStringStat(record, 'statsMode');
  return value === 'RANKED' || value === 'NORMAL' ? value : null;
}

function isCommonGameStats(gameName: string) {
  const normalizedGameName = gameName.toLowerCase();
  return normalizedGameName === 'pubg' || normalizedGameName === 'r6';
}

function getDisconnectableGameName(gameName: string): GameName | null {
  const normalizedGameName = gameName.toUpperCase();

  if (normalizedGameName !== 'PUBG' && normalizedGameName !== 'R6') {
    return null;
  }

  return GAME_STATS_UI_CONFIG[normalizedGameName].disconnectable ? normalizedGameName : null;
}

function formatNullablePercent(value: number | null) {
  if (value === null) {
    return '-';
  }

  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatGameStatsSummary(gameName: string, stats: unknown) {
  const record = toGameStatsRecord(stats);
  if (!record) {
    return String(stats ?? '');
  }

  if (!isCommonGameStats(gameName)) {
    return Object.entries(record)
      .filter(
        ([key]) =>
          key !== 'accountId' && key !== 'playerNameNormalized',
      )
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }

  const summaryParts: string[] = [];
  const tierLabel = readStringStat(record, 'tierLabel');
  const winRate = readNumberStat(record, 'winRate');
  const statsMode = readStatsMode(record);
  const kd = readNumberStat(record, 'kd');
  const matches = readNumberStat(record, 'matches');

  if (statsMode === 'RANKED' && tierLabel) {
    summaryParts.push(tierLabel);
  }

  summaryParts.push(`K/D ${kd === null ? '-' : kd.toFixed(2)}`);
  summaryParts.push(`승률 ${formatNullablePercent(winRate)}`);
  summaryParts.push(matches === null ? '경기 수 -' : `${matches.toLocaleString('ko-KR')}게임`);

  return summaryParts.join(' · ');
}

function formatGameStatsDetail(gameName: string, stats: unknown) {
  if (!isCommonGameStats(gameName)) {
    return null;
  }

  const record = toGameStatsRecord(stats);
  if (!record) {
    return null;
  }

  const playerName = readStringStat(record, 'playerName');
  const statsMode = readStatsMode(record);
  const statsModeLabel = statsMode === 'RANKED' ? '경쟁전' : statsMode === 'NORMAL' ? '일반전' : null;

  return [playerName, statsModeLabel].filter(Boolean).join(' · ') || null;
}

function removeGameStats(gameStats: UserProfile['gameStats'], gameName: string): UserProfile['gameStats'] {
  const normalizedGameName = gameName.toLowerCase();
  return Object.fromEntries(
    Object.entries(gameStats).filter(([key]) => key.toLowerCase() !== normalizedGameName),
  );
}

function applyPubgSummary(gameStats: UserProfile['gameStats'], summary: PubgSummaryResponse) {
  if (!summary.connected) {
    return removeGameStats(gameStats, 'PUBG');
  }

  const existing = toGameStatsRecord(gameStats.PUBG) ?? {};

  return {
    ...gameStats,
    PUBG: {
      ...existing,
      game: summary.game,
      connected: true,
      playerName: summary.playerName,
      tierLabel: summary.tierLabel,
      kd: summary.kd,
      winRate: summary.winRate,
      matches: summary.matches,
      statsMode: summary.statsMode,
    },
  };
}

function applyR6Summary(gameStats: UserProfile['gameStats'], summary: R6SummaryResponse) {
  if (!summary.connected) {
    return removeGameStats(gameStats, 'R6');
  }

  const existing = toGameStatsRecord(gameStats.R6) ?? {};
  return {
    ...gameStats,
    R6: {
      ...existing,
      game: summary.game,
      connected: true,
      playerName: summary.playerName,
      platform: summary.platform,
      tierLabel: summary.tierLabel,
      kd: summary.kd,
      winRate: summary.winRate,
      matches: summary.matches,
      statsMode: summary.statsMode,
      updatedAt: summary.updatedAt,
    },
  };
}

function getGameStatsErrorMessage(gameName: 'PUBG' | 'R6', error: unknown) {
  if (!(error instanceof GameStatsApiError)) {
    return error instanceof Error ? error.message : `${gameName} 전적 갱신에 실패했습니다.`;
  }

  if (gameName === 'R6') {
    if (error.status === 404) return 'R6 계정을 찾지 못했습니다. Ubisoft 닉네임을 확인해 주세요.';
    if (error.status === 409) return 'R6 계정 정보가 일치하지 않습니다. 다시 연결해 주세요.';
    if (error.status === 429) return 'R6 전적 조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.status === 502 || error.status === 503) return 'R6 전적 서버를 일시적으로 사용할 수 없습니다.';
  }

  return error.message;
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
  const [followListType, setFollowListType] = useState<FollowListType | null>(null);
  const [followUsers, setFollowUsers] = useState<FollowUserRecord[]>([]);
  const [followNextCursor, setFollowNextCursor] = useState<string | null>(null);
  const [followHasNext, setFollowHasNext] = useState(false);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [followListLoadingMore, setFollowListLoadingMore] = useState(false);
  const [followListError, setFollowListError] = useState<string | null>(null);
  const [followActionHandle, setFollowActionHandle] = useState<string | null>(null);
  const [showFetchStatsModal, setShowFetchStatsModal] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<GameName | null>(null);
  const [isDisconnectingGame, setIsDisconnectingGame] = useState(false);
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
  const [likeLoadingByPostId, setLikeLoadingByPostId] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.removeItem('gamerin_profile_cover');
    localStorage.removeItem('gamerin_profile_avatar');

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
    let cancelled = false;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const targetHandle = routeUserId || currentUser?.handle || currentUser?.id || '';
        const shouldLoadMyProfile =
          !routeUserId || routeUserId === currentUser?.handle || routeUserId === currentUser?.id;
        const loadedProfile = shouldLoadMyProfile ? await fetchMyProfile() : await fetchUserProfile(targetHandle);
        const [postPage, mediaPage, followsViewer] = await Promise.all([
          fetchUserPosts(loadedProfile.handle),
          fetchUserMedia(loadedProfile.handle),
          shouldLoadMyProfile
            ? Promise.resolve(false)
            : fetchProfileFollowsViewer(loadedProfile.handle, currentUser?.handle),
        ]);
        const followedByMe = shouldLoadMyProfile ? false : Boolean(loadedProfile.followedByMe);
        const resolvedProfile = {
          ...loadedProfile,
          followedByMe,
          followsViewer,
        };

        if (cancelled) {
          return;
        }

        setProfile(resolvedProfile);
        setPosts(postPage.items);
        setPostsNextCursor(postPage.nextCursor);
        setPostsHasNext(postPage.hasNext);
        setMediaItems(mediaPage.items);
        setMediaNextCursor(mediaPage.nextCursor);
        setMediaHasNext(mediaPage.hasNext);
        setIsFollowing(followedByMe);

        if (shouldLoadMyProfile) {
          setProfileCover(loadedProfile.coverImageUrl || null);
          setProfileAvatar(loadedProfile.profileImageUrl);
          updateUser({
            handle: loadedProfile.handle,
            nickname: loadedProfile.nickname,
            name: loadedProfile.nickname,
            bio: loadedProfile.bio ?? '',
            location: loadedProfile.location ?? '',
            website: loadedProfile.website ?? '',
            profileImageUrl: loadedProfile.profileImageUrl,
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
      summary: formatGameStatsSummary(gameName, stats),
      detail: formatGameStatsDetail(gameName, stats),
      disconnectGameName: getDisconnectableGameName(gameName),
    }));
  }, [profile?.gameStats]);

  const handleRefreshStats = async () => {
    if (
      !profile ||
      isRefreshing ||
      (profile.handle !== currentUser?.handle && profile.id !== currentUser?.id)
    ) {
      return;
    }

    const refreshRequests: Array<{
      gameName: 'PUBG' | 'R6';
      request: () => Promise<PubgSummaryResponse | R6SummaryResponse>;
    }> = [];

    if (isConnectedGameStats(profile.gameStats.PUBG)) {
      refreshRequests.push({ gameName: 'PUBG', request: fetchPubgSummary });
    }
    if (isConnectedGameStats(profile.gameStats.R6)) {
      refreshRequests.push({ gameName: 'R6', request: refreshR6Summary });
    }

    if (refreshRequests.length === 0) {
      alert('새로고칠 연결된 게임 전적이 없습니다.');
      return;
    }

    try {
      setIsRefreshing(true);
      const results = await Promise.allSettled(refreshRequests.map(({ request }) => request()));
      let updatedGameStats = profile.gameStats;
      const failures: string[] = [];
      const disconnectedGames = new Set<string>();

      results.forEach((result, index) => {
        const gameName = refreshRequests[index]?.gameName;
        if (!gameName) {
          return;
        }

        if (result.status === 'rejected') {
          failures.push(`${gameName}: ${getGameStatsErrorMessage(gameName, result.reason)}`);
          return;
        }

        if (!result.value.connected) {
          disconnectedGames.add(gameName);
        }

        updatedGameStats =
          gameName === 'R6'
            ? applyR6Summary(updatedGameStats, result.value as R6SummaryResponse)
            : applyPubgSummary(updatedGameStats, result.value as PubgSummaryResponse);
      });

      let nextProfile: UserProfile = {
        ...profile,
        gameStats: updatedGameStats,
      };

      try {
        const refreshed = await fetchMyProfile();
        nextProfile = {
          ...refreshed,
          followedByMe: false,
        };
        setProfileCover(refreshed.coverImageUrl || null);
        setProfileAvatar(refreshed.profileImageUrl);
      } catch (profileRefreshError) {
        failures.push(
          profileRefreshError instanceof Error
            ? `프로필 반영: ${profileRefreshError.message}`
            : '프로필 반영: 프로필을 다시 불러오지 못했습니다.',
        );
      }

      for (const gameName of disconnectedGames) {
        nextProfile = {
          ...nextProfile,
          gameStats: removeGameStats(nextProfile.gameStats, gameName),
        };
      }

      setProfile(nextProfile);

      if (failures.length > 0) {
        alert(`일부 전적을 갱신하지 못했습니다.\n${failures.join('\n')}`);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGameConnected = async () => {
    const refreshed = await fetchMyProfile();
    setProfile({
      ...refreshed,
      followedByMe: false,
    });
    setProfileCover(refreshed.coverImageUrl || null);
    setProfileAvatar(refreshed.profileImageUrl);
  };

  const handleDisconnectGame = async () => {
    const gameName = disconnectTarget;

    if (!gameName || isDisconnectingGame) {
      return;
    }

    try {
      setIsDisconnectingGame(true);
      await disconnectGameStats(gameName);
      setProfile((current) =>
        current
          ? {
              ...current,
              gameStats: removeGameStats(current.gameStats, gameName),
            }
          : current,
      );
      setDisconnectTarget(null);
    } catch (disconnectError) {
      alert(getGameStatsErrorMessage(gameName, disconnectError));
    } finally {
      setIsDisconnectingGame(false);
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
    setMediaItems((current) => current.filter((item) => item.postId !== postId));
  };

  const handleToggleLike = async (post: PostRecord) => {
    if (likeLoadingByPostId[post.postId]) {
      return;
    }

    const optimistic = updatePostLikeState(post);
    setLikeLoadingByPostId((current) => ({ ...current, [post.postId]: true }));

    setPosts((current) =>
      current.map((item) => (item.postId === post.postId ? optimistic : item))
    );

    try {
      if (post.likedByMe) {
        await unlikePost(post.postId);
      } else {
        await likePost(post.postId);
      }
    } catch (likeError) {
      setPosts((current) =>
        current.map((item) => (item.postId === post.postId ? post : item))
      );
      alert(likeError instanceof Error ? likeError.message : 'Failed to update like.');
    } finally {
      setLikeLoadingByPostId((current) => {
        const next = { ...current };
        delete next[post.postId];
        return next;
      });
    }
  };

  const handleOpenPost = (postId: string, target: PostDetailTarget = 'post') => {
    const search = target === 'comments' ? '?target=comments' : '';
    router.push(`/posts/${encodeURIComponent(postId)}${search}`);
  };

  const handleSaveUserInfo = async (userInfo: EditProfileUserInfo) => {
    if (!profile) return;

    const [profileImageUpload, coverImageUpload] = await Promise.all([
      userInfo.profileImageFile ? uploadProfileImage('PROFILE', userInfo.profileImageFile) : Promise.resolve(null),
      userInfo.coverImageFile ? uploadProfileImage('COVER', userInfo.coverImageFile) : Promise.resolve(null),
    ]);

    const updatePayload: UpdateMyProfilePayload = {
      nickname: userInfo.name,
      bio: userInfo.bio,
      location: userInfo.location,
      website: userInfo.website,
    };

    if (!userInfo.coverImageFile && profile.coverImageUrl && !userInfo.coverImageUrl) {
      updatePayload.coverImageUrl = '';
    }

    const updatedProfile = await updateMyProfile(updatePayload);
    const nextProfileImageUrl = profileImageUpload
      ? withImageCacheBust(profileImageUpload.imageUrl)
      : updatedProfile.profileImageUrl;
    const nextCoverImageUrl = coverImageUpload
      ? withImageCacheBust(coverImageUpload.imageUrl)
      : updatedProfile.coverImageUrl;

    setProfile({
      ...updatedProfile,
      profileImageUrl: nextProfileImageUrl,
      coverImageUrl: nextCoverImageUrl,
      followedByMe: false,
    });
    setProfileCover(nextCoverImageUrl || null);
    setProfileAvatar(nextProfileImageUrl);
    updateUser({
      handle: updatedProfile.handle,
      nickname: updatedProfile.nickname,
      name: updatedProfile.nickname,
      bio: updatedProfile.bio ?? '',
      location: updatedProfile.location ?? '',
      website: updatedProfile.website ?? '',
      profileImageUrl: nextProfileImageUrl,
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
      if (nextFollowing) {
        await followUser(profile.handle);
      } else {
        await unfollowUser(profile.handle);
      }
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

  const loadFollowList = async (type: FollowListType, cursor?: string | null) => {
    if (!profile) return;

    try {
      if (cursor) {
        setFollowListLoadingMore(true);
      } else {
        setFollowListLoading(true);
        setFollowUsers([]);
      }

      setFollowListError(null);
      const page =
        type === 'followers'
          ? await fetchFollowers(profile.handle, cursor)
          : await fetchFollowing(profile.handle, cursor);

      setFollowUsers((current) => (cursor ? [...current, ...page.items] : page.items));
      setFollowNextCursor(page.nextCursor);
      setFollowHasNext(page.hasNext);
    } catch (loadError) {
      setFollowListError(loadError instanceof Error ? loadError.message : 'Failed to load users.');
    } finally {
      setFollowListLoading(false);
      setFollowListLoadingMore(false);
    }
  };

  const openFollowList = (type: FollowListType) => {
    setFollowListType(type);
    void loadFollowList(type);
  };

  const closeFollowList = () => {
    setFollowListType(null);
    setFollowUsers([]);
    setFollowNextCursor(null);
    setFollowHasNext(false);
    setFollowListError(null);
  };

  const handleToggleFollowUser = async (target: FollowUserRecord) => {
    if (followActionHandle || target.handle === currentUser?.handle) {
      return;
    }

    const nextFollowing = !target.isFollowing;
    setFollowActionHandle(target.handle);
    setFollowUsers((current) =>
      current.map((user) =>
        user.handle === target.handle ? { ...user, isFollowing: nextFollowing } : user
      )
    );

    try {
      if (nextFollowing) {
        await followUser(target.handle);
      } else {
        await unfollowUser(target.handle);
      }
    } catch (followError) {
      setFollowUsers((current) =>
        current.map((user) =>
          user.handle === target.handle ? { ...user, isFollowing: target.isFollowing } : user
        )
      );
      alert(followError instanceof Error ? followError.message : 'Failed to update follow.');
    } finally {
      setFollowActionHandle(null);
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
  const disconnectTargetConfig = disconnectTarget ? GAME_STATS_UI_CONFIG[disconnectTarget] : null;
  const displayedCover =
    (isOwnProfile ? profileCover || profile.coverImageUrl : profile.coverImageUrl) || DEFAULT_PROFILE_COVER;
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
                  title="Message"
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
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-bold tracking-tight text-zinc-400">@{profile.handle}</p>
              {!isOwnProfile && profile.followsViewer ? (
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-black leading-none tracking-tight text-zinc-500">
                  나를 팔로우합니다
                </span>
              ) : null}
            </div>
          </div>

          <p className="max-w-xl whitespace-pre-wrap text-[17px] font-medium leading-relaxed text-zinc-800">
            {profile.bio || 'Tell your gaming story on GamerIN.'}
          </p>

          {profile.location || profile.website ? (
            <div className="flex max-w-xl flex-wrap gap-4 text-sm font-bold text-zinc-500">
              {profile.location ? (
                <div className="flex min-w-0 items-center gap-1.5">
                  <MapPin size={16} className="shrink-0" />
                  <span className="truncate">{profile.location}</span>
                </div>
              ) : null}
              {profile.website ? (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-w-0 max-w-full items-center gap-1.5 transition hover:text-black"
                >
                  <Globe size={16} className="shrink-0" />
                  <span className="truncate">{profile.website.replace(/^https?:\/\//i, '')}</span>
                </a>
              ) : null}
            </div>
          ) : null}

          {!privacySettings.profilePublic ? (
            <div className="inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-black text-zinc-500">
              비공개 프로필 모드
            </div>
          ) : null}

          <div className="flex gap-8 pt-2">
            <button
              type="button"
              onClick={() => openFollowList('followers')}
              className="flex items-center gap-2 text-left transition hover:opacity-70"
            >
              <span className="text-2xl font-black tracking-tighter text-black">
                {profile.followersCount.toLocaleString()}
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Followers</span>
            </button>
            <button
              type="button"
              onClick={() => openFollowList('following')}
              className="flex items-center gap-2 text-left transition hover:opacity-70"
            >
              <span className="text-2xl font-black tracking-tighter text-black">
                {profile.followingCount.toLocaleString()}
              </span>
              <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Following</span>
            </button>
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
              activeTab === tab.name ? 'text-black dark:text-[#f5b93d]' : 'text-zinc-300 hover:text-zinc-500'
            }`}
          >
            {tab.icon}
            {tab.name}
            {activeTab === tab.name ? (
              <motion.div layoutId="activeTab" className="absolute left-0 right-0 bottom-0 h-1 rounded-full bg-black dark:bg-[#f5b93d]" />
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

                  <button
                    type="button"
                    onClick={() => void handleRefreshStats()}
                    disabled={isRefreshing}
                    className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="연결된 게임 전적 새로고침"
                  >
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
                        {entry.detail ? (
                          <p className="max-w-xl truncate text-xs font-bold text-zinc-400">{entry.detail}</p>
                        ) : null}
                        <p className="mt-1 max-w-xl truncate text-base text-slate-600">{entry.summary}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-right">
                      <p className="text-sm font-black uppercase tracking-widest text-zinc-400">Live sync</p>
                      {isOwnProfile && entry.disconnectGameName ? (
                        <button
                          type="button"
                          onClick={() => setDisconnectTarget(entry.disconnectGameName)}
                          className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label={`${GAME_STATS_UI_CONFIG[entry.disconnectGameName].displayName} 전적 연동 해제`}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}

        {activeTab === 'posts' ? (
          <div className="mx-auto max-w-2xl space-y-4">
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
                  likeLoading={Boolean(likeLoadingByPostId[post.postId])}
                  onToggleLike={handleToggleLike}
                  onOpenDetail={(selected) => handleOpenPost(selected.postId)}
                  onOpenComments={(selected) => handleOpenPost(selected.postId, 'comments')}
                  onShare={handlePostUpdated}
                  onRepostChange={handlePostUpdated}
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
                  <button
                    key={item.mediaId}
                    type="button"
                    onClick={() => handleOpenPost(item.postId)}
                    className="group relative aspect-square overflow-hidden rounded-[24px] border border-zinc-100 bg-zinc-50 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-black hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    aria-label={`${item.mediaType === 'VIDEO' ? '동영상' : '이미지'} 게시물 상세 보기`}
                  >
                    {item.mediaType === 'VIDEO' ? (
                      <>
                        <video
                          muted
                          playsInline
                          preload="metadata"
                          poster={item.thumbnailUrl ?? undefined}
                          src={item.mediaUrl}
                          className="h-full w-full bg-black object-cover transition duration-300 group-hover:scale-105"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/15 text-white">
                          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                            <Play size={22} className="ml-0.5 fill-white" />
                          </span>
                        </span>
                      </>
                    ) : (
                      <div className="relative h-full w-full">
                        <Image src={item.mediaUrl} alt="Profile media" fill unoptimized className="object-cover" />
                      </div>
                    )}
                  </button>
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

      {isOwnProfile && showFetchStatsModal ? (
        <FetchGameStatsModal
          onClose={() => setShowFetchStatsModal(false)}
          onConnected={handleGameConnected}
        />
      ) : null}
      {isOwnProfile && disconnectTarget && disconnectTargetConfig ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-2xl">
            <h2 className="text-2xl font-black tracking-tight text-black">
              {disconnectTargetConfig.displayName} 전적 연동을 해제할까요?
            </h2>
            <p className="mt-3 text-base font-bold text-zinc-500">
              {disconnectTargetConfig.displayName} 전적만 프로필에서 제거됩니다. 다른 게임 전적은 유지됩니다.
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDisconnectTarget(null)}
                disabled={isDisconnectingGame}
                className="rounded-2xl px-5 py-3 text-sm font-black text-zinc-500 transition hover:bg-zinc-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnectGame()}
                disabled={isDisconnectingGame}
                className="rounded-2xl bg-red-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-red-100 transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {isDisconnectingGame ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {isOwnProfile && showEditProfileModal ? (
        <EditProfileModal
          onClose={() => setShowEditProfileModal(false)}
          coverImage={profileCover || profile.coverImageUrl}
          avatarImage={profileAvatar || profile.profileImageUrl}
          userInfo={{
            name: profile.nickname,
            bio: profile.bio ?? '',
            location: profile.location ?? '',
            website: profile.website ?? '',
          }}
          onSaveUserInfo={handleSaveUserInfo}
        />
      ) : null}
      {followListType ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[82vh] w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400">
                  @{profile.handle}
                </p>
                <h2 className="text-2xl font-black text-black">
                  {followListType === 'followers' ? 'Followers' : 'Following'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeFollowList}
                className="rounded-xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[58vh] overflow-y-auto p-4">
              {followListLoading ? (
                <div className="flex h-44 items-center justify-center text-sm font-bold text-zinc-400">
                  <Loader2 size={18} className="mr-2 animate-spin" />
                  Loading users...
                </div>
              ) : followListError ? (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  {followListError}
                </div>
              ) : followUsers.length === 0 ? (
                <div className="py-16 text-center text-sm font-bold text-zinc-400">
                  No users yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {followUsers.map((followUserRecord) => {
                    const isMe =
                      followUserRecord.handle === currentUser.handle ||
                      followUserRecord.userId === currentUser.id;

                    return (
                      <div
                        key={`${followUserRecord.userId}-${followUserRecord.followedAt}`}
                        className="flex items-center justify-between gap-3 rounded-2xl p-3 transition hover:bg-zinc-50"
                      >
                        <Link
                          href={`/profile/${encodeURIComponent(followUserRecord.handle)}`}
                          onClick={closeFollowList}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black text-sm font-black text-white">
                            {followUserRecord.profileImageUrl ? (
                              <Image
                                src={followUserRecord.profileImageUrl}
                                alt={followUserRecord.nickname}
                                fill
                                unoptimized
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              getInitials(followUserRecord.nickname)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-black">
                              {followUserRecord.nickname}
                            </p>
                            <p className="truncate text-xs font-bold text-zinc-400">
                              @{followUserRecord.handle}
                            </p>
                            {followUserRecord.bio ? (
                              <p className="mt-1 line-clamp-1 text-xs font-medium text-zinc-500">
                                {followUserRecord.bio}
                              </p>
                            ) : null}
                          </div>
                        </Link>

                        {!isMe ? (
                          <button
                            type="button"
                            onClick={() => handleToggleFollowUser(followUserRecord)}
                            disabled={followActionHandle === followUserRecord.handle}
                            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              followUserRecord.isFollowing
                                ? 'bg-zinc-100 text-black hover:bg-zinc-200'
                                : 'bg-black text-white hover:bg-zinc-800'
                            }`}
                          >
                            {followUserRecord.isFollowing ? 'Following' : 'Follow'}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {followHasNext ? (
              <div className="border-t border-zinc-100 p-4">
                <button
                  type="button"
                  onClick={() => void loadFollowList(followListType, followNextCursor)}
                  disabled={followListLoadingMore}
                  className="w-full rounded-2xl border border-zinc-100 bg-white px-5 py-3 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:text-zinc-300"
                >
                  {followListLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
