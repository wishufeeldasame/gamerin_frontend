import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchFeed: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

const navigation = vi.hoisted(() => ({
  query: '',
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.query),
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
    navigation.query = '';
    navigation.push.mockReset();
    navigation.replace.mockReset();
    api.fetchFeed.mockReset();
    api.likePost.mockReset();
    api.unlikePost.mockReset();
    api.fetchFeed.mockResolvedValue({
      items: [initialPost],
      nextCursor: null,
      hasNext: false,
    });
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  it('URL에서 팔로잉 탭을 복원하고 잘못된 탭 값은 추천으로 처리한다', async () => {
    navigation.query = 'tab=following';
    const view = render(<HomePage />);

    await waitFor(() => expect(api.fetchFeed).toHaveBeenCalledWith(
      'following',
      null,
      20,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(screen.getByRole('button', { name: '팔로잉' })).toHaveAttribute('aria-pressed', 'true');

    api.fetchFeed.mockClear();
    navigation.query = 'tab=unknown';
    view.rerender(<HomePage />);

    await waitFor(() => expect(api.fetchFeed).toHaveBeenCalledWith(
      'all',
      null,
      20,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    ));
    expect(screen.getByRole('button', { name: '추천' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('탭을 URL에 기록하고 문서 스크롤을 맨 위로 이동한다', async () => {
    render(<HomePage />);
    await screen.findByTestId('post-post-1');

    fireEvent.click(screen.getByRole('button', { name: '팔로잉' }));

    expect(navigation.push).toHaveBeenCalledWith('/home?tab=following', { scroll: false });
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('모션 감소 설정에서는 탭 전환 스크롤을 애니메이션하지 않는다', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    render(<HomePage />);
    await screen.findByTestId('post-post-1');

    fireEvent.click(screen.getByRole('button', { name: '팔로잉' }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' });
  });

  it('기존 게시글 딥링크는 피드를 요청하지 않고 상세 화면으로 이동한다', async () => {
    navigation.query = 'postId=post%2F1&target=comments';
    render(<HomePage />);

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(
      '/posts/post%2F1?target=comments',
    ));
    expect(api.fetchFeed).not.toHaveBeenCalled();
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
});
