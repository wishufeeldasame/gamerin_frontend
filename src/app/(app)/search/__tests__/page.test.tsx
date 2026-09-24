import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';

const navigation = vi.hoisted(() => ({
  query: 'q=롤백&tab=all',
}));

const searchApi = vi.hoisted(() => ({
  fetchSearchAccounts: vi.fn(),
  fetchSearchHashtags: vi.fn(),
  fetchSearchOverview: vi.fn(),
  fetchSearchPosts: vi.fn(),
}));

const feedApi = vi.hoisted(() => ({
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock('@/lib/community-search-api', () => ({
  fetchSearchAccounts: searchApi.fetchSearchAccounts,
  fetchSearchHashtags: searchApi.fetchSearchHashtags,
  fetchSearchOverview: searchApi.fetchSearchOverview,
  fetchSearchPosts: searchApi.fetchSearchPosts,
}));

vi.mock('@/lib/feed-api', () => ({
  getInitials: (name: string) => name.slice(0, 1),
  likePost: feedApi.likePost,
  unlikePost: feedApi.unlikePost,
  updatePostLikeState: (post: PostRecord, likedByMe = !post.likedByMe) => ({
    ...post,
    likedByMe,
    likes: Math.max(
      0,
      post.likes + (likedByMe === post.likedByMe ? 0 : likedByMe ? 1 : -1),
    ),
  }),
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
    onToggleLike: (post: PostRecord) => void;
    onBookmarkChange?: (post: PostRecord) => void;
    onRepostChange?: (post: PostRecord) => void;
  }) => (
    <div
      data-testid={'post-' + post.postId}
      data-liked={String(post.likedByMe)}
      data-likes={String(post.likes)}
      data-bookmarked={String(post.bookmarkedByMe)}
      data-saved={String(post.isSaved)}
      data-collections={(post.savedCollectionIds ?? []).join(',')}
      data-reposted={String(post.isReposted)}
      data-repost-count={String(post.repostCount)}
      data-like-loading={String(Boolean(likeLoading))}
    >
      <button type="button" onClick={() => onToggleLike(post)}>
        toggle like
      </button>
      <button
        type="button"
        onClick={() =>
          onBookmarkChange?.({
            ...post,
            bookmarkedByMe: true,
            isSaved: true,
            savedCollectionIds: ['collection-latest'],
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
            repostCount: 4,
            reposterInfo: {
              userId: 'reposter-1',
              nickname: '리포스터',
              repostedAt: '2026-09-24T00:00:00Z',
            },
          })
        }
      >
        update repost
      </button>
    </div>
  ),
}));

import SearchPage from '../page';

const initialPost: PostRecord = {
  postId: 'post-1',
  author: '작성자',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: '좋아요 롤백 테스트',
  media: [],
  likes: 7,
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

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function configureSearchResult(tab: 'all' | 'posts') {
  navigation.query = 'q=롤백&tab=' + tab;
  searchApi.fetchSearchOverview.mockResolvedValue({
    query: '롤백',
    accounts: { items: [], hasMore: false },
    posts: { items: [initialPost], hasMore: false },
    hashtags: { items: [], hasMore: false },
  });
  searchApi.fetchSearchPosts.mockResolvedValue({
    items: [initialPost],
    nextCursor: null,
    hasNext: false,
  });
}

describe('SearchPage like rollback', () => {
  beforeEach(() => {
    searchApi.fetchSearchAccounts.mockReset();
    searchApi.fetchSearchHashtags.mockReset();
    searchApi.fetchSearchOverview.mockReset();
    searchApi.fetchSearchPosts.mockReset();
    feedApi.likePost.mockReset();
    feedApi.unlikePost.mockReset();
    searchApi.fetchSearchAccounts.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasNext: false,
    });
    searchApi.fetchSearchHashtags.mockResolvedValue([]);
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  it.each([
    ['전체', 'all'],
    ['게시글', 'posts'],
  ] as const)(
    '%s 탭에서 좋아요 필드만 롤백하고 요청 중 변경된 북마크와 리포스트 상태를 유지한다',
    async (_label, tab) => {
      const request = createDeferred<void>();
      configureSearchResult(tab);
      feedApi.likePost.mockReturnValue(request.promise);

      render(<SearchPage />);

      const renderedPost = await screen.findByTestId('post-post-1');
      fireEvent.click(screen.getByRole('button', { name: 'toggle like' }));

      await waitFor(() => {
        expect(renderedPost).toHaveAttribute('data-liked', 'true');
        expect(renderedPost).toHaveAttribute('data-likes', '8');
        expect(renderedPost).toHaveAttribute('data-like-loading', 'true');
      });

      fireEvent.click(screen.getByRole('button', { name: 'toggle like' }));
      expect(feedApi.likePost).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'update bookmark' }));
      await waitFor(() => {
        expect(renderedPost).toHaveAttribute('data-bookmarked', 'true');
        expect(renderedPost).toHaveAttribute('data-saved', 'true');
        expect(renderedPost).toHaveAttribute('data-collections', 'collection-latest');
      });

      fireEvent.click(screen.getByRole('button', { name: 'update repost' }));
      await waitFor(() => {
        expect(renderedPost).toHaveAttribute('data-reposted', 'true');
        expect(renderedPost).toHaveAttribute('data-repost-count', '4');
      });

      await act(async () => {
        request.reject(new Error('좋아요 요청 실패'));
        await request.promise.catch(() => undefined);
      });

      await waitFor(() => {
        expect(renderedPost).toHaveAttribute('data-liked', 'false');
        expect(renderedPost).toHaveAttribute('data-likes', '7');
        expect(renderedPost).toHaveAttribute('data-bookmarked', 'true');
        expect(renderedPost).toHaveAttribute('data-saved', 'true');
        expect(renderedPost).toHaveAttribute('data-collections', 'collection-latest');
        expect(renderedPost).toHaveAttribute('data-reposted', 'true');
        expect(renderedPost).toHaveAttribute('data-repost-count', '4');
        expect(renderedPost).toHaveAttribute('data-like-loading', 'false');
      });
      expect(window.alert).toHaveBeenCalledWith('좋아요 요청 실패');
    },
  );
});
