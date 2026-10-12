import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommentRecord, PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  bookmarkPost: vi.fn(), createComment: vi.fn(), deleteComment: vi.fn(),
  deletePost: vi.fn(), fetchPostComments: vi.fn(), fetchPostDetail: vi.fn(),
  likePost: vi.fn(), repostPost: vi.fn(), unbookmarkPost: vi.fn(),
  unlikePost: vi.fn(), unrepostPost: vi.fn(),
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { handle: 'viewer' } }),
}));
vi.mock('@/lib/feed-api', () => ({
  ...api,
  formatRelativeTime: () => 'now',
  getInitials: () => 'A',
  updatePostBookmarkState: (post: PostRecord, bookmarkedByMe: boolean) => ({ ...post, bookmarkedByMe }),
  updatePostLikeState: (post: PostRecord) => ({
    ...post, likedByMe: !post.likedByMe,
    likes: Math.max(0, post.likes + (post.likedByMe ? -1 : 1)),
  }),
}));
vi.mock('../SaveToCollectionModal', () => ({
  default: ({ isOpen, onBookmarkStateChange }: {
    isOpen: boolean;
    onBookmarkStateChange?: (bookmarked: boolean) => Promise<boolean>;
  }) => isOpen
    ? <button type="button" onClick={() => void onBookmarkStateChange?.(true)}>북마크 적용</button>
    : null,
}));
import { PostDetail } from '../PostDetail';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const basePost: PostRecord = {
  postId: 'post-1', author: 'Author', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false, game: null,
  content: 'Post one', media: [], likes: 2, comments: 4, shares: 0,
  isReposted: false, repostCount: 1, likedByMe: false,
  bookmarkedByMe: false, mine: false, createdAt: '2026-10-10T00:00:00Z',
};
const makeComment = (commentId: string, content: string): CommentRecord => ({
  commentId, content, author: 'Viewer', authorHandle: 'viewer',
  authorProfileImageUrl: null, authorVerifiedBadge: false,
  createdAt: '2026-10-10T00:01:00Z', mine: true,
});
async function renderDetail(onPostUpdated = vi.fn()) {
  const result = render(<PostDetail postId="post-1" onBack={vi.fn()} onPostUpdated={onPostUpdated} />);
  await screen.findByText('Post one');
  return { ...result, onPostUpdated };
}

