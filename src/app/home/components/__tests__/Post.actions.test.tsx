import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchPostDetailByNumber: vi.fn(), fetchPostComments: vi.fn(),
  repostPost: vi.fn(), unrepostPost: vi.fn(), likePost: vi.fn(), unlikePost: vi.fn(),
  sharePost: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/message-api', () => ({ searchMessageRecipients: vi.fn().mockResolvedValue([]), sharePostMessage: vi.fn() }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer', handle: 'viewer', nickname: '테스터' } }) }));
vi.mock('@/lib/feed-api', async (original) => ({
  ...(await original<typeof import('@/lib/feed-api')>()), ...api,
}));
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));

import { Post } from '../Post';
import { PostDetail } from '../PostDetail';

const post: PostRecord = {
  postId: 'post-1', postNumber: 1, author: '작성자', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false, content: '액션 접근성 테스트',
  media: [], likes: 2, comments: 0, shares: 0, repostCount: 3, isReposted: false,
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt: '2026-10-01T00:00:00Z',
};

async function show(kind: 'card' | 'detail', record = post) {
  if (kind === 'card') render(<Post post={record} />);
  else {
    api.fetchPostDetailByNumber.mockResolvedValue(record);
    render(<PostDetail postNumber={record.postNumber} onBack={vi.fn()} />);
    await screen.findByRole('textbox', { name: '댓글 입력' });
  }
}

beforeEach(() => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  vi.resetAllMocks();
  vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
  api.fetchPostDetailByNumber.mockResolvedValue(post);
  api.fetchPostComments.mockResolvedValue([]);
  api.repostPost.mockResolvedValue({ postId: post.postId, isReposted: true, repostCount: 4 });
  api.unrepostPost.mockResolvedValue({ postId: post.postId, isReposted: false, repostCount: 3 });
  api.likePost.mockResolvedValue(undefined);
  api.unlikePost.mockResolvedValue(undefined);
});

afterEach(() => { vi.useRealTimers(); });

describe('card repost attribution', () => {
  it('shows the viewer immediately and removes the attribution when their repost is cancelled', async () => {
    let confirmRepost: (value: object) => void = () => {};
    api.repostPost.mockReturnValue(new Promise((resolve) => { confirmRepost = resolve; }));
    render(<Post post={post} />);

    fireEvent.click(screen.getByRole('button', { name: '리포스트' }));

    expect(screen.getByText('테스터')).toBeInTheDocument();
    expect(screen.getByText(/님이 리포스트했습니다/)).toBeInTheDocument();
    await act(async () => {
      confirmRepost({ isReposted: true, repostCount: 4, repostedAt: '2026-11-09T00:00:00Z' });
    });
    expect(document.querySelector('time')).toHaveAttribute('datetime', '2026-11-09T00:00:00.000Z');
    fireEvent.click(screen.getByRole('button', { name: '리포스트' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '리포스트' })).not.toBeDisabled());
    expect(screen.queryByText(/님이 리포스트했습니다/)).not.toBeInTheDocument();
  });

  it('restores the previous reposter attribution when the request fails', async () => {
    api.repostPost.mockRejectedValue(new Error('리포스트 실패'));
    render(<Post post={{
      ...post,
      reposterInfo: { userId: 'other', nickname: '다른 게이머', repostedAt: post.createdAt },
    }} />);

    fireEvent.click(screen.getByRole('button', { name: '리포스트' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '리포스트' })).not.toBeDisabled());
    expect(screen.getByText('다른 게이머')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '리포스트', pressed: false })).toBeInTheDocument();
    expect(screen.queryByText('테스터')).not.toBeInTheDocument();
  });
});

