import { act, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentRecord, PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchPostComments: vi.fn(),
  fetchPostDetail: vi.fn(),
  refreshCollections: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { handle: 'viewer' } }),
}));

vi.mock('@/app/context/BookmarkCollectionContext', () => ({
  useBookmarkCollections: () => ({
    refreshCollections: api.refreshCollections,
  }),
}));

vi.mock('@/lib/feed-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feed-api')>();
  return {
    ...actual,
    fetchPostComments: api.fetchPostComments,
    fetchPostDetail: api.fetchPostDetail,
  };
});

vi.mock('framer-motion', () => ({
  motion: {
    div: (props: React.ComponentProps<'div'> & { initial?: unknown; animate?: unknown }) => {
      const { initial, animate, ...divProps } = props;
      void initial;
      void animate;
      return <div {...divProps} />;
    },
  },
}));

vi.mock('../SaveToCollectionModal', () => ({
  default: () => null,
}));

import { PostDetail } from '../PostDetail';

const post: PostRecord = {
  postId: 'post-1',
  author: 'Author',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: 'Post content',
  media: [],
  likes: 0,
  comments: 2,
  shares: 0,
  isReposted: false,
  repostCount: 0,
  likedByMe: false,
  bookmarkedByMe: false,
  mine: false,
  createdAt: '2026-09-18T00:00:00Z',
};

const comments: CommentRecord[] = [
  {
    commentId: 'comment-1',
    author: 'First',
    authorHandle: 'first',
    authorProfileImageUrl: null,
    authorVerifiedBadge: false,
    content: 'First comment',
    createdAt: '2026-09-18T00:00:00Z',
    mine: false,
  },
  {
    commentId: 'comment-2',
    author: 'Second',
    authorHandle: 'second',
    authorProfileImageUrl: null,
    authorVerifiedBadge: false,
    content: 'Target comment',
    createdAt: '2026-09-18T00:00:00Z',
    mine: false,
  },
];

describe('PostDetail comment deep link', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    api.fetchPostComments.mockReset();
    api.fetchPostDetail.mockReset();
    api.fetchPostDetail.mockResolvedValue(post);
    scrollIntoView.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView,
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  it.each([
    ['unknown failure', '게시물을 불러오지 못했습니다.'],
    [new Error('Request failed.'), 'Request failed.'],
  ])('게시물 로딩 실패 시 한국어 대체 안내를 표시하고 Error.message는 유지한다 (%s)', async (error, message) => {
    api.fetchPostDetail.mockRejectedValue(error);
    api.fetchPostComments.mockResolvedValue([]);
    render(<PostDetail postId="post-1" onBack={vi.fn()} />);

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '돌아가기' })).toBeInTheDocument();
  });

  it('waits for the full comment list, then scrolls to and highlights the matching comment', async () => {
    let resolveComments!: (value: CommentRecord[]) => void;
    const commentsPromise = new Promise<CommentRecord[]>((resolve) => {
      resolveComments = resolve;
    });
    api.fetchPostComments.mockReturnValue(commentsPromise);

    render(<PostDetail postId="post-1" onBack={vi.fn()} initialCommentId="comment-2" />);

    expect(screen.getByText('게시물을 불러오는 중...')).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await act(async () => {
      resolveComments(comments);
      await commentsPromise;
    });

    const targetComment = document.querySelector('[data-comment-id="comment-2"]');
    expect(targetComment).not.toBeNull();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(targetComment);
    expect(targetComment).toHaveClass('border-sky-300', 'bg-sky-50');
    expect(api.fetchPostComments).toHaveBeenCalledTimes(1);
  });

  it('falls back to the comments section when the linked comment no longer exists', async () => {
    api.fetchPostComments.mockResolvedValue(comments);

    render(<PostDetail postId="post-1" onBack={vi.fn()} initialCommentId="deleted-comment" />);

    await screen.findByText('Target comment');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('comments'));
    expect(api.fetchPostComments).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Post content')).toBeInTheDocument();
  });

  it('게시물과 댓글에 ISO 및 한국어 절대 시각 툴팁을 표시한다', async () => {
    api.fetchPostComments.mockResolvedValue(comments);
    render(<PostDetail postId="post-1" onBack={vi.fn()} />);
    await screen.findByText('Target comment');
    const times = document.querySelectorAll('time');
    expect(times).toHaveLength(3);
    for (const time of times) {
      expect(time).toHaveAttribute('dateTime', '2026-09-18T00:00:00.000Z');
      expect(time.title).toMatch(/^2026년 9월 18일 (오전|오후) \d{1,2}:00$/);
    }
  });

  it('keeps the existing target=comments section scroll behavior', async () => {
    api.fetchPostComments.mockResolvedValue(comments);

    render(<PostDetail postId="post-1" onBack={vi.fn()} initialScrollTarget="comments" />);

    await screen.findByText('Target comment');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('comments'));
  });

  it('shows the server error and a link back home when the post does not exist', async () => {
    api.fetchPostDetail.mockRejectedValue(new Error('게시물을 찾을 수 없습니다.'));
    api.fetchPostComments.mockResolvedValue([]);

    render(<PostDetail postId="missing-post" onBack={vi.fn()} />);

    expect(await screen.findByText('게시물을 찾을 수 없습니다.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '홈으로 돌아가기' })).toHaveAttribute('href', '/home');
  });
});