describe('PostDetail comment concurrency', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.fetchPostDetail.mockResolvedValue(basePost);
    api.fetchPostComments.mockResolvedValue([]);
    api.bookmarkPost.mockResolvedValue(undefined);
    api.likePost.mockResolvedValue(undefined);
    api.repostPost.mockResolvedValue({ postId: 'post-1', isReposted: true, repostCount: 2, repostedAt: null });
  });

  it('blocks Windows compositionend-before-Enter and allows the next Enter', async () => {
    api.createComment.mockResolvedValue(makeComment('ime', '가'));
    await renderDetail();
    const input = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: '가' } });
    fireEvent.compositionEnd(input, { data: '가' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false, keyCode: 13 });
    expect(api.createComment).not.toHaveBeenCalled();
    expect(input).toHaveValue('가');
    fireEvent.keyUp(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false, keyCode: 13 });
    await waitFor(() => expect(api.createComment).toHaveBeenCalledTimes(1));
  });

  it('does not retain the composition guard after the event turn or blur', async () => {
    api.createComment.mockResolvedValueOnce(makeComment('ime-first', '가'))
      .mockResolvedValueOnce(makeComment('ime-second', '가'));
    await renderDetail();
    const input = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(input, { target: { value: '가' } });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: '가' });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    await waitFor(() => expect(api.createComment).toHaveBeenCalledTimes(1));
    fireEvent.change(input, { target: { value: '가' } });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: '가' });
    fireEvent.blur(input);
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 13 });
    await waitFor(() => expect(api.createComment).toHaveBeenCalledTimes(2));
  });

  it('blocks active composition even when the native flag is false and keeps Shift+Enter', async () => {
    await renderDetail();
    const input = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(input, { target: { value: '가' } });
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false, keyCode: 13 });
    expect(api.createComment).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input, { data: '가' });
    expect(fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(api.createComment).not.toHaveBeenCalled();
  });

  it('preserves line breaks in loaded and newly submitted comments', async () => {
    api.fetchPostComments.mockResolvedValue([makeComment('existing', '첫 번째 줄\n두 번째 줄')]);
    api.createComment.mockImplementation(async (_postId: string, content: string) => makeComment('new', content));
    const { container } = await renderDetail();
    await screen.findByText('첫 번째 줄 두 번째 줄');
    const loaded = container.querySelector('p.whitespace-pre-wrap');
    expect(loaded).toHaveTextContent('첫 번째 줄 두 번째 줄');
    expect(loaded?.textContent).toBe('첫 번째 줄\n두 번째 줄');

    fireEvent.change(screen.getByRole('textbox', { name: '댓글 입력' }), {
      target: { value: '새 댓글 첫 줄\n새 댓글 둘째 줄' },
    });
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    await waitFor(() => {
      const submitted = Array.from(container.querySelectorAll('p.whitespace-pre-wrap'))
        .find((element) => element.textContent === '새 댓글 첫 줄\n새 댓글 둘째 줄');
      expect(submitted).toBeDefined();
    });
  });

  it('merges a comment into the latest like, repost, and bookmark state', async () => {
    const request = deferred<CommentRecord>();
    api.createComment.mockReturnValue(request.promise);
    const { onPostUpdated } = await renderDetail();
    const input = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(input, { target: { value: 'pending comment' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2개', pressed: false }));
    await screen.findByRole('button', { name: '좋아요 3개', pressed: true });
    fireEvent.click(screen.getByRole('button', { name: '리포스트', pressed: false }));
    await waitFor(() => expect(screen.getByRole('button', { name: '리포스트', pressed: true })).toHaveTextContent('2'));
    fireEvent.click(screen.getByRole('button', { name: '북마크 저장' }));
    fireEvent.click(screen.getByRole('button', { name: '북마크 적용' }));
    await screen.findByRole('button', { name: '북마크 해제' });
    await act(async () => { request.resolve(makeComment('comment-1', 'pending comment')); await request.promise; });
    expect(onPostUpdated.mock.calls.at(-1)?.[0]).toMatchObject({
      comments: 5, likedByMe: true, likes: 3, isReposted: true, repostCount: 2, bookmarkedByMe: true,
    });
    expect(screen.getByRole('button', { name: '좋아요 3개', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '리포스트', pressed: true })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: '북마크 해제' })).toBeInTheDocument();
  });

  it('preserves the failed draft and a newer draft written during success', async () => {
    const failed = deferred<CommentRecord>();
    const successful = deferred<CommentRecord>();
    api.createComment.mockReturnValueOnce(failed.promise).mockReturnValueOnce(successful.promise);
    await renderDetail();
    const input = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(input, { target: { value: 'retry me' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    await act(async () => { failed.reject(new Error('comment failed')); await failed.promise.catch(() => undefined); });
    expect(input).toHaveValue('retry me');
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    fireEvent.change(input, { target: { value: 'newer draft' } });
    await act(async () => { successful.resolve(makeComment('comment-2', 'retry me')); await successful.promise; });
    expect(input).toHaveValue('newer draft');
  });

  it('suppresses duplicate submissions synchronously', async () => {
    api.createComment.mockReturnValue(deferred<CommentRecord>().promise);
    await renderDetail();
    const input = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(input, { target: { value: 'only once' } });
    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);
    expect(api.createComment).toHaveBeenCalledTimes(1);
  });

  it('ignores an old post response without unlocking the new request', async () => {
    const oldRequest = deferred<CommentRecord>();
    const newRequest = deferred<CommentRecord>();
    api.createComment.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    api.fetchPostDetail.mockImplementation(async (postId: string) => ({
      ...basePost, postId, content: postId === 'post-1' ? 'Post one' : 'Post two',
    }));
    const onPostUpdated = vi.fn();
    const { rerender } = await renderDetail(onPostUpdated);
    const firstInput = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(firstInput, { target: { value: 'old response' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    rerender(<PostDetail postId="post-2" onBack={vi.fn()} onPostUpdated={onPostUpdated} />);
    await screen.findByText('Post two');
    const secondInput = screen.getByRole('textbox', { name: '댓글 입력' });
    fireEvent.change(secondInput, { target: { value: 'new response' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    expect(api.createComment).toHaveBeenNthCalledWith(2, 'post-2', 'new response');
    await act(async () => { oldRequest.resolve(makeComment('old-comment', 'old response')); await oldRequest.promise; });
    expect(screen.queryByText('old response')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '댓글 전송' })).toBeDisabled();
    expect(onPostUpdated).not.toHaveBeenCalled();
    await act(async () => { newRequest.resolve(makeComment('new-comment', 'new response')); await newRequest.promise; });
    expect(onPostUpdated.mock.calls[0][0]).toMatchObject({ postId: 'post-2', comments: 5 });
  });

  it('ignores a response after unmount', async () => {
    const request = deferred<CommentRecord>();
    api.createComment.mockReturnValue(request.promise);
    const onPostUpdated = vi.fn();
    const { unmount } = await renderDetail(onPostUpdated);
    fireEvent.change(screen.getByRole('textbox', { name: '댓글 입력' }), { target: { value: 'unmounted response' } });
    fireEvent.click(screen.getByRole('button', { name: '댓글 전송' }));
    unmount();
    await act(async () => { request.resolve(makeComment('after-unmount', 'unmounted response')); await request.promise; });
    expect(onPostUpdated).not.toHaveBeenCalled();
  });
});
