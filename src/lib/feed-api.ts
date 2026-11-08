import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import {
  ApiError,
  AUTH_REQUIRED_MESSAGE,
  type ApiClientConfig,
  type ApiRequestOptions,
  apiRequest as sendApiRequest,
} from '@/lib/api-client';
import type { ProfileImageUploadTarget } from '@/lib/profile-image-compression';
import { toNumber } from '@/lib/coerce';
import { formatRelativeTimeLabel } from '@/lib/time-format';
import type { CursorPage } from '@/types/api';
import type { BookmarkCollection } from '@/types/bookmark';
import type { RepresentativeTier } from '@/lib/representative-tier';

export interface PostMedia {
  mediaId: string;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  thumbnailUrl: string | null;
  sortOrder: number;
  durationSeconds?: number | null;
}

export interface ReposterInfo {
  userId: string;
  nickname: string;
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
  repostedAt: string;
}

export interface PostRecord {
  postId: string;
  /** URL용 순번(/posts/{postNumber}). 좋아요·북마크 등 API 호출은 UUID `postId`를 쓴다 */
  postNumber: number;
  author: string;
  authorHandle: string;
  authorProfileImageUrl: string | null;
  authorVerifiedBadge: boolean;
  authorMembershipBadge?: boolean;
  authorRepresentativeTier?: RepresentativeTier | null;
  game?: string | null;
  content: string | null;
  media: PostMedia[];
  likes: number;
  comments: number;
  shares: number;
  isReposted: boolean;
  repostCount: number;
  /** 조회수(백엔드 #183). 리포스트 카드는 원글 값이다. 없거나 형식이 틀리면 null이고 화면에 표시하지 않는다 */
  viewCount?: number | null;
  reposterInfo?: ReposterInfo | null;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  isSaved?: boolean;
  savedCollectionIds?: string[];
  mine: boolean;
  createdAt: string;
  /** 작성자 본인 응답에만 있다(#92). 수정 가능 마감 시각 */
  editableUntil?: string | null;
  /** 작성자 본인 응답에만 있다(#92). 0이면 수정 가능, 1이면 이미 수정함 */
  editCount?: number | null;
}

export interface CommentRecord {
  commentId: string;
  author: string;
  authorHandle: string;
  authorProfileImageUrl: string | null;
  authorVerifiedBadge: boolean;
  authorMembershipBadge?: boolean;
  authorRepresentativeTier?: RepresentativeTier | null;
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
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
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
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
  isFollowing: boolean;
  followedAt: string;
}

export interface ProfileMediaItem {
  mediaId: string;
  postId: string;
  postNumber: number;
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

function normalizePostMedia(media: PostMedia): PostMedia {
  return {
    ...media,
    mediaUrl: toAbsoluteAssetUrl(media.mediaUrl) ?? media.mediaUrl,
    thumbnailUrl: toAbsoluteAssetUrl(media.thumbnailUrl),
    sortOrder: toNumber(media.sortOrder),
  };
}

function toViewCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
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
    viewCount: toViewCount(post.viewCount),
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
    message ?? (reason === 'unauthenticated' || reason === 'blocked' || status === 401
      ? AUTH_REQUIRED_MESSAGE
      : '요청을 처리하지 못했습니다.'),
    status,
    reason,
  ),
};

function apiRequest<T>(path: string, options: ApiRequestOptions = {}, auth: ApiClientConfig['auth'] = 'required'): Promise<T> {
  return sendApiRequest<T>(path, { ...FEED_CLIENT, auth }, options);
}

export function formatRelativeTime(createdAt: string) {
  return formatRelativeTimeLabel(createdAt);
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
  }, tab === 'all' ? 'optional' : 'required');
  return normalizeCursorPage(page, normalizePostRecord);
}

export async function createJsonPost(payload: {
  content?: string;
}) {
  const post = await apiRequest<PostRecord>('/api/v1/posts', {
    method: 'POST',
    body: JSON.stringify({
      content: payload.content || null,
    }),
  });

  return normalizePostRecord(post);
}

export type PostVideoJobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

