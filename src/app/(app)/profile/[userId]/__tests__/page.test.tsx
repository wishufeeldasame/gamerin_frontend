import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord, UserProfile } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchMyProfile: vi.fn(),
  fetchUserMedia: vi.fn(),
  fetchUserPosts: vi.fn(),
  fetchUserProfile: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  updateUser: vi.fn(),
  user: {
    id: 'viewer-1',
    name: 'viewer',
    nickname: 'viewer',
    gameTier: '',
    handle: 'viewer',
  },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ userId: 'author' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/lib/feed-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feed-api')>()),
  fetchMyProfile: api.fetchMyProfile,
  fetchUserMedia: api.fetchUserMedia,
  fetchUserPosts: api.fetchUserPosts,
  fetchUserProfile: api.fetchUserProfile,
  likePost: api.likePost,
  unlikePost: api.unlikePost,
}));
vi.mock('@/app/home/components/FetchGameStatsModal', () => ({
  FetchGameStatsModal: () => null,
}));
vi.mock('@/app/home/components/EditProfileModal', () => ({
  EditProfileModal: () => null,
}));
vi.mock('@/app/home/components/Report', () => ({
  ReportContentModal: () => null,
}));
vi.mock('@/app/home/components/Post', () => ({
  Post: ({
    post,
    likeLoading,
    onToggleLike,
    onBookmarkChange,
    onRepostChange,
  }: {
    post: PostRecord;
    likeLoading?: boolean;
    onToggleLike?: (post: PostRecord) => Promise<void> | void;
    onBookmarkChange?: (post: PostRecord) => void;
    onRepostChange?: (post: PostRecord) => void;
  }) => (
    <div data-testid={'post-' + post.postId}>
      <output data-testid="post-state">{JSON.stringify(post)}</output>
      <button type="button" disabled={likeLoading} onClick={() => void onToggleLike?.(post)}>
        toggle like
      </button>
      <button
        type="button"
        onClick={() =>
          onBookmarkChange?.({
            ...post,
            bookmarkedByMe: true,
            isSaved: true,
            savedCollectionIds: ['collection-a'],
          })
        }
      >
        update bookmark
      </button>
      <button
        type="button"
        onClick={() =>
          onRepostChange?.({
            ...post,
            isReposted: true,
            repostCount: post.repostCount + 1,
            reposterInfo: {
              userId: 'viewer-1',
              nickname: 'viewer',
              repostedAt: '2026-09-24T00:00:01Z',
            },
          })
        }
      >
        update repost
      </button>
    </div>
  ),
}));

import ProfilePage from '../page';

const profile: UserProfile = {
  id: 'author-1',
  handle: 'author',
  nickname: '작성자',
  bio: null,
  location: null,
  website: null,
  coverImageUrl: null,
  profileImageUrl: null,
  gameStats: {},
  verifiedBadge: false,
  followersCount: 0,
  followingCount: 0,
  postCount: 1,
  mediaPostCount: 0,
  mediaItemCount: 0,
  followedByMe: false,
  followsViewer: false,
};

const post: PostRecord = {
  postId: 'post-1',
  author: '작성자',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: '프로필 게시글',
  media: [],
  likes: 4,
  comments: 0,
  shares: 0,
  isReposted: false,
  repostCount: 0,
  reposterInfo: null,
  likedByMe: false,
  bookmarkedByMe: false,
  isSaved: false,
  savedCollectionIds: [],
  mine: false,
  createdAt: '2026-09-24T00:00:00Z',
};

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((_, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

function readPostState() {
  return JSON.parse(screen.getByTestId('post-state').textContent ?? '{}') as PostRecord;
}

describe('ProfilePage like rollback', () => {
  beforeEach(() => {
    api.fetchMyProfile.mockReset();
    api.fetchUserMedia.mockReset();
    api.fetchUserPosts.mockReset();
    api.fetchUserProfile.mockReset();
    api.likePost.mockReset();
    api.unlikePost.mockReset();
    auth.updateUser.mockReset();

    api.fetchUserProfile.mockResolvedValue(profile);
    api.fetchUserPosts.mockResolvedValue({
      items: [post],
      nextCursor: null,
      hasNext: false,
    });
    api.fetchUserMedia.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNext: false,
    });
  });

  it('좋아요 실패 시 요청 중 변경된 북마크와 리포스트 상태를 유지한다', async () => {
    const likeRequest = deferred<void>();
    api.likePost.mockReturnValue(likeRequest.promise);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<ProfilePage />);
    await screen.findByTestId('post-post-1');

    fireEvent.click(screen.getByRole('button', { name: 'toggle like' }));
    await waitFor(() => {
      expect(api.likePost).toHaveBeenCalledWith('post-1');
      expect(readPostState()).toMatchObject({ likedByMe: true, likes: 5 });
    });

    fireEvent.click(screen.getByRole('button', { name: 'update bookmark' }));
    fireEvent.click(screen.getByRole('button', { name: 'update repost' }));
    expect(readPostState()).toMatchObject({
      likedByMe: true,
      likes: 5,
      bookmarkedByMe: true,
      isSaved: true,
      savedCollectionIds: ['collection-a'],
      isReposted: true,
      repostCount: 1,
      reposterInfo: { userId: 'viewer-1' },
    });

    await act(async () => {
      likeRequest.reject(new Error('좋아요 요청 실패'));
      await likeRequest.promise.catch(() => undefined);
    });

    await waitFor(() => {
      expect(readPostState()).toMatchObject({
        likedByMe: false,
        likes: 4,
        bookmarkedByMe: true,
        isSaved: true,
        savedCollectionIds: ['collection-a'],
        isReposted: true,
        repostCount: 1,
        reposterInfo: { userId: 'viewer-1' },
      });
      expect(screen.getByRole('button', { name: 'toggle like' })).toBeEnabled();
    });
    expect(alertSpy).toHaveBeenCalledWith('좋아요 요청 실패');
  });
});