describe.each(['card', 'detail'] as const)('%s action accessibility', (kind) => {
  it('shows the abbreviated view count with the exact count for screen readers, and hides it when absent', async () => {
    await show(kind, { ...post, viewCount: 12_345 });
    expect(screen.getByText('1.2만')).toBeInTheDocument();
    expect(screen.getByText('조회수 12,345회')).toHaveClass('sr-only');
  });
  it('hides the view count when the server sent none', async () => {
    await show(kind, { ...post, viewCount: null });
    expect(screen.queryByText(/조회수/)).not.toBeInTheDocument();
  });
  it('merges a late share response after closing into the latest like state', async () => {
    let resolve!: (value: { postId: string; shares: number }) => void;
    const pending = new Promise<{ postId: string; shares: number }>((done) => { resolve = done; });
    api.sharePost.mockReturnValue(pending);
    const onUpdated = vi.fn();
    const view = kind === 'card'
      ? render(<Post post={post} onShare={onUpdated} />)
      : render(<PostDetail postNumber={post.postNumber} onBack={vi.fn()} onPostUpdated={onUpdated} />);
    if (kind === 'detail') await screen.findByRole('textbox', { name: '댓글 입력' });
    fireEvent.click(screen.getByRole('button', { name: '게시글 공유' }));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    await waitFor(() => expect(api.sharePost).toHaveBeenCalledExactlyOnceWith(post.postId, 'COPY_LINK'));
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    if (kind === 'card') {
      view.rerender(<Post post={{ ...post, likes: 3, likedByMe: true, comments: 7, bookmarkedByMe: true }} onShare={onUpdated} />);
    } else {
      fireEvent.click(screen.getByRole('button', { name: '좋아요 2개', pressed: false }));
      await screen.findByRole('button', { name: '좋아요 3개', pressed: true });
    }
    vi.useFakeTimers();
    await act(async () => { resolve({ postId: post.postId, shares: 1 }); await pending; });
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(onUpdated.mock.calls.at(-1)?.[0]).toMatchObject({ likes: 3, likedByMe: true, shares: 1 });
    if (kind === 'card') expect(onUpdated.mock.calls.at(-1)?.[0]).toMatchObject({ comments: 7, bookmarkedByMe: true });
    expect(screen.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeInTheDocument();
  });
  it('ignores a share response after its parent screen unmounts', async () => {
    let resolve!: (value: { postId: string; shares: number }) => void;
    const pending = new Promise<{ postId: string; shares: number }>((done) => { resolve = done; });
    api.sharePost.mockReturnValue(pending);
    const onUpdated = vi.fn();
    const view = kind === 'card'
      ? render(<Post post={post} onShare={onUpdated} />)
      : render(<PostDetail postNumber={post.postNumber} onBack={vi.fn()} onPostUpdated={onUpdated} />);
    if (kind === 'detail') await screen.findByRole('textbox', { name: '댓글 입력' });
    fireEvent.click(screen.getByRole('button', { name: '게시글 공유' }));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    view.unmount();
    vi.useFakeTimers();
    await act(async () => { resolve({ postId: post.postId, shares: 1 }); await pending; });
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    expect(onUpdated).not.toHaveBeenCalled();
  });
  it('keeps the repost name fixed while state, count and API method toggle', async () => {
    await show(kind);
    fireEvent.click(screen.getByRole('button', { name: '리포스트', pressed: false }));
    await waitFor(() => {
      expect(api.repostPost).toHaveBeenCalledExactlyOnceWith(post.postId);
      expect(screen.getByRole('button', { name: '리포스트', pressed: true })).toHaveTextContent('4');
      expect(screen.getByRole('button', { name: '리포스트' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: '리포스트', pressed: true }));
    await waitFor(() => {
      expect(api.unrepostPost).toHaveBeenCalledExactlyOnceWith(post.postId);
      expect(screen.getByRole('button', { name: '리포스트', pressed: false })).toHaveTextContent('3');
    });
    expect(screen.getByRole('button', { name: '리포스트' })).toHaveAccessibleName('리포스트');
  });

  it('restores state and exposes the server error after a failed repost', async () => {
    api.repostPost.mockRejectedValue(new Error('리포스트 실패 테스트'));
    await show(kind);
    fireEvent.click(screen.getByRole('button', { name: '리포스트', pressed: false }));
    await waitFor(() => {
      const button = screen.getByRole('button', { name: '리포스트', pressed: false });
      expect(button).toHaveTextContent('3');
      expect(button).toBeEnabled();
      expect(button).toHaveAccessibleDescription('리포스트 실패 테스트');
    });
    expect(api.repostPost).toHaveBeenCalledTimes(1);
    expect(api.unrepostPost).not.toHaveBeenCalled();
  });

  it('describes disabled self-reposts without sending a request', async () => {
    await show(kind, { ...post, mine: true });
    const button = screen.getByRole('button', { name: '리포스트', pressed: false });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription('본인 게시글은 리포스트할 수 없습니다.');
    fireEvent.click(button);
    expect(api.repostPost).not.toHaveBeenCalled();
    expect(api.unrepostPost).not.toHaveBeenCalled();
  });

  it('does not submit twice while a repost request is pending', async () => {
    let finish!: (value: { postId: string; isReposted: boolean; repostCount: number }) => void;
    api.repostPost.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await show(kind);
    const button = screen.getByRole('button', { name: '리포스트', pressed: false });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api.repostPost).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => finish({ postId: post.postId, isReposted: true, repostCount: 4 }));
    expect(screen.getByRole('button', { name: '리포스트', pressed: true })).toBeEnabled();
  });
});

it('updates the detail like count and pressed state without changing the action name', async () => {
  await show('detail');
  fireEvent.click(screen.getByRole('button', { name: '좋아요 2개', pressed: false }));
  await waitFor(() => expect(screen.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeEnabled());
  expect(api.likePost).toHaveBeenCalledExactlyOnceWith(post.postId);
  fireEvent.click(screen.getByRole('button', { name: '좋아요 3개', pressed: true }));
  await waitFor(() => expect(screen.getByRole('button', { name: '좋아요 2개', pressed: false })).toBeEnabled());
  expect(api.unlikePost).toHaveBeenCalledExactlyOnceWith(post.postId);
});
