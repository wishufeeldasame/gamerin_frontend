import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';
import type { CommentRecord, PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  deletePost: vi.fn(), deleteComment: vi.fn(), fetchPostDetail: vi.fn(), fetchPostComments: vi.fn(),
}));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { handle: 'author' } }) }));
vi.mock('@/lib/feed-api', async (original) => ({
  ...(await original<typeof import('@/lib/feed-api')>()), ...api,
}));
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));

import { Post } from '../Post';
import { PostDetail } from '../PostDetail';

const post: PostRecord = {
  postId: 'post-1', author: '작성자', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false,
  content: '테스트 게시물', media: [], likes: 0, comments: 1, shares: 0,
  isReposted: false, repostCount: 0, likedByMe: false, bookmarkedByMe: false,
  mine: true, createdAt: '2026-10-01T00:00:00Z',
};
const comment: CommentRecord = {
  commentId: 'comment-1', author: '작성자', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false,
  content: '테스트 댓글', mine: true, createdAt: post.createdAt,
};
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function openDeletion(label = '게시물 메뉴') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));
  return screen.getByRole('alertdialog');
}
beforeEach(() => {
  vi.resetAllMocks();
  api.fetchPostDetail.mockResolvedValue(post);
  api.fetchPostComments.mockResolvedValue([comment]);
  api.deletePost.mockResolvedValue(undefined);
  api.deleteComment.mockResolvedValue(undefined);
});

describe('게시물 카드 확인창', () => {
  it('취소 시 요청하지 않고 닫힌 메뉴의 트리거로 포커스를 복원한다', async () => {
    render(<Post post={post} />);
    const dialog = openDeletion();
    fireEvent.click(within(dialog).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.deletePost).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '게시물 메뉴' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '게시물 메뉴' })).toHaveAttribute('aria-expanded', 'false');
  });
  it('연속 확인과 요청 대기 중 재클릭에도 한 번만 삭제하고 성공 콜백을 유지한다', async () => {
    const deletion = deferred();
    api.deletePost.mockReturnValue(deletion.promise);
    const onDelete = vi.fn();
    render(<Post post={post} onDelete={onDelete} />);
    const button = within(openDeletion()).getByRole('button', { name: '삭제' });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(api.deletePost).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '게시물 메뉴' }));
    expect(screen.getByRole('button', { name: '삭제 중...' })).toBeDisabled();
    await act(async () => deletion.resolve());
    expect(onDelete).toHaveBeenCalledWith(post);
  });
  it.each([
    [new Error('삭제 실패'), '삭제 실패'],
    [null, '게시물을 삭제하지 못했습니다.'],
  ])('실패 시 오류 토스트(%s)를 띄우고 재시도할 수 있다', async (error, message) => {
    api.deletePost.mockRejectedValueOnce(error);
    const onDelete = vi.fn();
    render(<Post post={post} onDelete={onDelete} />);
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
    expect(api.deletePost).toHaveBeenCalledTimes(2);
  });
  it('확인 대기 중 게시물 대상이 변경되면 삭제를 취소한다', async () => {
    const view = render(<Post post={post} />);
    openDeletion();
    view.rerender(<Post post={{ ...post, postId: 'post-2' }} />);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.deletePost).not.toHaveBeenCalled();
  });
});

