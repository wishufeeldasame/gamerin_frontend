import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchHashtagPosts: vi.fn() }));
vi.mock('@/lib/community-search-api', () => ({ fetchHashtagPosts: mocks.fetchHashtagPosts }));

import { RelatedHashtagPosts, firstHashtag } from '../RelatedHashtagPosts';

const post = (postId: string, content: string) => ({ postId, author: '작성자', content, createdAt: '2026-11-03T00:00:00Z' });

describe('RelatedHashtagPosts', () => {
  it('본문의 첫 해시태그를 고른다', () => {
    expect(firstHashtag('오늘 연습 #에임연습 #CS2')).toBe('에임연습');
    expect(firstHashtag('태그 없음')).toBeNull();
    expect(firstHashtag(null)).toBeNull();
  });

  it('현재 게시글은 빼고 같은 태그 글을 보여 준다', async () => {
    mocks.fetchHashtagPosts.mockResolvedValue({ items: [post('current', '지금 글 #CS2'), post('other', '다른 글 #CS2')], nextCursor: null, hasNext: false });
    render(<RelatedHashtagPosts content="지금 글 #CS2" excludePostId="current" />);

    expect(await screen.findByText('다른 글 #CS2')).toBeInTheDocument();
    expect(screen.queryByText('지금 글 #CS2')).not.toBeInTheDocument();
    expect(mocks.fetchHashtagPosts).toHaveBeenCalledWith('CS2', null, 5, expect.anything());
  });

  it('해시태그가 없으면 요청하지 않고 아무것도 그리지 않는다', () => {
    mocks.fetchHashtagPosts.mockClear();
    const { container } = render(<RelatedHashtagPosts content="태그 없음" excludePostId="x" />);
    expect(container).toBeEmptyDOMElement();
    expect(mocks.fetchHashtagPosts).not.toHaveBeenCalled();
  });
});
