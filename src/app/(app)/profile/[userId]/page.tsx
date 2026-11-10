'use client';

import { useToast } from '@/app/context/ToastContext';

import Image from 'next/image';
import Link from 'next/link';
import { PostListSkeleton, ProfileSkeleton, UserRowsSkeleton } from '@/app/home/components/LoadingSkeletons';
import {
  Plus,
  RefreshCw,
  Globe,
  Play,
  Trash2,
  MessageCircle,
  MoreHorizontal,
  Flag,
  X,
  MapPin,
  Gamepad2,
} from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { assertCurrentAuthGeneration, getAuthGeneration, isCurrentAuthGeneration } from '@/lib/auth-store';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/app/context/AuthContext';
import { FetchGameStatsModal } from '@/app/home/components/FetchGameStatsModal';
import { EditProfileModal, type EditProfileUserInfo } from '@/app/home/components/EditProfileModal';
import { Post } from '@/app/home/components/Post';
import { ReportContentModal } from '@/app/home/components/Report';
import { SuggestedFriendsCard } from '@/app/home/components/SuggestedFriendsCard';
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
  getPostHref,
  unfollowUser,
  updateMyProfile,
  uploadProfileImage,
} from '@/lib/feed-api';
import { updatePostsLikeState } from '@/lib/post-mutations';
import { DEFAULT_PROFILE_COVER } from '@/lib/profile-constants';
import { formatRelativeTimeLabel, parseDisplayTime } from '@/lib/time-format';
import { updatePostsBookmarkState, updatePostsRepostState } from '@/lib/post-mutations';
import {
  disconnectGameStats,
  fetchPubgSummary,
  fetchLolSummary,
  refreshR6Summary,
  refreshValorantSummary,
  GameStatsApiError,
  type GameName,
  type PubgSummaryResponse,
  type LolSummaryResponse,
  type R6SummaryResponse,
  type StatsMode,
  type ValorantSummaryResponse,
} from '@/lib/game-stats-api';
import { useCursorList } from '@/hooks/useCursorList';
import { usePostLike } from '@/hooks/usePostLike';
import { MembershipBadge } from '@/app/home/components/MembershipBadge';
import { RepresentativeTierBadge } from '@/app/home/components/RepresentativeTierBadge';

type ProfileTab = 'posts' | 'stats' | 'media';
type FollowListType = 'followers' | 'following';
type PostDetailTarget = 'post' | 'comments';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

const GAME_STATS_UI_CONFIG: Record<
  GameName,
  {
    displayName: string;
    disconnectable: boolean;
  }
> = {
  LOL: {
    displayName: 'League of Legends',
    disconnectable: true,
  },
  PUBG: {
    displayName: 'PUBG',
    disconnectable: true,
  },
  R6: {
    displayName: 'Rainbow Six Siege',
    disconnectable: true,
  },
  VALORANT: {
    displayName: 'VALORANT',
    disconnectable: true,
  },
};

const GAME_ICON_MAP: Record<string, { url: string; invertInDark?: boolean }> = {
  PUBG: { url: '/images/games/pubg.png' },
  R6: { url: '/images/games/rainbow6.png', invertInDark: true },
  'RAINBOW SIX SIEGE': { url: '/images/games/rainbow6.png', invertInDark: true },
  'LEAGUE OF LEGENDS': { url: '/images/games/lol.png' },
  LOL: { url: '/images/games/lol.png' },
  VALORANT: { url: '/images/games/valorant.png' },
  'OVERWATCH 2': { url: '/images/games/overwatch2.png' },
  CS2: { url: '/images/games/cs2.png', invertInDark: true },
  'APEX LEGENDS': { url: '/images/games/apexlegend.png', invertInDark: true },
};

function getGameIconMeta(gameName: string) {
  return GAME_ICON_MAP[gameName.trim().toUpperCase()] ?? null;
}

