import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchHashtagPosts: vi.fn(),
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ name: 'gaming' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/community-search-api', () => ({
  fetchHashtagPosts: api.fetchHashtagPosts,
}));
vi.mock('@/lib/feed-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feed-api')>()),
  likePost: api.likePost,
  unlikePost: api.unlikePost,
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
          })
        }
      >
        update repost
      </button>
    </div>
  ),
}));

import HashtagPostsPage from '../page';

const post: PostRecord = {
  postId: 'post-1',
  author: '작성자',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: '해시태그 게시글',
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

describe('HashtagPostsPage like rollback', () => {
  beforeEach(() => {
    api.fetchHashtagPosts.mockResolvedValue({
      items: [post],
      nextCursor: null,
      hasNext: false,
    });
    api.likePost.mockReset();
    api.unlikePost.mockReset();
  });

  it('shows a link back home when the hashtag request fails', async () => {
    api.fetchHashtagPosts.mockRejectedValue(new Error('해시태그 게시글을 불러오지 못했습니다.'));

    render(<HashtagPostsPage />);

    expect(await screen.findByText('해시태그 게시글을 불러오지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/home');
  });

  it('다음 커서가 없으면 hasNext가 true여도 더보기를 표시하지 않는다', async () => {
    api.fetchHashtagPosts.mockResolvedValue({
      items: [post],
      nextCursor: null,
      hasNext: true,
    });

    render(<HashtagPostsPage />);

    await screen.findByTestId('post-post-1');
    expect(screen.queryByRole('button', { name: '더보기' })).not.toBeInTheDocument();
    expect(api.fetchHashtagPosts).toHaveBeenCalledTimes(1);
  });

  it('좋아요 실패 시 요청 중 변경된 북마크와 리포스트 상태를 유지한다', async () => {
    const likeRequest = deferred<void>();
    api.likePost.mockReturnValue(likeRequest.promise);

    render(<HashtagPostsPage />);
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
      isReposted: true,
      repostCount: 1,
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
        isReposted: true,
        repostCount: 1,
      });
      expect(screen.getByRole('button', { name: 'toggle like' })).toBeEnabled();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('좋아요 요청 실패');
  });
});
