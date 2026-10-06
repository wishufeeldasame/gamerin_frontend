import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchFeed: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

let intersectionCallback: IntersectionObserverCallback | null = null;
const observeIntersection = vi.fn();

class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin = '400px 0px';
  readonly thresholds = [0];
  readonly disconnect = vi.fn();
  readonly observe = observeIntersection;
  readonly takeRecords = () => [];
  readonly unobserve = vi.fn();

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }
}

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('@/app/home/components/PostComposer', () => ({
  PostComposer: () => null,
}));

vi.mock('@/app/home/components/RightSidebar', () => ({
  RightSidebar: () => null,
}));

vi.mock('@/lib/feed-api', () => ({
  fetchFeed: api.fetchFeed,
  likePost: api.likePost,
  unlikePost: api.unlikePost,
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
          })
        }
      >
        update repost
      </button>
    </div>
  ),
}));

import HomePage from '../page';

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

describe('HomePage like rollback', () => {
  beforeEach(() => {
    api.fetchFeed.mockReset();
    api.likePost.mockReset();
    api.unlikePost.mockReset();
    api.fetchFeed.mockResolvedValue({
      items: [initialPost],
      nextCursor: null,
      hasNext: false,
    });
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    intersectionCallback = null;
    observeIntersection.mockReset();
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  it('rolls back only like fields and keeps bookmark and repost updates made while the request is pending', async () => {
    const request = createDeferred<void>();
    api.likePost.mockReturnValue(request.promise);

    render(<HomePage />);

    const renderedPost = await screen.findByTestId('post-post-1');
    fireEvent.click(screen.getByRole('button', { name: 'toggle like' }));

    await waitFor(() => {
      expect(renderedPost).toHaveAttribute('data-liked', 'true');
      expect(renderedPost).toHaveAttribute('data-likes', '8');
      expect(renderedPost).toHaveAttribute('data-like-loading', 'true');
    });

    fireEvent.click(screen.getByRole('button', { name: 'toggle like' }));
    expect(api.likePost).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'update bookmark' }));
    await waitFor(() => {
      expect(renderedPost).toHaveAttribute('data-bookmarked', 'true');
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
      expect(renderedPost).toHaveAttribute('data-reposted', 'true');
      expect(renderedPost).toHaveAttribute('data-repost-count', '4');
      expect(renderedPost).toHaveAttribute('data-like-loading', 'false');
    });
    expect(window.alert).toHaveBeenCalledWith('좋아요 요청 실패');
  });

  it('loads the next page when the feed sentinel enters the viewport', async () => {
    const nextPost = {
      ...initialPost,
      postId: 'post-2',
      content: '무한 스크롤로 불러온 게시물',
    };
    api.fetchFeed
      .mockResolvedValueOnce({
        items: [initialPost],
        nextCursor: 'cursor-1',
        hasNext: true,
      })
      .mockResolvedValueOnce({
        items: [nextPost],
        nextCursor: null,
        hasNext: false,
      });

    render(<HomePage />);

    await screen.findByTestId('post-post-1');
    await waitFor(() => expect(observeIntersection).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    await screen.findByTestId('post-post-2');
    expect(api.fetchFeed).toHaveBeenNthCalledWith(
      2, 'all', 'cursor-1', 20, expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByTestId('feed-load-more-sentinel')).not.toBeInTheDocument();
  });

  it('stops observing after a next-page failure until the user retries', async () => {
    api.fetchFeed
      .mockResolvedValueOnce({
        items: [initialPost],
        nextCursor: 'cursor-1',
        hasNext: true,
      })
      .mockRejectedValueOnce(new Error('다음 게시물을 불러오지 못했습니다.'));

    render(<HomePage />);

    await screen.findByTestId('post-post-1');
    await waitFor(() => expect(observeIntersection).toHaveBeenCalledTimes(1));

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('다음 게시물을 불러오지 못했습니다.');
    expect(api.fetchFeed).toHaveBeenCalledTimes(2);
    expect(observeIntersection).toHaveBeenCalledTimes(1);

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    expect(api.fetchFeed).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(observeIntersection).toHaveBeenCalledTimes(2));
  });
});
