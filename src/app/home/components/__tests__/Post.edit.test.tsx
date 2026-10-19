import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';
import { ApiError } from '@/lib/api-client';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({
  updatePostContent: vi.fn(), fetchPostDetail: vi.fn(), fetchPostComments: vi.fn(),
}));
const auth = vi.hoisted(() => ({ user: { handle: 'author', membershipBadge: true } as { handle: string; membershipBadge: boolean } }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/lib/feed-api', async (original) => ({
  ...(await original<typeof import('@/lib/feed-api')>()), ...api,
}));
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));

import { Post } from '../Post';
import { PostDetail } from '../PostDetail';
import { canEditPost } from '../EditPostModal';

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
const basePost: PostRecord = {
  postId: 'post-1', author: '작성자', authorHandle: 'author',
  authorProfileImageUrl: null, authorVerifiedBadge: false,
  content: '처음 본문', media: [], likes: 0, comments: 0, shares: 0,
  isReposted: false, repostCount: 0, likedByMe: false, bookmarkedByMe: false,
  mine: true, createdAt: '2026-10-01T00:00:00Z', editableUntil: inMinutes(42), editCount: 0,
};

function openEditor() {
  fireEvent.click(screen.getByRole('button', { name: '게시물 메뉴' }));
  fireEvent.click(screen.getByRole('button', { name: '수정' }));
  return screen.getByRole('dialog', { name: '게시물 수정' });
}

beforeEach(() => {
  vi.resetAllMocks();
  auth.user = { handle: 'author', membershipBadge: true };
  api.fetchPostComments.mockResolvedValue([]);
});

describe('canEditPost', () => {
  it('본인·미수정·마감 전일 때만 true', () => {
    expect(canEditPost(basePost)).toBe(true);
    expect(canEditPost({ ...basePost, mine: false })).toBe(false);
    expect(canEditPost({ ...basePost, editCount: 1 })).toBe(false);
    expect(canEditPost({ ...basePost, editableUntil: inMinutes(-1) })).toBe(false);
    // 수정 정보가 없는 응답(타인·구버전 백엔드)은 숨긴다.
    expect(canEditPost({ ...basePost, editableUntil: undefined, editCount: undefined })).toBe(false);
  });
});

describe('게시물 카드 수정', () => {
  it('남은 시간·글자 수를 보여주고 본문이 같으면 저장을 막는다', () => {
    render(<Post post={basePost} />);
    const dialog = openEditor();

    expect(within(dialog).getByText('남은 시간 42분')).toBeInTheDocument();
    expect(within(dialog).getByText('5/1000')).toBeInTheDocument();
    expect(within(dialog).getByText('이미지·영상은 수정할 수 없어요. 게시물당 1회만 수정됩니다.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '수정하기' })).toBeDisabled();
  });

  it('저장하면 본문을 바꾸고 메뉴에서 수정을 숨긴다', async () => {
    api.updatePostContent.mockResolvedValue({ ...basePost, content: '고친 본문', editCount: 1 });
    render(<Post post={basePost} />);
    const dialog = openEditor();

    fireEvent.change(within(dialog).getByRole('textbox', { name: '게시물 본문' }), { target: { value: '고친 본문' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '수정하기' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '게시물 수정' })).not.toBeInTheDocument());
    expect(screen.getByText('고친 본문')).toBeInTheDocument();
    expect(api.updatePostContent).toHaveBeenCalledWith('post-1', '고친 본문');
    fireEvent.click(screen.getByRole('button', { name: '게시물 메뉴' }));
    expect(screen.queryByRole('button', { name: '수정' })).not.toBeInTheDocument();
  });

  it('서버 거부는 모달 안에 한국어로 보여주고 다시 시도할 수 있다', async () => {
    api.updatePostContent.mockRejectedValueOnce(new ApiError('Post can only be edited once.', 409));
    render(<Post post={basePost} />);
    const dialog = openEditor();

    fireEvent.change(within(dialog).getByRole('textbox', { name: '게시물 본문' }), { target: { value: '고친 본문' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '수정하기' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('수정 가능 시간이 지났거나 이미 수정한 게시물이에요.');
    expect(within(dialog).getByRole('button', { name: '수정하기' })).toBeEnabled();
  });

  it('마감이 지나면 저장을 막고 안내를 바꾼다', () => {
    vi.useFakeTimers();
    try {
      render(<Post post={{ ...basePost, editableUntil: inMinutes(0.5) }} />);
      const dialog = openEditor();
      fireEvent.change(within(dialog).getByRole('textbox', { name: '게시물 본문' }), { target: { value: '고친 본문' } });
      act(() => { vi.advanceTimersByTime(31_000); });
      expect(within(dialog).getByText('수정 가능 시간이 지났어요')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: '수정하기' })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('멤버십이 아니면 혜택 안내 확인창을 띄우고 편집기를 열지 않는다', async () => {
    auth.user = { handle: 'author', membershipBadge: false };
    render(<Post post={basePost} />);
    fireEvent.click(screen.getByRole('button', { name: '게시물 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '수정' }));

    const confirm = await screen.findByRole('dialog', { name: '작업 확인' });
    expect(confirm).toHaveTextContent('게시물 수정은 멤버십 혜택이에요.');
    expect(within(confirm).getByRole('button', { name: '멤버십 보기' })).toBeInTheDocument();
    fireEvent.click(within(confirm).getByRole('button', { name: '취소' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('게시물 상세 수정', () => {
  it('저장하면 상세 본문을 바꾸고 부모에 갱신을 알린다', async () => {
    api.fetchPostDetail.mockResolvedValue(basePost);
    api.updatePostContent.mockResolvedValue({ ...basePost, content: '상세에서 고침', editCount: 1 });
    const onPostUpdated = vi.fn();
    render(<PostDetail postId="post-1" onBack={vi.fn()} onPostUpdated={onPostUpdated} />);
    await screen.findByText('처음 본문');

    const dialog = openEditor();
    fireEvent.change(within(dialog).getByRole('textbox', { name: '게시물 본문' }), { target: { value: '상세에서 고침' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '수정하기' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '게시물 수정' })).not.toBeInTheDocument());
    expect(screen.getByText('상세에서 고침')).toBeInTheDocument();
    expect(onPostUpdated).toHaveBeenLastCalledWith(expect.objectContaining({ content: '상세에서 고침', editCount: 1 }));
  });
});
