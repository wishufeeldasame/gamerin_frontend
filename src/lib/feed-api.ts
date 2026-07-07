import { ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';
import type { ProfileImageUploadTarget } from '@/lib/profile-image-compression';

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
  durationSeconds?: number | null;
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
  game?: string | null;
  content: string | null;
  media: PostMedia[];
  externalLink?: ExternalLinkCard | null;
  likes: number;
  comments: number;
  shares: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
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
  mine: boolean;
}

export interface UserProfile {
  id: string;
  handle: string;
  nickname: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  gameStats: Record<string, unknown>;
  verifiedBadge: boolean;
  followersCount: number;
  followingCount: number;
  postCount: number;
  mediaPostCount: number;
  mediaItemCount: number;
  followedByMe?: boolean;
  followsViewer?: boolean;
}

type UserProfilePayload = UserProfile & {
  isFollowing?: boolean;
  following?: boolean;
};

export type UpdateMyProfilePayload = Partial<{
  nickname: string;
  bio: string;
  profileImageUrl: string | null;
  coverImageUrl: string | null;
  location: string;
  website: string;
}>;

export interface ProfileImageUploadResponse {
  target: ProfileImageUploadTarget;
  imageUrl: string;
  sizeBytes: number;
}

export interface FollowUserRecord {
  userId: string;
  handle: string;
  nickname: string;
  bio: string | null;
  profileImageUrl: string | null;
  verifiedBadge: boolean;
  isFollowing: boolean;
  followedAt: string;
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

export type ShareTarget = 'COPY_LINK' | 'WEB_SHARE' | 'KAKAO' | 'X' | 'FACEBOOK' | 'OTHER';

export interface ShareResponse {
  postId: string;
  shares: number;
}

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizePostMedia(media: PostMedia): PostMedia {
  return {
    ...media,
    thumbnailUrl: media.thumbnailUrl ?? null,
    sortOrder: toNumber(media.sortOrder),
  };
}

function normalizePostRecord(post: PostRecord): PostRecord {
  return {
    ...post,
    content: post.content ?? null,
    media: Array.isArray(post.media) ? post.media.map(normalizePostMedia) : [],
    likes: toNumber(post.likes),
    comments: toNumber(post.comments),
    shares: toNumber(post.shares),
    likedByMe: Boolean(post.likedByMe),
    bookmarkedByMe: Boolean(post.bookmarkedByMe),
    mine: Boolean(post.mine),
  };
}

function normalizeCursorPage<T>(page: CursorPage<T>, normalizeItem: (item: T) => T): CursorPage<T> {
  return {
    items: Array.isArray(page.items) ? page.items.map(normalizeItem) : [],
    nextCursor: page.nextCursor ?? null,
    hasNext: Boolean(page.hasNext),
  };
}

function normalizeUserProfile(profile: UserProfilePayload): UserProfile {
  return {
    ...profile,
    followedByMe: profile.followedByMe ?? profile.isFollowing ?? profile.following ?? false,
  };
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

interface FeedRequestOptions {
  signal?: AbortSignal;
}

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

export function updatePostLikeState(post: PostRecord, likedByMe = !post.likedByMe): PostRecord {
  return {
    ...post,
    likedByMe,
    likes: Math.max(0, post.likes + (likedByMe === post.likedByMe ? 0 : likedByMe ? 1 : -1)),
  };
}

export function updatePostBookmarkState(post: PostRecord, bookmarkedByMe = !post.bookmarkedByMe): PostRecord {
  return {
    ...post,
    bookmarkedByMe,
  };
}

export async function fetchFeed(
  tab: 'all' | 'following',
  cursor?: string | null,
  size = 20,
  options: FeedRequestOptions = {}
) {
  const search = new URLSearchParams({
    tab,
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await apiRequest<CursorPage<PostRecord>>(`/api/v1/feed?${search.toString()}`, {
    signal: options.signal,
  });
  return normalizeCursorPage(page, normalizePostRecord);
}

export async function createJsonPost(payload: {
  content?: string;
  externalLinkUrl?: string;
}) {
  const post = await apiRequest<PostRecord>('/api/v1/posts', {
    method: 'POST',
    body: JSON.stringify({
      content: payload.content || null,
      externalLinkUrl: payload.externalLinkUrl || null,
    }),
  });

  return normalizePostRecord(post);
}

export async function createMultipartPost(formData: FormData) {
  const post = await apiRequest<PostRecord>('/api/v1/posts', {
    method: 'POST',
    body: formData,
  });

  return normalizePostRecord(post);
}

export async function fetchPostDetail(postId: string, options: FeedRequestOptions = {}) {
  const post = await apiRequest<PostRecord>(`/api/v1/posts/${postId}`, {
    signal: options.signal,
  });
  return normalizePostRecord(post);
}

export async function deletePost(postId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}`, {
    method: 'DELETE',
  });
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

export async function bookmarkPost(postId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}/bookmarks`, {
    method: 'POST',
  });
}

export async function unbookmarkPost(postId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}/bookmarks`, {
    method: 'DELETE',
  });
}

export async function sharePost(postId: string, target: ShareTarget = 'COPY_LINK') {
  return apiRequest<ShareResponse>(`/api/v1/posts/${postId}/shares`, {
    method: 'POST',
    body: JSON.stringify({ target }),
  });
}

export async function createComment(postId: string, content: string) {
  return apiRequest<CommentRecord>(`/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function fetchPostComments(postId: string, options: FeedRequestOptions = {}) {
  return apiRequest<CommentRecord[]>(`/api/v1/posts/${postId}/comments`, {
    signal: options.signal,
  });
}

export async function deleteComment(postId: string, commentId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}/comments/${commentId}`, {
    method: 'DELETE',
  });
}

export async function fetchMyProfile() {
  const profile = await apiRequest<UserProfilePayload>('/api/v1/users/me');
  return normalizeUserProfile(profile);
}

export async function fetchUserProfile(handle: string) {
  const profile = await apiRequest<UserProfilePayload>(`/api/v1/users/${encodeURIComponent(handle)}`);
  return normalizeUserProfile(profile);
}

export async function updateMyProfile(payload: UpdateMyProfilePayload) {
  await apiRequest<null>('/api/v1/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  return fetchMyProfile();
}

export async function uploadProfileImage(target: ProfileImageUploadTarget, file: File) {
  const formData = new FormData();
  formData.append('target', target);
  formData.append('file', file);

  return apiRequest<ProfileImageUploadResponse>('/api/v1/users/me/profile-images', {
    method: 'POST',
    body: formData,
  });
}

export async function followUser(handle: string) {
  await apiRequest<null>(`/api/v1/users/${encodeURIComponent(handle)}/follow`, {
    method: 'POST',
  });
}

export async function unfollowUser(handle: string) {
  await apiRequest<null>(`/api/v1/users/${encodeURIComponent(handle)}/follow`, {
    method: 'DELETE',
  });
}

export async function fetchFollowers(handle: string, cursor?: string | null, size = 20) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  return apiRequest<CursorPage<FollowUserRecord>>(
    `/api/v1/users/${encodeURIComponent(handle)}/followers?${search.toString()}`
  );
}

export async function fetchFollowing(handle: string, cursor?: string | null, size = 20) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  return apiRequest<CursorPage<FollowUserRecord>>(
    `/api/v1/users/${encodeURIComponent(handle)}/following?${search.toString()}`
  );
}

export async function fetchUserPosts(handle: string, cursor?: string | null, size = 20) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await apiRequest<CursorPage<PostRecord>>(
    `/api/v1/users/${encodeURIComponent(handle)}/posts?${search.toString()}`
  );
  return normalizeCursorPage(page, normalizePostRecord);
}

export async function fetchUserMedia(handle: string, cursor?: string | null, size = 24) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  return apiRequest<CursorPage<ProfileMediaItem>>(
    `/api/v1/users/${encodeURIComponent(handle)}/media?${search.toString()}`
  );
}

export async function fetchMyBookmarks(cursor?: string | null, size = 20, options: FeedRequestOptions = {}) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await apiRequest<CursorPage<PostRecord>>(`/api/v1/users/me/bookmarks?${search.toString()}`, {
    signal: options.signal,
  });
  return normalizeCursorPage(page, normalizePostRecord);
}
