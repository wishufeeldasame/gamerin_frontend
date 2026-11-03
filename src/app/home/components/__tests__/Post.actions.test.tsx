import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  fetchPostDetail: vi.fn(), fetchPostComments: vi.fn(),
  repostPost: vi.fn(), unrepostPost: vi.fn(), likePost: vi.fn(), unlikePost: vi.fn(),
  sharePost: vi.fn(),
}));
vi.mock('@/lib/message-api', () => ({ searchMessageRecipients: vi.fn().mockResolvedValue([]), sharePostMessage: vi.fn() }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { handle: 'viewer' } }) }));
vi.mock('@/lib/feed-api', async (original) => ({
  ...(await original<typeof import('@/lib/feed-api')>()), ...api,
}));
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));

import { Post } from '../Post';
import { PostDetail } from '../PostDetail';

const post: PostRecord = {
  postId: 'post-1', author: '작성자', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false, content: '액션 접근성 테스트',
  media: [], likes: 2, comments: 0, shares: 0, repostCount: 3, isReposted: false,
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt: '2026-10-01T00:00:00Z',
};

async function show(kind: 'card' | 'detail', record = post) {
  if (kind === 'card') render(<Post post={record} />);
  else {
    api.fetchPostDetail.mockResolvedValue(record);
    render(<PostDetail postId={record.postId} onBack={vi.fn()} />);
    await screen.findByRole('textbox', { name: '댓글 입력' });
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  api.fetchPostDetail.mockResolvedValue(post);
  api.fetchPostComments.mockResolvedValue([]);
  api.repostPost.mockResolvedValue({ postId: post.postId, isReposted: true, repostCount: 4 });
  api.unrepostPost.mockResolvedValue({ postId: post.postId, isReposted: false, repostCount: 3 });
  api.likePost.mockResolvedValue(undefined);
  api.unlikePost.mockResolvedValue(undefined);
});

afterEach(() => { vi.useRealTimers(); });

describe.each(['card', 'detail'] as const)('%s action accessibility', (kind) => {
  it('merges a late share response after closing into the latest like state', async () => {
    let resolve!: (value: { postId: string; shares: number }) => void;
    const pending = new Promise<{ postId: string; shares: number }>((done) => { resolve = done; });
    api.sharePost.mockReturnValue(pending);
    const onUpdated = vi.fn();
    const view = kind === 'card'
      ? render(<Post post={post} onShare={onUpdated} />)
      : render(<PostDetail postId={post.postId} onBack={vi.fn()} onPostUpdated={onUpdated} />);
    if (kind === 'detail') await screen.findByRole('textbox', { name: '댓글 입력' });
    fireEvent.click(screen.getByRole('button', { name: '게시물 공유' }));
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    expect(api.sharePost).toHaveBeenCalledExactlyOnceWith(post.postId, 'COPY_LINK');
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
      : render(<PostDetail postId={post.postId} onBack={vi.fn()} onPostUpdated={onUpdated} />);
    if (kind === 'detail') await screen.findByRole('textbox', { name: '댓글 입력' });
    fireEvent.click(screen.getByRole('button', { name: '게시물 공유' }));
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
