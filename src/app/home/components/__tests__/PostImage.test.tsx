import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/feedback';
import type { PostRecord } from '@/lib/feed-api';

const api = vi.hoisted(() => ({ fetchPostDetail: vi.fn(), fetchPostComments: vi.fn() }));
vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { handle: 'viewer' } }) }));
vi.mock('@/lib/feed-api', async (original) => ({
  ...(await original<typeof import('@/lib/feed-api')>()), ...api,
}));
vi.mock('../SaveToCollectionModal', () => ({ default: () => null }));
vi.mock('@/hooks/useRepost', () => ({
  useRepost: () => ({ isReposted: false, repostCount: 0, isLoading: false, error: null, toggleRepost: vi.fn() }),
}));

import { PostImage } from '../PostImage';
import { Post } from '../Post';
import { PostDetail } from '../PostDetail';

const post: PostRecord = {
  postId: 'post-1', author: '작성자', authorHandle: 'author', authorProfileImageUrl: null,
  authorVerifiedBadge: false, content: '이미지 테스트', game: null,
  media: [1, 2].map((number) => ({
    mediaId: `image-${number}`, mediaType: 'IMAGE', mediaUrl: `/image-${number}.png`, thumbnailUrl: null, sortOrder: number - 1,
  })),
  likes: 2, comments: 0, shares: 0, repostCount: 0, isReposted: false,
  likedByMe: false, bookmarkedByMe: false, mine: false, createdAt: '2026-10-09T00:00:00Z',
};

const standalone = <PostImage src="/image.png" imageNumber={1} width={1200} height={800} className="w-full" />;

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchPostDetail.mockResolvedValue(post);
  api.fetchPostComments.mockResolvedValue([]);
});

describe.each(['card', 'detail'] as const)('%s image preview', (kind) => {
  it('opens the selected image by keyboard independently and restores focus after Escape', async () => {
    const openDetail = vi.fn();
    const view = kind === 'card'
      ? render(<Post post={post} onOpenDetail={openDetail} />)
      : render(<PostDetail postId={post.postId} onBack={vi.fn()} />);
    const trigger = await screen.findByRole('button', { name: '게시물 이미지 2 확대 보기' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    trigger.focus();
    const user = userEvent.setup();
    await user.keyboard('{Enter}');
    const preview = screen.getByRole('dialog', { name: '게시물 이미지 2 확대' });
    expect(preview).toHaveAttribute('open');
    expect(view.container.querySelector('article dialog')).toBeNull();
    const imageSrc = within(preview).getByRole('img', { name: '확대된 게시물 이미지 2' }).getAttribute('src')!;
    expect(new URL(imageSrc, window.location.href).pathname).toBe('/image-2.png');
    const close = within(preview).getByRole('button', { name: '이미지 확대 닫기' });
    expect(close).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(openDetail).not.toHaveBeenCalled();
    expect(view.container.querySelector('button button, button a, a button')).toBeNull();
  });
});

describe('image preview lifecycle and failures', () => {
  it('keeps a single card image expandable even without a detail callback', () => {
    render(<Post post={{ ...post, media: post.media.slice(0, 1) }} />);
    expect(screen.queryByRole('button', { name: '작성자님의 게시물 열기' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' }));
    expect(screen.getByRole('dialog', { name: '게시물 이미지 1 확대' })).toHaveAttribute('open');
  });

  it('keeps the preview open when StrictMode replays modal effects', async () => {
    render(<StrictMode>{standalone}</StrictMode>);
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
      this.open = false;
      queueMicrotask(() => this.dispatchEvent(new Event('close')));
    });
    try {
      await userEvent.setup().click(screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' }));
      expect(screen.getByRole('dialog')).toHaveAttribute('open');
      expect(screen.getByRole('button', { name: '이미지 확대 닫기' })).toHaveFocus();
    } finally {
      close.mockRestore();
    }
  });

  it('supports Space, close button and backdrop dismissal without changing scroll state', async () => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    try {
      render(standalone);
      const trigger = screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' });
      trigger.focus();
      const user = userEvent.setup();
      await user.keyboard(' ');
      expect(document.body.style.overflow).toBe('hidden');
      await user.click(screen.getByRole('button', { name: '이미지 확대 닫기' }));
      expect(trigger).toHaveFocus();
      expect(document.body.style.overflow).toBe('auto');
      await user.click(trigger);
      fireEvent.click(screen.getByRole('dialog'));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(document.body.style.overflow).toBe('auto');
    } finally {
      document.body.style.overflow = previousOverflow;
    }
  });

  it('keeps a failed image closable and resets its failure when reopened', async () => {
    render(standalone);
    const trigger = screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' });
    fireEvent.click(trigger);
    fireEvent.error(screen.getByRole('img', { name: '확대된 게시물 이미지 1' }));
    expect(screen.getByRole('alert')).toHaveTextContent('이미지를 불러오지 못했습니다.');
    fireEvent.click(screen.getByRole('button', { name: '이미지 확대 닫기' }));
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    expect(screen.getByRole('img', { name: '확대된 게시물 이미지 1' })).toBeInTheDocument();
    expect(screen.queryByText('이미지를 불러오지 못했습니다.')).not.toBeInTheDocument();
  });

  it('fails closed with an accessible notice when native modal support fails', async () => {
    render(standalone);
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => { throw new Error('unsupported'); });
    try {
      const trigger = screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' });
      trigger.focus();
      fireEvent.click(trigger);
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(screen.getByRole('alert')).toHaveTextContent('이미지 확대를 열 수 없습니다.');
      expect(trigger).toHaveFocus();
    } finally {
      show.mockRestore();
    }
  });

  it('does not reopen the modal on unrelated parent updates', () => {
    const view = render(<Post post={post} />);
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    try {
      fireEvent.click(screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' }));
      const dialog = screen.getByRole('dialog');
      view.rerender(<Post post={{ ...post, likes: 3 }} />);
      expect(screen.getByRole('dialog')).toBe(dialog);
      expect(show).toHaveBeenCalledTimes(1);
    } finally {
      show.mockRestore();
    }
  });

  it('closes the old preview when the post identity changes and restores overflow', () => {
    const previousOverflow = document.body.style.overflow;
    const view = render(<Post post={post} />);
    fireEvent.click(screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' }));
    expect(document.body.style.overflow).toBe('hidden');
    view.rerender(<Post post={{ ...post, postId: 'post-2' }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it('cleans up an open preview on unmount and focuses a connected fallback', () => {
    const previousOverflow = document.body.style.overflow;
    const view = render(<main>{standalone}</main>);
    fireEvent.click(screen.getByRole('button', { name: '게시물 이미지 1 확대 보기' }));
    view.rerender(<main>다음 화면</main>);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe(previousOverflow);
    expect(screen.getByRole('main')).toHaveFocus();
  });
});