describe('게시물 상세 확인창', () => {
  it('댓글 삭제 Esc 취소 시 요청하지 않고 댓글 메뉴로 포커스를 돌린다', async () => {
    render(<PostDetail postId={post.postId} onBack={vi.fn()} />);
    await screen.findByText(comment.content);
    const dialog = openDeletion('댓글 메뉴');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(api.deleteComment).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '댓글 메뉴' })).toHaveFocus();
  });
  it('댓글 삭제 확인 시 한 번만 요청하고 댓글과 개수를 갱신한다', async () => {
    const onPostUpdated = vi.fn();
    render(<PostDetail postId={post.postId} onBack={vi.fn()} onPostUpdated={onPostUpdated} />);
    await screen.findByText(comment.content);
    fireEvent.click(within(openDeletion('댓글 메뉴')).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(screen.queryByText(comment.content)).not.toBeInTheDocument());
    expect(api.deleteComment).toHaveBeenCalledExactlyOnceWith(post.postId, comment.commentId);
    expect(onPostUpdated).toHaveBeenCalledWith(expect.objectContaining({ comments: 0 }));
  });
  it.each([
    [new Error('댓글 삭제 실패'), '댓글 삭제 실패'],
    [null, '댓글을 삭제하지 못했습니다.'],
  ])('댓글 삭제 실패 시 댓글·개수는 유지하고 오류(%s)를 표시한다', async (error, message) => {
    api.deleteComment.mockRejectedValueOnce(error);
    const onPostUpdated = vi.fn();
    render(<PostDetail postId={post.postId} onBack={vi.fn()} onPostUpdated={onPostUpdated} />);
    await screen.findByText(comment.content);
    fireEvent.click(within(openDeletion('댓글 메뉴')).getByRole('button', { name: '삭제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText(comment.content)).toBeInTheDocument();
    expect(onPostUpdated).not.toHaveBeenCalled();
  });
  it('상세 게시물 삭제는 확인 뒤에만 요청하고 기존 이동 콜백을 호출한다', async () => {
    const onBack = vi.fn();
    const onPostDeleted = vi.fn();
    render(<PostDetail postId={post.postId} onBack={onBack} onPostDeleted={onPostDeleted} />);
    await screen.findByText(post.content!);
    const firstDialog = openDeletion();
    await act(async () => {
      fireEvent.click(within(firstDialog).getByRole('button', { name: '취소' }));
    });
    expect(api.deletePost).not.toHaveBeenCalled();
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onPostDeleted).toHaveBeenCalledOnce());
    expect(onBack).not.toHaveBeenCalled();
    expect(api.deletePost).toHaveBeenCalledExactlyOnceWith(post.postId);
    expect(onPostDeleted).toHaveBeenCalledWith(post.postId);
  });
  it('삭제 콜백이 없으면 뒤로 이동을 한 번만 호출한다', async () => {
    const onBack = vi.fn();
    render(<PostDetail postId={post.postId} onBack={onBack} />);
    await screen.findByText(post.content!);
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onBack).toHaveBeenCalledOnce());
  });
  it('화면을 떠난 뒤 도착한 삭제 성공은 이동하지 않는다', async () => {
    const deletion = deferred();
    api.deletePost.mockReturnValue(deletion.promise);
    const onBack = vi.fn();
    const onPostDeleted = vi.fn();
    const view = render(<PostDetail postId={post.postId} onBack={onBack} onPostDeleted={onPostDeleted} />);
    await screen.findByText(post.content!);
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(api.deletePost).toHaveBeenCalledOnce());
    view.unmount();
    await act(async () => deletion.resolve());
    expect(onBack).not.toHaveBeenCalled();
    expect(onPostDeleted).not.toHaveBeenCalled();
  });
  it.each([
    [new Error('상세 삭제 실패'), '상세 삭제 실패'],
    [null, '게시물을 삭제하지 못했습니다.'],
  ])('삭제 실패는 이동하지 않고 오류(%s) 표시 후 재시도할 수 있다', async (error, message) => {
    api.deletePost.mockRejectedValueOnce(error);
    const onBack = vi.fn();
    const onPostDeleted = vi.fn();
    render(<PostDetail postId={post.postId} onBack={onBack} onPostDeleted={onPostDeleted} />);
    await screen.findByText(post.content!);
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onBack).not.toHaveBeenCalled();
    expect(onPostDeleted).not.toHaveBeenCalled();
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(onPostDeleted).toHaveBeenCalledOnce());
    expect(api.deletePost).toHaveBeenCalledTimes(2);
    expect(onBack).not.toHaveBeenCalled();
  });
  it('대상이 바뀐 뒤 이전 삭제 응답은 새 요청의 잠금을 해제하지 않는다', async () => {
    const first = deferred();
    const second = deferred();
    api.deletePost.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onBack = vi.fn();
    const onPostDeleted = vi.fn();
    const view = render(<PostDetail postId={post.postId} onBack={onBack} onPostDeleted={onPostDeleted} />);
    await screen.findByText(post.content!);
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(api.deletePost).toHaveBeenCalledTimes(1));
    api.fetchPostDetail.mockResolvedValue({ ...post, postId: 'post-2', content: '다음 게시물' });
    view.rerender(<PostDetail postId="post-2" onBack={onBack} onPostDeleted={onPostDeleted} />);
    await screen.findByText('다음 게시물');
    fireEvent.click(within(openDeletion()).getByRole('button', { name: '삭제' }));
    await waitFor(() => expect(api.deletePost).toHaveBeenCalledTimes(2));
    await act(async () => first.resolve());
    expect(onPostDeleted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '게시물 메뉴' }));
    expect(screen.getByRole('button', { name: '삭제 중...' })).toBeDisabled();
    await act(async () => second.resolve());
    expect(onPostDeleted).toHaveBeenCalledExactlyOnceWith('post-2');
    expect(onBack).not.toHaveBeenCalled();
  });
});
