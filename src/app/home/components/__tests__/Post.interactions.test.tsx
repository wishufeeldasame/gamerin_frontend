import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/renderWithPopup';
import type { PostRecord, CommentRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  createComment: vi.fn(), fetchPostDetail: vi.fn(), fetchPostComments: vi.fn(),
  fetchNotifications: vi.fn(), fetchUnreadNotificationCount: vi.fn(),
  markNotificationRead: vi.fn(), markAllNotificationsRead: vi.fn(),
  push: vi.fn(), toggleRepost: vi.fn(), fetchCollectionsForPost: vi.fn(),
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'viewer', handle: 'viewer', nickname: '테스터' }, logout: vi.fn() }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: api.push }), usePathname: () => '/home',
}));
vi.mock('@/hooks/useVisiblePolling', () => ({ useVisiblePolling: vi.fn() }));
vi.mock('@/app/context/BookmarkCollectionContext', () => ({
  useBookmarkCollections: () => ({
    fetchCollectionsForPost: api.fetchCollectionsForPost, refreshCollections: vi.fn(),
  }),
}));
vi.mock('@/lib/feed-api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/feed-api')>(),
  createComment: api.createComment, fetchPostDetail: api.fetchPostDetail, fetchPostComments: api.fetchPostComments,
}));
vi.mock('@/lib/notification-api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/notification-api')>(),
  fetchNotifications: api.fetchNotifications, fetchUnreadNotificationCount: api.fetchUnreadNotificationCount,
  markNotificationRead: api.markNotificationRead, markAllNotificationsRead: api.markAllNotificationsRead,
}));
vi.mock('@/hooks/useRepost', () => ({
  useRepost: (post: PostRecord) => ({
    isReposted: post.isReposted, repostCount: post.repostCount, isLoading: false,
    error: null, toggleRepost: api.toggleRepost,
  }),
}));

import { Post } from '../Post';
import { PostDetail } from '../PostDetail';
import { Header } from '../Header';

const post: PostRecord = {
  postId: 'post-1', author: '작성자', authorHandle: 'author', authorProfileImageUrl: null,
  authorVerifiedBadge: false, game: null, content: '안녕 @alpha #게임', media: [],
  likes: 2, comments: 1, shares: 0, isReposted: false, repostCount: 3, likedByMe: false,
  bookmarkedByMe: false, mine: false, createdAt: '2026-10-09T00:00:00Z',
};
const comment: CommentRecord = {
  commentId: 'comment-1', author: '댓글 작성자', authorHandle: 'commenter', authorProfileImageUrl: null,
  authorVerifiedBadge: false, content: '@bravo #댓글태그', mine: false, createdAt: post.createdAt,
};
async function detail() {
  render(<PostDetail postId={post.postId} onBack={vi.fn()} />);
  return await screen.findByRole('textbox', { name: '댓글 입력' });
}