function withImageCacheBust(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return imageUrl ?? null;
  }

  const separator = imageUrl.includes('?') ? '&' : '?';
  return `${imageUrl}${separator}v=${Date.now()}`;
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

  if (
    normalizedGameName !== 'PUBG' && normalizedGameName !== 'R6'
    && normalizedGameName !== 'LOL' && normalizedGameName !== 'VALORANT'
  ) {
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

type GameStatMetric = { label: string; value: string };

function formatGameStats(gameName: string, stats: unknown, isOwnProfile: boolean): GameStatMetric[] | string {
  const record = toGameStatsRecord(stats);
  if (!record) return String(stats ?? '');

  const game = gameName.toUpperCase();
  const tier = readStringStat(record, 'tierLabel');
  const matches = readNumberStat(record, game === 'LOL' ? 'games' : 'matches');
  const ratio = readNumberStat(record, game === 'LOL' ? 'kda' : 'kd');

  if (
    (game === 'LOL' && ratio === null && matches === null)
    || (game === 'VALORANT' && !tier && matches === null)
  ) {
    return isOwnProfile ? '계정 연결됨 · 전적 새로고침으로 불러와 주세요.' : '계정 연결됨';
  }

  if (game !== 'LOL' && game !== 'VALORANT' && !isCommonGameStats(game)) {
    return Object.entries(record)
      .filter(([key]) => key !== 'accountId' && key !== 'playerNameNormalized')
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }

  const metrics: GameStatMetric[] = [];
  if (game === 'LOL') {
    metrics.push({ label: '티어', value: tier ?? 'UNRANKED' });
  } else if (game === 'VALORANT') {
    // HenrikDev 티어 표기를 유지하고 최근 경쟁전 지표를 표시한다.
    const rr = readNumberStat(record, 'rr');
    const peak = readStringStat(record, 'peakTierLabel');
    metrics.push({ label: '티어', value: `${tier ?? 'Unrated'}${rr === null ? '' : ` ${rr}RR`}` });
    if (peak) metrics.push({ label: '최고', value: peak });
  } else if (readStatsMode(record) === 'RANKED' && tier) {
    metrics.push({ label: '티어', value: tier });
  }

  metrics.push({ label: game === 'LOL' ? 'KDA' : 'K/D', value: ratio?.toFixed(2) ?? '-' });
  if (game === 'VALORANT') {
    metrics.push(
      { label: 'ACS', value: String(readNumberStat(record, 'acs') ?? '-') },
      { label: '헤드샷', value: formatNullablePercent(readNumberStat(record, 'headshotRate')) },
    );
  }
  metrics.push(
    { label: '승률', value: formatNullablePercent(readNumberStat(record, 'winRate')) },
    { label: '판수', value: matches?.toLocaleString('ko-KR') ?? '-' },
  );
  return metrics;
}

const VALORANT_REFRESH_COOLDOWN_MS = 10 * 60 * 1000;

/** 마지막 갱신 뒤 10분이 지나지 않았으면 남은 분(올림), 아니면 0. */
function getValorantRefreshWaitMinutes(stats: unknown, now = Date.now()) {
  const record = toGameStatsRecord(stats);
  if (!record?.connected) return 0;
  const updatedAt = Date.parse(readStringStat(record, 'updatedAt') ?? '');
  if (Number.isNaN(updatedAt)) return 0;
  const remaining = updatedAt + VALORANT_REFRESH_COOLDOWN_MS - now;
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0;
}

function formatValorantDetail(stats: unknown) {
  const record = toGameStatsRecord(stats);
  if (!record) return null;
  // riotId는 본인 응답에만 포함된다.
  const riotName = readStringStat(record, 'riotId')?.split('#')[0] ?? null;
  return ['경쟁전', readStringStat(record, 'region'), riotName].filter(Boolean).join(' ');
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

  return [statsModeLabel, playerName].filter(Boolean).join(' ') || null;
}

function removeGameStats(gameStats: UserProfile['gameStats'], gameName: string): UserProfile['gameStats'] {
  const normalizedGameName = gameName.toLowerCase();
  return Object.fromEntries(
    Object.entries(gameStats).filter(([key]) =>
      key.toLowerCase() !== normalizedGameName && !(normalizedGameName === 'lol' && key.toLowerCase() === 'riot'),
    ),
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

function applyLolSummary(gameStats: UserProfile['gameStats'], summary: LolSummaryResponse) {
  if (!summary.connected) return removeGameStats(gameStats, 'LOL');
  return {
    ...gameStats,
    LOL: { connected: true, tierLabel: summary.tierLabel, kda: summary.kda, winRate: summary.winRate, games: summary.games },
  };
}

function applyValorantSummary(gameStats: UserProfile['gameStats'], summary: ValorantSummaryResponse) {
  if (!summary.connected) return removeGameStats(gameStats, 'VALORANT');
  return { ...gameStats, VALORANT: { ...(toGameStatsRecord(gameStats.VALORANT) ?? {}), ...summary } };
}

function getGameStatsErrorMessage(gameName: GameName, error: unknown) {
  if (!(error instanceof GameStatsApiError)) {
    return error instanceof Error ? error.message : `${gameName} 전적 갱신에 실패했습니다.`;
  }

  if (gameName === 'R6') {
    if (error.status === 404) return 'R6 계정을 찾지 못했습니다. Ubisoft 닉네임을 확인해 주세요.';
    if (error.status === 409) return 'R6 계정 정보가 일치하지 않습니다. 다시 연결해 주세요.';
    if (error.status === 429) return 'R6 전적 조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.status === 502 || error.status === 503) return 'R6 전적 서버를 일시적으로 사용할 수 없습니다.';
  }

  if (gameName === 'VALORANT') {
    if (error.status === 429) return '발로란트 전적 조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.';
    if (error.status === 502 || error.status === 503) return '발로란트 전적 서버를 일시적으로 사용할 수 없습니다.';
  }

  if (gameName === 'LOL' && (error.status === 403 || error.status === 503)) {
    return 'Riot 전적 서버를 일시적으로 사용할 수 없습니다.';
  }

  return error.message;
}

export default function ProfilePage() {
  const toast = useToast();
  const params = useParams<{ userId?: string }>();
  const router = useRouter();
  const { user: currentUser, updateUser } = useAuth();
  const requireAuth = useRequireAuth();
  const routeUserId = typeof params.userId === 'string' ? decodeURIComponent(params.userId) : '';
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');
  const tabsId = useId();
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
  const [profileReportMenuOpen, setProfileReportMenuOpen] = useState(false);
  const [profileReportOpen, setProfileReportOpen] = useState(false);
  const [profileCover, setProfileCover] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mediaItems, setMediaItems] = useState<ProfileMediaItem[]>([]);
  const [mediaNextCursor, setMediaNextCursor] = useState<string | null>(null);
  const [mediaHasNext, setMediaHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profileHandle = profile?.handle ?? '';
  const loadProfilePostPage = useCallback(
    (cursor: string | null, { signal }: { signal: AbortSignal }) =>
      fetchUserPosts(profileHandle, cursor, 20, { signal }),
    [profileHandle],
  );
  const {
    items: posts,
    setItems: setPosts,
    hasNext: postsHasNext,
    loading: postsLoading,
    loadingMore: loadingMorePosts,
    error: postsError,
    reload: reloadPosts,
    loadMore: loadMorePosts,
  } = useCursorList({
    loadPage: loadProfilePostPage,
    getKey: (post: PostRecord) => post.postId,
    queryKey: `${profileHandle}:${currentUser?.id ?? 'guest'}`,
    enabled: Boolean(profileHandle),
    initialErrorMessage: '게시글을 불러오지 못했습니다.',
    loadMoreErrorMessage: '게시글을 더 불러오지 못했습니다.',
  });
  const applyLikeState = useCallback((postId: string, likedByMe: boolean) => {
    setPosts((current) => updatePostsLikeState(current, postId, likedByMe));
  }, [setPosts]);
  const { toggleLike, likeLoadingByPostId } = usePostLike(applyLikeState);

  useEffect(() => {
    localStorage.removeItem('gamerin_profile_cover');
    localStorage.removeItem('gamerin_profile_avatar');

  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (!routeUserId && !currentUser?.id) return;
      const viewerGeneration = getAuthGeneration();
      try {
        setLoading(true);
        setError(null);
        const targetHandle = routeUserId || currentUser?.handle || currentUser?.id || '';
        const shouldLoadMyProfile =
          !routeUserId || routeUserId === currentUser?.handle || routeUserId === currentUser?.id;
        const loadedProfile = shouldLoadMyProfile ? await fetchMyProfile() : await fetchUserProfile(targetHandle);
        const mediaPage = await fetchUserMedia(loadedProfile.handle);
        const followedByMe = shouldLoadMyProfile ? false : Boolean(loadedProfile.followedByMe);
        const followsViewer = shouldLoadMyProfile ? false : Boolean(loadedProfile.followsViewer);
        const resolvedProfile = {
          ...loadedProfile,
          followedByMe,
          followsViewer,
        };

        if (cancelled || !isCurrentAuthGeneration(viewerGeneration)) {
          return;
        }

        setProfile(resolvedProfile);
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
            representativeTier: loadedProfile.representativeTier ?? null,
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '프로필을 불러오지 못했습니다.');
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

    const isOwnProfile = profile.handle === currentUser?.handle || profile.id === currentUser?.id;
    // riotId는 본인 응답에만 포함되므로 다른 사용자 프로필에서는 닉네임을 표시하지 않는다.
    const riotId = readStringStat(toGameStatsRecord(profile.gameStats.RIOT) ?? {}, 'riotId');
    const entries = Object.entries(profile.gameStats).filter(([key]) => key.toUpperCase() !== 'RIOT');
    if (isConnectedGameStats(profile.gameStats.RIOT) && !entries.some(([key]) => key.toUpperCase() === 'LOL')) {
      entries.push(['LOL', { connected: true }]);
    }
    return entries.map(([gameName, stats]) => ({
      gameName,
      displayName: gameName.toUpperCase() === 'LOL' ? 'League of Legends' : gameName,
      stats: formatGameStats(gameName, stats, isOwnProfile),
      detail: gameName.toUpperCase() === 'LOL'
        ? riotId?.split('#')[0] ?? null
        : gameName.toUpperCase() === 'VALORANT'
        ? formatValorantDetail(stats)
        : formatGameStatsDetail(gameName, stats),
      disconnectGameName: getDisconnectableGameName(gameName),
      // 서버가 마지막 갱신 시각(updatedAt)을 준 게임만 "N분 전"을 표시한다.
      syncedAt: readStringStat(toGameStatsRecord(stats) ?? {}, 'updatedAt'),
    }));
  }, [profile?.gameStats, profile?.handle, profile?.id, currentUser?.handle, currentUser?.id]);

  const handleRefreshStats = async () => {
    if (
      !profile ||
      isRefreshing || isDisconnectingGame ||
      (profile.handle !== currentUser?.handle && profile.id !== currentUser?.id)
    ) {
      return;
    }

    const refreshRequests: Array<{
      gameName: GameName;
      request: () => Promise<PubgSummaryResponse | R6SummaryResponse | LolSummaryResponse | ValorantSummaryResponse>;
    }> = [];

    if (isConnectedGameStats(profile.gameStats.PUBG)) {
      refreshRequests.push({ gameName: 'PUBG', request: fetchPubgSummary });
    }
    if (isConnectedGameStats(profile.gameStats.R6)) {
      refreshRequests.push({ gameName: 'R6', request: refreshR6Summary });
    }
    if (isConnectedGameStats(profile.gameStats.RIOT) || isConnectedGameStats(profile.gameStats.LOL)) {
      refreshRequests.push({ gameName: 'LOL', request: fetchLolSummary });
    }
    // 서버도 10분 안의 재조회는 외부 API를 부르지 않고 저장값을 돌려준다(HenrikDev 호출 한도).
    const valorantWaitMinutes = getValorantRefreshWaitMinutes(profile.gameStats.VALORANT);
    if (isConnectedGameStats(profile.gameStats.VALORANT) && valorantWaitMinutes === 0) {
      refreshRequests.push({ gameName: 'VALORANT', request: refreshValorantSummary });
    }
    const valorantCooldownNotice = valorantWaitMinutes > 0
      ? `발로란트 전적은 10분마다 새로고침할 수 있습니다. ${valorantWaitMinutes}분 뒤 다시 시도해 주세요.`
      : null;

    if (refreshRequests.length === 0) {
      toast.info(valorantCooldownNotice ?? '새로고침할 게임 전적이 없습니다.');
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
          gameName === 'LOL'
            ? applyLolSummary(updatedGameStats, result.value as LolSummaryResponse)
            : gameName === 'R6'
            ? applyR6Summary(updatedGameStats, result.value as R6SummaryResponse)
            : gameName === 'VALORANT'
            ? applyValorantSummary(updatedGameStats, result.value as ValorantSummaryResponse)
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
        // 대표 게임 티어가 바뀌었을 수 있으므로 사이드바 등 인증 사용자 표시도 맞춘다.
        updateUser({ representativeTier: refreshed.representativeTier ?? null });
        setProfileCover(refreshed.coverImageUrl || null);
        setProfileAvatar(refreshed.profileImageUrl);
      } catch (profileRefreshError) {
        failures.push(
          profileRefreshError instanceof Error
            ? `프로필 반영: ${profileRefreshError.message}`
            : '프로필을 다시 불러오지 못했습니다.',
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
        toast.error(`일부 전적을 갱신하지 못했습니다.\n${failures.join('\n')}`);
      }
      if (valorantCooldownNotice) {
        toast.info(valorantCooldownNotice);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGameConnected = async () => {
    const refreshed = await fetchMyProfile();
    updateUser({ representativeTier: refreshed.representativeTier ?? null });
    setProfile({
      ...refreshed,
      followedByMe: false,
    });
    setProfileCover(refreshed.coverImageUrl || null);
    setProfileAvatar(refreshed.profileImageUrl);
  };

  const handleDisconnectGame = async () => {
    const gameName = disconnectTarget;

    if (!gameName || isDisconnectingGame || isRefreshing) {
      return;
    }

    try {
      setIsDisconnectingGame(true);
      await disconnectGameStats(gameName);
      // 서버가 해제한 게임이 대표였다면 대표 설정도 비우므로 화면 상태를 맞춘다.
      const wasRepresentative = currentUser?.representativeGame === gameName;
      setProfile((current) =>
        current
          ? {
              ...current,
              gameStats: removeGameStats(current.gameStats, gameName),
              ...(wasRepresentative ? { representativeTier: null } : {}),
            }
          : current,
      );
      if (wasRepresentative) {
        updateUser({ representativeGame: null, representativeTier: null });
      }
      setDisconnectTarget(null);
    } catch (disconnectError) {
      toast.error(getGameStatsErrorMessage(gameName, disconnectError));
    } finally {
      setIsDisconnectingGame(false);
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
      toast.error(loadError instanceof Error ? loadError.message : '미디어를 더 불러오지 못했습니다.');
    } finally {
      setLoadingMoreMedia(false);
    }
  };

  const handlePostUpdated = (updatedPost: PostRecord) => {
    setPosts((current) =>
      current.map((item) => (item.postId === updatedPost.postId ? updatedPost : item))
    );
  };

  const handleRepostChanged = (updatedPost: PostRecord) => {
    setPosts((current) =>
      updatePostsRepostState(
        current, updatedPost.postId, updatedPost.isReposted, updatedPost.repostCount, updatedPost.reposterInfo ?? null,
      )
    );
  };

  const handleBookmarkChanged = (updatedPost: PostRecord, bookmarked = updatedPost.bookmarkedByMe) => {
    setPosts((current) => updatePostsBookmarkState(current, updatedPost.postId, bookmarked));
  };

  const handlePostDeleted = (postId: string) => {
    setPosts((current) => current.filter((item) => item.postId !== postId));
    setMediaItems((current) => current.filter((item) => item.postId !== postId));
  };

  const handleOpenPost = (postNumber: number, target: PostDetailTarget = 'post') => {
    const search = target === 'comments' ? '?target=comments' : '';
    router.push(getPostHref(postNumber, search));
  };

  const handleSaveUserInfo = async (userInfo: EditProfileUserInfo) => {
    if (!requireAuth('프로필을 수정하려면 로그인이 필요해요.')) return;
    if (!profile) return;
    const generation = getAuthGeneration();

    const [profileImageUpload, coverImageUpload] = await Promise.all([
      userInfo.profileImageFile ? uploadProfileImage('PROFILE', userInfo.profileImageFile) : Promise.resolve(null),
      userInfo.coverImageFile ? uploadProfileImage('COVER', userInfo.coverImageFile) : Promise.resolve(null),
    ]);

    assertCurrentAuthGeneration(generation);
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
    assertCurrentAuthGeneration(generation);
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
    if (!requireAuth('팔로우 기능은 로그인 후 이용할 수 있어요.')) return;
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
      toast.error(followError instanceof Error ? followError.message : '팔로우 상태를 변경하지 못했습니다.');
    } finally {
      setFollowLoading(false);
    }
  };

  const loadFollowList = async (type: FollowListType, cursor?: string | null) => {
    if (!requireAuth('팔로우 목록은 로그인 후 볼 수 있어요.')) return;
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
      setFollowListError(loadError instanceof Error ? loadError.message : '사용자 목록을 불러오지 못했습니다.');
    } finally {
      setFollowListLoading(false);
      setFollowListLoadingMore(false);
    }
  };

  const openFollowList = (type: FollowListType) => {
    if (!requireAuth('팔로우 기능은 로그인 후 이용할 수 있어요.')) return;
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
    if (!requireAuth('팔로우 기능은 로그인 후 이용할 수 있어요.')) return;
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
      toast.error(followError instanceof Error ? followError.message : '팔로우 상태를 변경하지 못했습니다.');
    } finally {
      setFollowActionHandle(null);
    }
  };

  const isOwnProfile = Boolean(profile && currentUser && (
    profile.handle === currentUser.handle || profile.id === currentUser.id
  ));

  if (loading) {
    return (
      <ProfileSkeleton />
    );
  }

  if (!profile) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-body text-fg-danger">{error ?? '프로필을 찾을 수 없습니다.'}</p>
        <Link
          href="/"
          className="btn-primary"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  const disconnectTargetConfig = disconnectTarget ? GAME_STATS_UI_CONFIG[disconnectTarget] : null;
  const displayedCover =
    (isOwnProfile ? profileCover || profile.coverImageUrl : profile.coverImageUrl) || DEFAULT_PROFILE_COVER;
  const displayedAvatar = isOwnProfile ? profileAvatar || profile.profileImageUrl : profile.profileImageUrl;
  const tabs = [
    { name: 'posts' as const, label: '게시글' },
    { name: 'stats' as const, label: '전적' },
    { name: 'media' as const, label: '미디어' },
  ];

  return (
    <div className="mx-auto flex w-full gap-10 px-4 pb-6 pt-2 md:px-6 lg:pt-5 xl:pr-0">
      <div className="min-w-0 flex-1">
        <div className="relative h-32 overflow-hidden rounded-xl bg-subtle md:h-56 md:rounded-card">
          <Image
            src={displayedCover}
            alt={`${profile.nickname} profile cover`}
            fill
            priority
            unoptimized
            sizes="(min-width: 1280px) 600px, 100vw"
            className={displayedCover === DEFAULT_PROFILE_COVER ? 'object-cover dark:hidden' : 'object-cover'}
          />
        </div>

        <header>
          <div className="relative -mt-9 mb-4 flex items-end justify-between gap-2 md:-mt-11">
            <div className="ml-3 shrink-0 md:ml-4">
              <div className="relative flex size-[72px] items-center justify-center overflow-hidden rounded-full border-4 border-canvas bg-subtle text-body text-fg-secondary md:size-[88px]">
                {displayedAvatar ? (
                  <Image
                    src={displayedAvatar}
                    alt="프로필 이미지"
                    fill
                    unoptimized
                    sizes="(min-width: 768px) 88px, 72px"
                    className="object-cover"
                  />
                ) : (
                  getInitials(profile.nickname)
                )}
              </div>
            </div>

            <div className="relative top-3 flex flex-wrap justify-end gap-2 md:top-2">
              {isOwnProfile ? (
                <button type="button" onClick={() => setShowEditProfileModal(true)} className="btn-secondary">
                  프로필 수정
                </button>
              ) : (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setProfileReportMenuOpen((current) => !current)}
                      className="btn-secondary-square"
                      aria-label="사용자 메뉴"
                      aria-expanded={profileReportMenuOpen}
                    >
                      <MoreHorizontal size={18} />
                    </button>

                    {profileReportMenuOpen ? (
                      <div className="absolute right-0 top-12 z-40 min-w-40 overflow-hidden rounded-card border border-line-card bg-surface p-1 shadow-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileReportMenuOpen(false);
                            if (!requireAuth('신고하려면 로그인이 필요해요.')) return;
                            setProfileReportOpen(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-control px-3 py-2.5 text-left text-label text-fg-danger transition hover:bg-danger-subtle"
                        >
                          <Flag size={15} />
                          사용자 신고
                        </button>
                        <button
                          type="button"
                          onClick={() => setProfileReportMenuOpen(false)}
                          className="w-full rounded-control px-3 py-2.5 text-left text-label text-fg-secondary transition hover:bg-surface-elevated"
                        >
                          취소
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => { if (requireAuth('메시지를 보내려면 로그인이 필요해요.', { returnTo: `/messages?recipient=${encodeURIComponent(profile.handle)}` })) router.push(`/messages?recipient=${encodeURIComponent(profile.handle)}`); }}
                    title="메시지"
                    className="btn-secondary-square"
                    aria-label="메시지"
                  >
                    <MessageCircle size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={isFollowing ? 'btn-secondary' : 'btn-primary'}
                  >
                    {isFollowing ? '팔로잉' : '팔로우'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h1 className="flex items-center gap-2 text-title text-fg-primary">
                <span className="min-w-0 break-all">{profile.nickname}</span>
                <MembershipBadge active={profile.membershipBadge} size={24} />
                <RepresentativeTierBadge tier={profile.representativeTier} size={24} />
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 break-all text-body text-fg-tertiary">@{profile.handle}</p>
                {!isOwnProfile && profile.followsViewer ? (
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-caption text-fg-secondary">
                    나를 팔로우합니다
                  </span>
                ) : null}
              </div>
            </div>

            <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-body text-fg-primary">
              {profile.bio || 'GamerIN에서 게임 이야기를 소개해 보세요.'}
            </p>

            {profile.location || profile.website ? (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-fg-secondary">
                {profile.location ? (
                  <div className="flex min-w-0 max-w-full items-center gap-1.5">
                    <MapPin size={16} className="shrink-0" />
                    <span className="truncate">{profile.location}</span>
                  </div>
                ) : null}
                {profile.website ? (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-w-0 max-w-full items-center gap-1.5 transition hover:text-fg-brand"
                  >
                    <Globe size={16} className="shrink-0" />
                    <span className="truncate">{profile.website.replace(/^https?:\/\//i, '')}</span>
                  </a>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => openFollowList('followers')}
                className="flex min-h-8 items-center gap-1 text-left transition hover:underline focus-visible:outline-2 focus-visible:outline-fg-brand"
              >
                <span className="text-body font-medium text-fg-primary">
                  {profile.followersCount.toLocaleString()}
                </span>
                <span className="text-body text-fg-secondary">팔로워</span>
              </button>
              <button
                type="button"
                onClick={() => openFollowList('following')}
                className="flex min-h-8 items-center gap-1 text-left transition hover:underline focus-visible:outline-2 focus-visible:outline-fg-brand"
              >
                <span className="text-body font-medium text-fg-primary">
                  {profile.followingCount.toLocaleString()}
                </span>
                <span className="text-body text-fg-secondary">팔로잉</span>
              </button>
              <div className="flex items-center gap-1">
                <span className="text-body font-medium text-fg-primary">{profile.postCount.toLocaleString()}</span>
                <span className="text-body text-fg-secondary">게시글</span>
              </div>
            </div>
          </div>

        </header>

        <div
          role="tablist"
          aria-label="프로필 콘텐츠"
          data-view-occluder="top"
          className="sticky top-[var(--app-header-height)] z-10 mt-3 flex gap-6 border-b border-line bg-canvas md:mt-4"
          onKeyDown={(event) => {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
            const index = buttons.findIndex((button) => button === event.target);
            if (index === -1) return;

            let nextIndex: number;
            switch (event.key) {
              case 'ArrowLeft': nextIndex = (index + buttons.length - 1) % buttons.length; break;
              case 'ArrowRight': nextIndex = (index + 1) % buttons.length; break;
              case 'Home': nextIndex = 0; break;
              case 'End': nextIndex = buttons.length - 1; break;
              default: return;
            }
            event.preventDefault();
            buttons[nextIndex].focus();
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.name}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${tab.name}`}
              aria-controls={`${tabsId}-panel-${tab.name}`}
              aria-selected={activeTab === tab.name}
              tabIndex={activeTab === tab.name ? 0 : -1}
              onFocus={() => setActiveTab(tab.name)}
              onClick={() => setActiveTab(tab.name)}
              className={`h-12 border-b-2 text-body transition-colors ${FOCUS_RING} ${
                activeTab === tab.name ? 'border-brand font-semibold text-fg-primary' : 'border-transparent text-fg-secondary hover:text-fg-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="pt-4">
          <div
            role="tabpanel"
            id={`${tabsId}-panel-stats`}
            aria-labelledby={`${tabsId}-tab-stats`}
            hidden={activeTab !== 'stats'}
            tabIndex={0}
            className={FOCUS_RING}
          >
            {activeTab === 'stats' ? (
              <section className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-heading text-fg-primary">인증된 전적</h2>

                  {isOwnProfile ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setShowFetchStatsModal(true)}
                        className="btn-secondary px-3!"
                      >
                        <Plus size={14} className="sm:size-4" />
                        전적 추가
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRefreshStats()}
                        disabled={isRefreshing || isDisconnectingGame}
                        className="btn-secondary-square"
                        aria-label="연결된 게임 전적 새로고침"
                      >
                        <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  ) : null}
                </div>
                {gameStatEntries.length === 0 ? (
                  <p className="rounded-card border border-line-card bg-surface p-5 text-body text-fg-secondary">
                    아직 연결된 게임 전적이 없습니다.
                  </p>
                ) : gameStatEntries.map((entry) => {
                  const iconMeta = getGameIconMeta(entry.gameName);

                  return (
                    <article key={entry.gameName} className="rounded-card border border-line-card bg-surface p-4 md:p-5">
                      <div className="flex items-center gap-3">
                        <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-control bg-subtle">
                          {iconMeta ? (
                            <Image
                              src={iconMeta.url}
                              alt={`${entry.gameName} 아이콘`}
                              fill
                              sizes="36px"
                              className={`object-contain p-1 ${iconMeta.invertInDark ? 'dark:invert' : ''}`}
                            />
                          ) : (
                            <Gamepad2 size={20} className="text-icon-secondary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-heading text-fg-primary">{entry.displayName}</h3>
                          {entry.detail ? <p className="break-words text-caption text-fg-tertiary">{entry.detail}</p> : null}
                        </div>
                        {entry.syncedAt && parseDisplayTime(entry.syncedAt) ? (
                          <p className="hidden text-caption text-fg-tertiary sm:block">{formatRelativeTimeLabel(entry.syncedAt)}</p>
                        ) : null}
                        {isOwnProfile && entry.disconnectGameName ? (
                          <button
                            type="button"
                            onClick={() => setDisconnectTarget(entry.disconnectGameName)}
                            disabled={isRefreshing || isDisconnectingGame}
                            className="btn-icon hover:bg-danger-subtle hover:text-fg-danger"
                            aria-label={`${GAME_STATS_UI_CONFIG[entry.disconnectGameName].displayName} 전적 연결 해제`}
                          >
                            <Trash2 size={16} />
                          </button>
                        ) : null}
                      </div>
                      {typeof entry.stats === 'string' ? (
                        <p className="mt-3 break-words text-body text-fg-secondary">{entry.stats}</p>
                      ) : (
                        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {entry.stats.map(({ label, value }) => (
                            <div key={label} className="min-w-0 rounded-control bg-subtle px-3 py-2.5">
                              <dt className="text-caption text-fg-secondary">{label}</dt>
                              <dd className={`break-words text-heading ${label === '티어' ? 'text-fg-brand' : 'text-fg-primary'}`}>
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </article>
                  );
                })}
              </section>
            ) : null}
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-posts`}
            aria-labelledby={`${tabsId}-tab-posts`}
            hidden={activeTab !== 'posts'}
            tabIndex={0}
            className={FOCUS_RING}
          >
            {activeTab === 'posts' ? (
              <div className="space-y-3">
                {postsLoading ? (
                  <PostListSkeleton />
                ) : postsError ? (
                  <div className="py-16 text-center">
                    <p className="text-body text-fg-danger">{postsError}</p>
                    <button
                      type="button"
                      onClick={() => void reloadPosts()}
                      className="btn-primary mt-4"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : posts.length === 0 ? (
                  <div className="py-16 text-center">
                    <h3 className="mb-1 text-heading text-fg-primary">아직 게시글이 없습니다</h3>
                    <p className="text-body text-fg-secondary">이 프로필에는 아직 작성된 게시글이 없습니다.</p>
                  </div>
                ) : (
                  posts.map((post) => (
                    <Post
                      key={post.postId}
                      post={post}
                      likeLoading={Boolean(likeLoadingByPostId[post.postId])}
                      onToggleLike={toggleLike}
                      onOpenDetail={(selected) => handleOpenPost(selected.postNumber)}
                      onOpenComments={(selected) => handleOpenPost(selected.postNumber, 'comments')}
                      onShare={handlePostUpdated}
                      onRepostChange={handleRepostChanged}
                      onDelete={(deletedPost) => handlePostDeleted(deletedPost.postId)}
                      onBookmarkChange={handleBookmarkChanged}
                    />
                  ))
                )}

                {postsHasNext ? (
                  <button
                    type="button"
                    onClick={() => void loadMorePosts()}
                    disabled={loadingMorePosts}
                    className="btn-secondary w-full"
                  >
                    {loadingMorePosts ? '불러오는 중...' : '게시글 더 보기'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div
            role="tabpanel"
            id={`${tabsId}-panel-media`}
            aria-labelledby={`${tabsId}-tab-media`}
            hidden={activeTab !== 'media'}
            tabIndex={0}
            className={FOCUS_RING}
          >
            {activeTab === 'media' ? (
              <div className="space-y-4">

                {mediaItems.length === 0 ? (
                  <div className="py-16 text-center">
                    <h3 className="mb-1 text-heading text-fg-primary">아직 미디어가 없습니다</h3>
                    <p className="text-body text-fg-secondary">업로드한 이미지와 동영상 게시글이 여기에 표시됩니다.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-1">
                    {mediaItems.map((item) => (
                      <button
                        key={item.mediaId}
                        type="button"
                        onClick={() => handleOpenPost(item.postNumber)}
                        className="relative aspect-square overflow-hidden rounded-md border border-line-card bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand"
                        aria-label={`${item.mediaType === 'VIDEO' ? '동영상' : '이미지'} 게시글 상세 보기`}
                      >
                        {item.mediaType === 'VIDEO' ? (
                          <>
                            <video
                              muted
                              playsInline
                              preload="metadata"
                              poster={item.thumbnailUrl ?? undefined}
                              src={item.mediaUrl}
                              className="h-full w-full bg-black object-cover"
                            />
                            <span className="absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white">
                              <Play size={14} fill="currentColor" />
                            </span>
                          </>
                        ) : (
                          <div className="relative h-full w-full">
                            <Image src={item.mediaUrl} alt="프로필 미디어" fill unoptimized className="object-cover" />
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
                    className="btn-secondary w-full"
                  >
                    {loadingMoreMedia ? '불러오는 중...' : '미디어 더 보기'}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <aside
        aria-label="프로필 요약"
        className="hidden w-[300px] shrink-0 space-y-6 pt-2 xl:sticky xl:top-[var(--app-header-height)] xl:block xl:self-start"
      >
        <section>
          <h2 className="mb-3 text-heading text-fg-primary">인증된 전적</h2>
          {gameStatEntries.length === 0 ? (
            <p className="rounded-card border border-line-card bg-surface p-4 text-label text-fg-secondary">
              아직 연결된 게임 전적이 없습니다.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-card border border-line-card bg-surface px-4">
              {gameStatEntries.map((entry) => {
                const metrics = typeof entry.stats === 'string' ? [] : entry.stats;
                const tier = metrics.find(({ label }) => label === '티어');
                const summary = typeof entry.stats === 'string' ? entry.stats : metrics
                  .filter(({ label }) => label === 'K/D' || label === 'KDA' || label === '승률' || label === '판수')
                  .map(({ label, value }) => label === '판수' ? `${value}판` : `${label} ${value}`)
                  .join(' · ');

                return (
                  <li key={entry.gameName} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <p className="break-words text-body font-medium text-fg-primary">{entry.displayName}</p>
                      {tier ? <p className="text-label text-fg-brand">{tier.value}</p> : null}
                    </div>
                    <p className="break-words text-caption text-fg-secondary">{summary}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <SuggestedFriendsCard />
      </aside>

      {isOwnProfile && showFetchStatsModal ? (
        <FetchGameStatsModal
          connectedGames={Object.entries(profile?.gameStats ?? {})
            .filter(([, stats]) => isConnectedGameStats(stats))
            .map(([game]) => game.toUpperCase() === 'RIOT' ? 'LOL' : game.toUpperCase())}
          onClose={() => setShowFetchStatsModal(false)}
          onConnected={handleGameConnected}
        />
      ) : null}
      {isOwnProfile && disconnectTarget && disconnectTargetConfig ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-card border border-line-card bg-surface p-5 shadow-2xl sm:p-6">
            <h2 className="text-title text-fg-primary">
              {disconnectTargetConfig.displayName} 전적 연결을 해제할까요?
            </h2>
            <p className="mt-3 text-body text-fg-secondary">
              {disconnectTargetConfig.displayName} 전적만 프로필에서 제거됩니다. 다른 게임 전적은 유지됩니다.
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDisconnectTarget(null)}
                disabled={isDisconnectingGame}
                className="btn-secondary bg-transparent! hover:bg-subtle!"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDisconnectGame()}
                disabled={isDisconnectingGame}
                className="btn-secondary bg-danger-subtle! text-fg-danger! hover:bg-line!"
              >
                {isDisconnectingGame ? '연결 해제 중...' : '연결 해제'}
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
      {!isOwnProfile && profileReportOpen ? (
        <ReportContentModal
          targetType="USER"
          targetId={profile.id}
          title="사용자 신고"
          author={profile.nickname}
          authorHandle={profile.handle}
          content={profile.bio}
          emptyContentLabel="프로필 소개 없음"
          onClose={() => setProfileReportOpen(false)}
        />
      ) : null}
      {followListType ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-hidden rounded-card border border-line-card bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-5">
              <div>
                <p className="text-caption text-fg-tertiary">
                  @{profile.handle}
                </p>
                <h2 className="text-title text-fg-primary">
                  {followListType === 'followers' ? '팔로워' : '팔로잉'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeFollowList}
                className="btn-icon"
                aria-label="닫기"
              >
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[58dvh] overflow-y-auto p-4">
              {followListLoading ? (
                <UserRowsSkeleton />
              ) : followListError ? (
                <div className="rounded-control bg-danger-subtle px-4 py-3 text-body text-fg-danger">
                  {followListError}
                </div>
              ) : followUsers.length === 0 ? (
                <div className="py-16 text-center text-body text-fg-secondary">
                  {followListType === 'followers' ? '아직 팔로워가 없습니다.' : '아직 팔로우한 사용자가 없습니다.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {followUsers.map((followUserRecord) => {
                    const isMe =
                      followUserRecord.handle === currentUser?.handle ||
                      followUserRecord.userId === currentUser?.id;

                    return (
                      <div
                        key={`${followUserRecord.userId}-${followUserRecord.followedAt}`}
                        className="flex items-center justify-between gap-3 rounded-control p-3 transition hover:bg-surface-elevated"
                      >
                        <Link
                          href={`/profile/${encodeURIComponent(followUserRecord.handle)}`}
                          onClick={closeFollowList}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-body text-fg-secondary">
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
                            <p className="flex min-w-0 items-center gap-1 text-body font-semibold text-fg-primary">
                              <span className="truncate">{followUserRecord.nickname}</span>
                              <MembershipBadge active={followUserRecord.membershipBadge} /><RepresentativeTierBadge tier={followUserRecord.representativeTier} />
                            </p>
                            <p className="truncate text-caption text-fg-tertiary">
                              @{followUserRecord.handle}
                            </p>
                            {followUserRecord.bio ? (
                              <p className="mt-1 line-clamp-1 text-caption text-fg-secondary">
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
                            className={followUserRecord.isFollowing ? 'btn-secondary' : 'btn-primary'}
                          >
                            {followUserRecord.isFollowing ? '팔로잉' : '팔로우'}
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {followHasNext ? (
              <div className="border-t border-line p-4">
                <button
                  type="button"
                  onClick={() => void loadFollowList(followListType, followNextCursor)}
                  disabled={followListLoadingMore}
                  className="btn-secondary w-full"
                >
                  {followListLoadingMore ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
