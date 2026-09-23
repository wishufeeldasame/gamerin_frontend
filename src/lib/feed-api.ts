import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import {
  ApiError,
  type ApiClientConfig,
  type ApiRequestOptions,
  apiRequest as sendApiRequest,
} from '@/lib/api-client';
import type { ProfileImageUploadTarget } from '@/lib/profile-image-compression';
import type { BookmarkCollection } from '@/types/bookmark';

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

export interface ReposterInfo {
  userId: string;
  nickname: string;
  repostedAt: string;
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
  isReposted: boolean;
  repostCount: number;
  reposterInfo?: ReposterInfo | null;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  isSaved?: boolean;
  savedCollectionIds?: string[];
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

export interface RepostActionResponse {
  postId: string;
  isReposted: boolean;
  repostCount: number;
  repostedAt: string | null;
}

export type BookmarkScope = 'all' | 'unclassified';

export interface BookmarkRequestOptions extends FeedRequestOptions {
  q?: string;
  mediaOnly?: boolean;
}

export interface BookmarkCollectionPostState {
  postId: string;
  bookmarkedByMe: boolean;
  collectionIds: string[];
  collection: BookmarkCollection;
}

function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function normalizePostMedia(media: PostMedia): PostMedia {
  return {
    ...media,
    mediaUrl: toAbsoluteAssetUrl(media.mediaUrl) ?? media.mediaUrl,
    thumbnailUrl: toAbsoluteAssetUrl(media.thumbnailUrl),
    sortOrder: toNumber(media.sortOrder),
  };
}

export function normalizePostRecord(post: PostRecord): PostRecord {
  return {
    ...post,
    authorProfileImageUrl: toAbsoluteAssetUrl(post.authorProfileImageUrl),
    content: post.content ?? null,
    media: Array.isArray(post.media) ? post.media.map(normalizePostMedia) : [],
    likes: toNumber(post.likes),
    comments: toNumber(post.comments),
    shares: toNumber(post.shares),
    isReposted: Boolean(post.isReposted),
    repostCount: toNumber(post.repostCount),
    reposterInfo: post.reposterInfo ?? null,
    likedByMe: Boolean(post.likedByMe),
    bookmarkedByMe: Boolean(post.bookmarkedByMe),
    mine: Boolean(post.mine),
  };
}

export function normalizeCursorPage<T>(page: CursorPage<T>, normalizeItem: (item: T) => T): CursorPage<T> {
  return {
    items: Array.isArray(page.items) ? page.items.map(normalizeItem) : [],
    nextCursor: page.nextCursor ?? null,
    hasNext: Boolean(page.hasNext),
  };
}

function normalizeUserProfile(profile: UserProfilePayload): UserProfile {
  return {
    ...profile,
    coverImageUrl: toAbsoluteAssetUrl(profile.coverImageUrl),
    profileImageUrl: toAbsoluteAssetUrl(profile.profileImageUrl),
    followedByMe: profile.followedByMe ?? profile.isFollowing ?? profile.following ?? false,
  };
}

function normalizeProfileImageUpload(response: ProfileImageUploadResponse): ProfileImageUploadResponse {
  return {
    ...response,
    imageUrl: toAbsoluteAssetUrl(response.imageUrl) ?? response.imageUrl,
  };
}

function normalizeBookmarkCollection(collection: BookmarkCollection): BookmarkCollection {
  return {
    ...collection,
    coverImageUrl: toAbsoluteAssetUrl(collection.coverImageUrl),
    bookmarkCount: toNumber(collection.bookmarkCount),
    containsPost: Boolean(collection.containsPost),
  };
}

function normalizeBookmarkCollectionPostState(
  state: BookmarkCollectionPostState,
): BookmarkCollectionPostState {
  return {
    ...state,
    bookmarkedByMe: Boolean(state.bookmarkedByMe),
    collectionIds: Array.isArray(state.collectionIds) ? state.collectionIds : [],
    collection: normalizeBookmarkCollection(state.collection),
  };
}

interface FeedRequestOptions {
  signal?: AbortSignal;
}

const FEED_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) => new ApiError(
    reason === 'unauthenticated'
      ? '로그인이 필요하거나 인증이 만료되었습니다.'
      : message ?? 'Request failed.',
    status,
  ),
};

