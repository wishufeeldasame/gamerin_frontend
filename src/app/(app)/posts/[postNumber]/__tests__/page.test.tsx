import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({
  postNumber: '1',
  query: 'target=comments&commentId=%20comment-2%20',
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ postNumber: navigation.postNumber }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock('@/app/home/components/PostDetail', () => ({
  PostDetailHeader: () => <button type="button">뒤로 가기</button>,
  PostDetail: ({
    postNumber,
    initialCommentId,
    initialScrollTarget,
  }: {
    postNumber: number;
    initialCommentId?: string;
    initialScrollTarget?: 'comments';
  }) => (
    <div
      data-testid="post-detail"
      data-post-number={postNumber}
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
  beforeEach(() => { navigation.postNumber = '1'; });

  it('passes commentId and the existing comments target to PostDetail', () => {
    render(<PostPermalinkPage />);

    const postDetail = screen.getByTestId('post-detail');
    expect(postDetail).toHaveAttribute('data-post-number', '1');
    expect(postDetail).toHaveAttribute('data-comment-id', 'comment-2');
    expect(postDetail).toHaveAttribute('data-scroll-target', 'comments');
  });

  it('URL의 숫자를 PostDetail에 숫자로 넘긴다', () => {
    navigation.postNumber = '42';
    render(<PostPermalinkPage />);

    expect(screen.getByTestId('post-detail')).toHaveAttribute('data-post-number', '42');
  });

  it.each(['abc', '0', '-1', '1.5', '8bbd131f-563d-42a0'])('숫자가 아닌 경로(%s)는 상세를 조회하지 않는다', (value) => {
    navigation.postNumber = value;
    render(<PostPermalinkPage />);

    expect(screen.queryByTestId('post-detail')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('게시글을 찾을 수 없습니다.');
    // 모바일 앱 상단 바가 숨겨진 화면이라 뒤로 헤더가 있어야 한다.
    expect(screen.getByRole('button', { name: '뒤로 가기' })).toBeInTheDocument();
  });
});