// 영상 게시물은 서버가 재인코딩을 마친 뒤 만들어진다. 그 전까지는 처리 작업 상태만 내려온다.
export type PostVideoJob = {
  jobId: string;
  status: PostVideoJobStatus;
  errorMessage: string | null;
  post: PostRecord | null;
};

export type MultipartPostResult =
  | { kind: 'post'; post: PostRecord }
  | { kind: 'videoJob'; job: PostVideoJob };

function normalizePostVideoJob(job: PostVideoJob): PostVideoJob {
  return { ...job, post: job.post ? normalizePostRecord(job.post) : null };
}

export async function createMultipartPost(formData: FormData): Promise<MultipartPostResult> {
  const data = await apiRequest<PostRecord | PostVideoJob>('/api/v1/posts', {
    method: 'POST',
    body: formData,
  });

  // 영상 게시물은 202와 처리 작업으로 응답한다.
  if (data && typeof data === 'object' && 'jobId' in data) {
    return { kind: 'videoJob', job: normalizePostVideoJob(data) };
  }
  return { kind: 'post', post: normalizePostRecord(data as PostRecord) };
}

export async function fetchPostVideoJob(jobId: string, options: FeedRequestOptions = {}) {
  const job = await apiRequest<PostVideoJob>(`/api/v1/posts/video-jobs/${encodeURIComponent(jobId)}`, {
    signal: options.signal,
  });

  return normalizePostVideoJob(job);
}

/** 게시글 상세 링크. 숫자 ID(postNumber)만 URL에 쓴다 */
export function getPostHref(postNumber: number, search = '') {
  return `/posts/${postNumber}${search}`;
}

export async function fetchPostDetailByNumber(postNumber: number, options: FeedRequestOptions = {}) {
  const post = await apiRequest<PostRecord>(`/api/v1/posts/by-number/${postNumber}`, {
    signal: options.signal,
  }, 'optional');
  return normalizePostRecord(post);
}

/** 멤버십 혜택: 본문만 수정한다(#92). 서버가 수정된 상세 게시물을 돌려준다. */
export async function updatePostContent(postId: string, content: string) {
  const post = await apiRequest<PostRecord>(`/api/v1/posts/${postId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  return normalizePostRecord(post);
}

export async function deletePost(postId: string) {
  await apiRequest<null>(`/api/v1/posts/${postId}`, {
    method: 'DELETE',
  });
}

/** 카드 노출 보고(#183). 서버가 같은 사용자·같은 글을 24시간에 1번만 센다. 한 번에 1~50개 */
export async function recordPostViews(postIds: string[], options: ApiRequestOptions = {}) {
  return apiRequest<{ counted: number }>('/api/v1/posts/views', {
    ...options,
    method: 'POST',
    body: JSON.stringify({ postIds }),
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

function normalizeComment(comment: CommentRecord): CommentRecord {
  return { ...comment, authorProfileImageUrl: toAbsoluteAssetUrl(comment.authorProfileImageUrl) };
}

export async function createComment(postId: string, content: string) {
  const comment = await apiRequest<CommentRecord>(`/api/v1/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  return normalizeComment(comment);
}

export async function fetchPostComments(postId: string, options: FeedRequestOptions = {}) {
  const comments = await apiRequest<CommentRecord[]>(`/api/v1/posts/${postId}/comments`, {
    signal: options.signal,
  }, 'optional');
  return Array.isArray(comments) ? comments.map(normalizeComment) : [];
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
  const profile = await apiRequest<UserProfilePayload>(`/api/v1/users/${encodeURIComponent(handle)}`, {}, 'optional');
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

export async function fetchUserPosts(
  handle: string,
  cursor?: string | null,
  size = 20,
  options: FeedRequestOptions = {},
) {
  const search = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    search.set('cursor', cursor);
  }

  const page = await apiRequest<CursorPage<PostRecord>>(
    `/api/v1/users/${encodeURIComponent(handle)}/posts?${search.toString()}`,
    { signal: options.signal }, 'optional',
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
    `/api/v1/users/${encodeURIComponent(handle)}/media?${search.toString()}`, {}, 'optional'
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