function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return sendApiRequest<T>(path, FEED_CLIENT, options);
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

export function updatePostRepostState(
  post: PostRecord,
  isReposted = !post.isReposted,
): PostRecord {
  return {
    ...post,
    isReposted,
    repostCount: Math.max(
      0,
      post.repostCount + (isReposted === post.isReposted ? 0 : isReposted ? 1 : -1),
    ),
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

export async function repostPost(postId: string) {
  return apiRequest<RepostActionResponse>(`/api/v1/posts/${postId}/reposts`, {
    method: 'POST',
  });
}

export async function unrepostPost(postId: string) {
  return apiRequest<RepostActionResponse>(`/api/v1/posts/${postId}/reposts`, {
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

export async function fetchBookmarkCollections(postId?: string | null) {
  const search = new URLSearchParams();
  if (postId) {
    search.set('postId', postId);
  }

  const suffix = search.size > 0 ? `?${search.toString()}` : '';
  const collections = await apiRequest<BookmarkCollection[]>(`/api/v1/bookmark-collections${suffix}`);
  return Array.isArray(collections) ? collections.map(normalizeBookmarkCollection) : [];
}

export async function createBookmarkCollection(name: string, initialPostId?: string | null) {
  const collection = await apiRequest<BookmarkCollection>('/api/v1/bookmark-collections', {
    method: 'POST',
    body: JSON.stringify({
      name,
      initialPostId: initialPostId || undefined,
    }),
  });

  return normalizeBookmarkCollection(collection);
}

export async function renameBookmarkCollection(collectionId: string, name: string) {
  const collection = await apiRequest<BookmarkCollection>(
    `/api/v1/bookmark-collections/${encodeURIComponent(collectionId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );

  return normalizeBookmarkCollection(collection);
}

export async function deleteBookmarkCollection(collectionId: string) {
  await apiRequest<null>(`/api/v1/bookmark-collections/${encodeURIComponent(collectionId)}`, {
    method: 'DELETE',
  });
}

export async function addPostToBookmarkCollection(collectionId: string, postId: string) {
  const state = await apiRequest<BookmarkCollectionPostState>(
    `/api/v1/bookmark-collections/${encodeURIComponent(collectionId)}/bookmarks/${encodeURIComponent(postId)}`,
    {
      method: 'PUT',
    },
  );

  return normalizeBookmarkCollectionPostState(state);
}

export async function removePostFromBookmarkCollection(collectionId: string, postId: string) {
  const state = await apiRequest<BookmarkCollectionPostState>(
    `/api/v1/bookmark-collections/${encodeURIComponent(collectionId)}/bookmarks/${encodeURIComponent(postId)}`,
    {
      method: 'DELETE',
    },
  );

  return normalizeBookmarkCollectionPostState(state);
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

  const response = await apiRequest<ProfileImageUploadResponse>('/api/v1/users/me/profile-images', {
    method: 'POST',
    body: formData,
  });

  return normalizeProfileImageUpload(response);
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

function appendBookmarkSearchParams(search: URLSearchParams, options: BookmarkRequestOptions) {
  if (options.q?.trim()) {
    search.set('q', options.q.trim());
  }

  if (typeof options.mediaOnly === 'boolean') {
    search.set('mediaOnly', String(options.mediaOnly));
  }
}

export async function fetchMyBookmarks(
  cursor?: string | null,
  size = 20,
  options: BookmarkRequestOptions = {},
  scope: BookmarkScope = 'all',
) {
  const search = new URLSearchParams({
    scope,
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  appendBookmarkSearchParams(search, options);

  const page = await apiRequest<CursorPage<PostRecord>>(`/api/v1/users/me/bookmarks?${search.toString()}`, {
    signal: options.signal,
  });
  return normalizeCursorPage(page, normalizePostRecord);
}

export async function fetchCollectionBookmarks(
  collectionId: string,
  cursor?: string | null,
  size = 20,
  options: BookmarkRequestOptions = {},
) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  appendBookmarkSearchParams(search, options);

  const page = await apiRequest<CursorPage<PostRecord>>(
    `/api/v1/bookmark-collections/${encodeURIComponent(collectionId)}/bookmarks?${search.toString()}`,
    {
      signal: options.signal,
    },
  );
  return normalizeCursorPage(page, normalizePostRecord);
}
