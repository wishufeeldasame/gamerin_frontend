import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { render } from '@/test/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';
import { LOGIN_PROMPT_EVENT } from '@/lib/login-prompt';
import { setAccessToken } from '@/lib/auth-store';

const auth = vi.hoisted(() => ({ user: null as { id: string; nickname: string; handle: string } | null, isAuthReady: true }));
const api = vi.hoisted(() => ({ fetchPostDetailByNumber: vi.fn(), fetchPostComments: vi.fn(), likePost: vi.fn(), unlikePost: vi.fn(), repostPost: vi.fn(), sharePost: vi.fn(), createComment: vi.fn() }));
const messageApi = vi.hoisted(() => ({ searchMessageRecipients: vi.fn(), sharePostMessage: vi.fn() }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/feed-api', async (original) => ({ ...await original<typeof import('@/lib/feed-api')>(), ...api }));
vi.mock('@/lib/message-api', () => messageApi);
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));

import { Post } from '../Post';
import { PostDetail } from '../PostDetail';
import { PostComposer } from '../PostComposer';
import { SharePostModal } from '../SharePostModal';
import { usePostLike } from '@/hooks/usePostLike';

const post: PostRecord = { postId: 'post-1', postNumber: 7, author: '작성자', authorHandle: 'author', authorProfileImageUrl: null, authorVerifiedBadge: false, content: '공개 게시물', media: [], likes: 2, comments: 1, shares: 0, isReposted: false, repostCount: 3, likedByMe: false, bookmarkedByMe: false, mine: false, createdAt: '2026-11-08T00:00:00Z' };

beforeEach(() => {
  vi.clearAllMocks(); auth.user = null;
  api.fetchPostDetailByNumber.mockResolvedValue(post); api.fetchPostComments.mockResolvedValue([]);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('게스트 조회와 회원 행동 경계', () => {
  it('좋아요 훅은 낙관적 변경과 API보다 먼저 로그인 요청을 보낸다', () => {
    const apply = vi.fn(); const prompt = vi.fn(); window.addEventListener(LOGIN_PROMPT_EVENT, prompt);
    function Harness() { const { toggleLike } = usePostLike(apply); return <button onClick={() => void toggleLike(post)}>반응</button>; }
    try {
      render(<Harness />); fireEvent.click(screen.getByRole('button', { name: '반응' }));
      expect(prompt).toHaveBeenCalledOnce(); expect(apply).not.toHaveBeenCalled(); expect(api.likePost).not.toHaveBeenCalled();
    } finally { window.removeEventListener(LOGIN_PROMPT_EVENT, prompt); }
  });

  it('카드의 좋아요·리포스트·북마크·신고를 모달 요청으로 막는다', () => {
    const like = vi.fn(); const prompt = vi.fn(); window.addEventListener(LOGIN_PROMPT_EVENT, prompt);
    try {
      render(<Post post={post} onToggleLike={like} />);
      fireEvent.click(screen.getByRole('button', { name: '좋아요 2개' }));
      fireEvent.click(screen.getByRole('button', { name: '리포스트' }));
      fireEvent.click(screen.getByRole('button', { name: '북마크 저장' }));
      fireEvent.click(screen.getByRole('button', { name: '게시글 메뉴' }));
      fireEvent.click(screen.getByRole('button', { name: '게시글 신고' }));
      expect(prompt).toHaveBeenCalledTimes(4); expect(like).not.toHaveBeenCalled(); expect(api.repostPost).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: '리포스트' })).toHaveAttribute('aria-pressed', 'false');
    } finally { window.removeEventListener(LOGIN_PROMPT_EVENT, prompt); }
  });

  it('게스트 작성창에는 편집·첨부 입력을 만들지 않는다', () => {
    const submit = vi.fn();
    const view = render(<PostComposer onSubmit={submit} />);
    expect(screen.queryByRole('textbox', { name: '게시글 내용' })).not.toBeInTheDocument();
    expect(view.container.querySelector('input[type="file"]')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /로그인 후 게시글을 작성/ })); expect(submit).not.toHaveBeenCalled();
  });

  it('상세·댓글 조회는 유지하고 댓글 입력·전송을 막는다', async () => {
    render(<PostDetail postNumber={7} onBack={vi.fn()} />);
    expect(await screen.findByText('공개 게시물')).toBeInTheDocument();
    await waitFor(() => expect(api.fetchPostComments).toHaveBeenCalledWith('post-1', expect.anything()));
    expect(screen.queryByRole('textbox', { name: '댓글 입력' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '로그인하고 댓글 남기기' })); expect(api.createComment).not.toHaveBeenCalled();
  });

  it('댓글만 실패해도 게시물 본문을 표시한다', async () => {
    api.fetchPostComments.mockRejectedValueOnce(new Error('temporary comments failure'));
    render(<PostDetail postNumber={7} onBack={vi.fn()} />);
    expect(await screen.findByText('공개 게시물')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('댓글을 불러오지 못했습니다.');
  });

  it('게스트 링크 복사는 DM 조회·공유 집계·DM 전송을 호출하지 않는다', async () => {
    render(<SharePostModal post={post} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    await screen.findByRole('button', { name: '복사 완료' });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringMatching(/\/posts\/7$/));
    expect(messageApi.searchMessageRecipients).not.toHaveBeenCalled(); expect(api.sharePost).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '메시지로 보내기' })); expect(messageApi.sharePostMessage).not.toHaveBeenCalled();
  });

  it('클립보드 실패는 성공으로 표시하지 않고 직접 복사 방법을 안내한다', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('permission denied'));
    render(<SharePostModal post={post} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('주소를 선택해서 직접 복사');
    expect(screen.queryByRole('button', { name: '복사 완료' })).not.toBeInTheDocument(); expect(api.sharePost).not.toHaveBeenCalled();
  });

  it('회원은 복사 권한 거부에도 공유를 기록하고 수신자 검색 후에도 복사 오류를 유지한다', async () => {
    auth.user = { id: 'member', nickname: 'member', handle: 'member' };
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('permission denied'));
    api.sharePost.mockResolvedValueOnce({ shares: 3 });
    messageApi.searchMessageRecipients.mockResolvedValueOnce([]);
    const onShared = vi.fn();
    render(<SharePostModal post={post} onClose={vi.fn()} onShared={onShared} />);
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    await waitFor(() => expect(onShared).toHaveBeenCalledWith({ postId: post.postId, shares: 3 }));
    await waitFor(() => expect(messageApi.searchMessageRecipients).toHaveBeenCalled());
    expect(screen.getByRole('alert')).toHaveTextContent('주소를 선택해서 직접 복사');
    expect(screen.queryByRole('button', { name: '복사 완료' })).not.toBeInTheDocument();
  });

  it('복사 대기 중 계정이 바뀌면 새 계정으로 공유 수를 쓰지 않는다', async () => {
    auth.user = { id: 'member', nickname: 'member', handle: 'member' };
    setAccessToken('member-token');
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    vi.mocked(navigator.clipboard.writeText).mockReturnValueOnce(pending);
    messageApi.searchMessageRecipients.mockResolvedValue([]);
    render(<SharePostModal post={post} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '링크 복사' }));
    setAccessToken('other-member-token');
    await act(async () => { finish(); await pending; });
    expect(api.sharePost).not.toHaveBeenCalled();
  });
});