describe('FE-7 shared menus and actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchPostDetail.mockResolvedValue(post);
    api.fetchPostComments.mockResolvedValue([comment]);
    api.createComment.mockResolvedValue({ ...comment, commentId: 'created', content: '새 댓글' });
    api.fetchCollectionsForPost.mockResolvedValue([]);
    api.fetchUnreadNotificationCount.mockResolvedValue(1);
    api.markNotificationRead.mockResolvedValue(undefined);
    api.fetchNotifications.mockResolvedValue({ items: [{
      notificationId: 'n1', type: 'like', actor: { userId: 'other', handle: 'other', nickname: '알림 사용자' },
      postId: 'post-1', read: false, createdAt: post.createdAt,
    }], nextCursor: null, hasNext: false });
  });

  it('shares one open ID across notification portal and two post menus', async () => {
    render(<><Header /><Post post={post} /><Post post={{ ...post, postId: 'post-2' }} /></>);
    const bell = screen.getByRole('button', { name: '알림' });
    fireEvent.click(bell);
    await screen.findByText('알림 사용자님이 게시글을 좋아합니다.');
    expect(screen.getByRole('button', { name: '알림 닫기' })).toHaveFocus();
    fireEvent.pointerDown(screen.getByRole('button', { name: '알림 닫기' }));
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(bell).toHaveFocus();
    const menus = screen.getAllByRole('button', { name: '게시물 메뉴' });
    fireEvent.click(menus[0]); fireEvent.click(menus[1]);
    expect(menus[0]).toHaveAttribute('aria-expanded', 'false');
    expect(menus[1]).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(bell);
    expect(menus[1]).toHaveAttribute('aria-expanded', 'false');
    fireEvent.pointerDown(document.body);
    expect(bell).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps notification navigation and close-button dismissal', async () => {
    render(<Header />);
    const bell = screen.getByRole('button', { name: '알림' });
    fireEvent.click(bell);
    fireEvent.click(await screen.findByText('알림 사용자님이 게시글을 좋아합니다.'));
    await waitFor(() => expect(api.push).toHaveBeenCalledWith('/posts/post-1'));
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(bell);
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(bell).toHaveFocus();
  });

  it('leaves Header search Escape unchanged and lets the next Escape close notifications', () => {
    render(<Header />);
    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));
    const bell = screen.getByRole('button', { name: '알림' });
    fireEvent.click(bell);
    const search = screen.getByRole('textbox', { name: '통합 검색' });
    search.focus();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.getByRole('button', { name: '검색 열기' })).toHaveAttribute('aria-expanded', 'false');
    expect(bell).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(bell).toHaveFocus();
  });

  it('uses the same accessible action names and states in card and detail', async () => {
    const view = render(<Post post={{ ...post, likedByMe: true, isReposted: true, mine: true }} />);
    expect(screen.getByRole('button', { name: '좋아요 2개', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '리포스트', pressed: true })).toHaveAccessibleDescription('본인 게시글은 리포스트할 수 없습니다.');
    expect(screen.getByRole('button', { name: '북마크 저장' })).toHaveAttribute('aria-haspopup', 'dialog');
    expect(screen.getByRole('button', { name: '북마크 저장' })).not.toHaveAttribute('aria-pressed');
    view.unmount();
    await detail();
    expect(screen.getByRole('button', { name: '좋아요 2개', pressed: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '리포스트', pressed: false })).toBeInTheDocument();
  });

  it('links detail/comment mentions, but not comment hashtags or comment menus', async () => {
    await detail();
    expect(screen.getByRole('link', { name: '@alpha' })).toHaveAttribute('href', '/profile/alpha');
    expect(screen.getByRole('link', { name: '@bravo' })).toHaveAttribute('href', '/profile/bravo');
    expect(screen.queryByRole('link', { name: '#댓글태그' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '댓글 메뉴' }));
    expect(screen.getByRole('button', { name: '댓글 신고' })).toBeInTheDocument();
    const menu = screen.getByRole('button', { name: '게시물 메뉴' });
    fireEvent.click(menu); fireEvent.keyDown(document, { key: 'Escape' });
    expect(menu).toHaveFocus();
    expect(screen.getByRole('button', { name: '댓글 신고' })).toBeInTheDocument();
  });

  it('submits Enter exactly once through the form and clears only after success', async () => {
    const textarea = await detail();
    fireEvent.change(textarea, { target: { value: '새 댓글' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    await waitFor(() => expect(api.createComment).toHaveBeenCalledWith('post-1', '새 댓글'));
    expect(api.createComment).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(textarea).toHaveValue(''));
  });

  it('keeps Shift+Enter newline and Korean composing Enter without submission', async () => {
    const textarea = await detail();
    const user = userEvent.setup();
    await user.type(textarea, '첫 줄');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(textarea).toHaveValue('첫 줄\n');
    fireEvent.change(textarea, { target: { value: '한글' } });
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(textarea, { key: 'Enter', keyCode: 229 });
    expect(api.createComment).not.toHaveBeenCalled();
    expect(textarea).toHaveValue('한글');
  });

  it('guards empty and synchronous duplicate submissions while in flight', async () => {
    let finish!: (comment: CommentRecord) => void;
    api.createComment.mockReturnValue(new Promise<CommentRecord>((resolve) => { finish = resolve; }));
    const textarea = await detail();
    const form = textarea.closest('form')!;
    fireEvent.submit(form);
    expect(api.createComment).not.toHaveBeenCalled();
    fireEvent.change(textarea, { target: { value: '  새 댓글  ' } });
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(api.createComment).toHaveBeenCalledTimes(1);
    expect(within(form).getByRole('button', { name: '댓글 전송' })).toBeDisabled();
    await act(async () => finish({ ...comment, commentId: 'created', content: '새 댓글' }));
    expect(textarea).toHaveValue('');
  });

  it('has a sibling native overlay, not an interactive article or nested controls', async () => {
    const open = vi.fn();
    const view = render(<Post post={post} onOpenDetail={open} />);
    const article = view.container.querySelector('article')!;
    expect(article).not.toHaveAttribute('role');
    expect(article).not.toHaveAttribute('tabindex');
    const overlay = screen.getByRole('button', { name: '작성자님의 게시물 열기' });
    expect(overlay.querySelector('a, button, input, video')).toBeNull();
    const user = userEvent.setup();
    overlay.focus();
    await user.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('does not erase the next draft when the previous submission succeeds', async () => {
    let finish!: (comment: CommentRecord) => void;
    api.createComment.mockReturnValue(new Promise<CommentRecord>((resolve) => { finish = resolve; }));
    const textarea = await detail();
    fireEvent.change(textarea, { target: { value: '첫 댓글' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.change(textarea, { target: { value: '다음 댓글 초안' } });
    await act(async () => finish({ ...comment, commentId: 'created', content: '첫 댓글' }));
    expect(textarea).toHaveValue('다음 댓글 초안');
    expect(api.createComment).toHaveBeenCalledTimes(1);
  });

  it('opens body clicks but ignores links, other actions and selected text', () => {
    const open = vi.fn(), like = vi.fn(), comments = vi.fn();
    const view = render(<Post post={post} onOpenDetail={open} onToggleLike={like} onOpenComments={comments} />);
    const body = view.container.querySelector('article p')!;
    fireEvent.click(body);
    expect(open).toHaveBeenCalledTimes(1);
    open.mockClear();
    const mention = screen.getByRole('link', { name: '@alpha' });
    mention.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(mention);
    fireEvent.click(screen.getByRole('button', { name: '좋아요 2개' }));
    fireEvent.click(screen.getByRole('button', { name: '댓글 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '게시물 메뉴' }));
    expect(open).not.toHaveBeenCalled();
    expect(like).toHaveBeenCalledWith(post);
    expect(comments).toHaveBeenCalledWith(post);
    const range = document.createRange();
    range.selectNodeContents(body);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    fireEvent.click(body);
    expect(open).not.toHaveBeenCalled();
    window.getSelection()!.removeAllRanges();
  });

  it('does not render an overlay without a detail callback and preserves comments fallback', () => {
    const comments = vi.fn();
    const view = render(<Post post={post} onOpenComments={comments} />);
    expect(screen.queryByRole('button', { name: '작성자님의 게시물 열기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '댓글 보기' }));
    expect(comments).toHaveBeenCalledWith(post);
    const open = vi.fn();
    view.rerender(<Post post={post} onOpenDetail={open} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 보기' }));
    expect(open).toHaveBeenCalledWith(post);
  });

  it('keeps a video control outside the overlay', () => {
    const open = vi.fn();
    const view = render(<Post post={{ ...post, media: [{
      mediaId: 'v1', mediaType: 'VIDEO', mediaUrl: '/test.webm', thumbnailUrl: null, sortOrder: 0,
    }] }} onOpenDetail={open} />);
    const video = view.container.querySelector('video')!;
    fireEvent.click(video);
    expect(open).not.toHaveBeenCalled();
    expect(video.parentElement).toHaveClass('pointer-events-auto');
    expect(video.closest('button')).toBeNull();
  });
});
