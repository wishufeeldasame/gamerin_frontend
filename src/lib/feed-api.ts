import { ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
}

export interface PostMedia {
  mediaId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  durationSeconds: number | null;
}

export interface ExternalLinkCard {
  url: string;
  host: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
}

export interface PostRecord {
  postId: string;
  author: string;
  authorHandle: string;
  authorProfileImageUrl: string | null;
  authorVerifiedBadge: boolean;
  game: string | null;
  content: string | null;
  media: PostMedia[];
  externalLink: ExternalLinkCard | null;
  likes: number;
  comments: number;
  shares: number;
  likedByMe: boolean;
  mine: boolean;
  createdAt: string;
}

export interface CommentRecord {
  commentId: string;
  author: string;
  authorHandle: string;
  authorProfileImageUrl: string | null;
  authorVerifiedBadge: boolean;
  content: string;
  createdAt: string;
}

export interface TrendingGame {
  gameName: string;
  postCount: number;
}

export interface UserProfile {
  id: string;
  handle: string;
  nickname: string;
  bio: string | null;
  profileImageUrl: string | null;
  gameStats: Record<string, unknown>;
  verifiedBadge: boolean;
  followersCount: number;
  followingCount: number;
  postCount: number;
  mediaPostCount: number;
  mediaItemCount: number;
}

export interface ProfileMediaItem {
  mediaId: string;
  postId: string;
  authorHandle: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);

    headers.set('Authorization', `Bearer ${accessToken}`);

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { message?: string } | null;
    return { response, payload };
  };

  let accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw new Error('로그인이 필요하거나 인증이 만료되었습니다.');
  }

  let result = await send(accessToken);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken();

    if (!accessToken) {
      throw new Error('로그인이 필요하거나 인증이 만료되었습니다.');
    }

    result = await send(accessToken);
  }

  if (!result.response.ok) {
    throw new Error(result.payload?.message ?? 'Request failed.');
  }

  return (result.payload as ApiEnvelope<T>).data;
}

export function formatRelativeTime(createdAt: string) {
  const target = new Date(createdAt).getTime();
  const diffSeconds = Math.max(1, Math.floor((Date.now() - target) / 1000));

  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(createdAt).toLocaleDateString();
}

export function getInitials(name: string, fallback = 'G') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export async function fetchFeed(tab: 'all' | 'following', cursor?: string | null, size = 20) {
  const search = new URLSearchParams({
    tab,
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  return apiRequest<CursorPage<PostRecord>>(`/api/v1/feed?${search.toString()}`);
}

export async function fetchTrendingGames() {
  return apiRequest<TrendingGame[]>('/api/v1/feed/trending/games');
}

export async function createJsonPost(payload: {
  content?: string;
  gameName?: string;
  externalLinkUrl?: string;
}) {
  return apiRequest<PostRecord>('/api/v1/posts', {
    method: 'POST',
    body: JSON.stringify({
      content: payload.content || null,
      gameName: payload.gameName || null,
      media: [],
      externalLink: payload.externalLinkUrl
        ? {
            url: payload.externalLinkUrl,
          }
        : null,
    }),
  });
}

export async function createMultipartPost(formData: FormData) {
  return apiRequest<PostRecord>('/api/v1/posts', {
    method: 'POST',
    body: formData,
  });
}

export async function fetchPostDetail(postId: string) {
  return apiRequest<PostRecord>(`/api/v1/posts/${postId}`);
}

export async function likePost(postId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}/likes`, {
    method: 'POST',
  });
}

export async function unlikePost(postId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}/likes`, {
    method: 'DELETE',
  });
}

export async function createComment(postId: string, content: string) {
  return apiRequest<CommentRecord>(`/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function fetchMyProfile() {
  return apiRequest<UserProfile>('/api/v1/users/me');
}

export async function fetchUserProfile(handle: string) {
  return apiRequest<UserProfile>(`/api/v1/users/${handle}`);
}

export async function fetchUserPosts(handle: string, cursor?: string | null, size = 20) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  return apiRequest<CursorPage<PostRecord>>(`/api/v1/users/${handle}/posts?${search.toString()}`);
}

export async function fetchUserMedia(handle: string, cursor?: string | null, size = 24) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  return apiRequest<CursorPage<ProfileMediaItem>>(`/api/v1/users/${handle}/media?${search.toString()}`);
}
