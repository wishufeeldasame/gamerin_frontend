import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  query: 'target=comments&commentId=%20comment-2%20',
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ postId: 'post-1' }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock('@/app/home/components/PostDetail', () => ({
  PostDetail: ({
    postId,
    initialCommentId,
    initialScrollTarget,
  }: {
    postId: string;
    initialCommentId?: string;
    initialScrollTarget?: 'comments';
  }) => (
    <div
      data-testid="post-detail"
      data-post-id={postId}
      data-comment-id={initialCommentId}
      data-scroll-target={initialScrollTarget}
    />
  ),
}));

vi.mock('@/app/home/components/RightSidebar', () => ({
  RightSidebar: () => null,
}));

import PostPermalinkPage from '../page';

describe('PostPermalinkPage comment deep link', () => {
  it('passes commentId and the existing comments target to PostDetail', () => {
    render(<PostPermalinkPage />);

    const postDetail = screen.getByTestId('post-detail');
    expect(postDetail).toHaveAttribute('data-post-id', 'post-1');
    expect(postDetail).toHaveAttribute('data-comment-id', 'comment-2');
    expect(postDetail).toHaveAttribute('data-scroll-target', 'comments');
  });
});
