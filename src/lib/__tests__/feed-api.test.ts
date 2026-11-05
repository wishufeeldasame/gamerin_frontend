import { describe, expect, it, vi } from 'vitest';
import { fetchMyBookmarkCount, fetchPostDetailByNumber, getPostHref, normalizePostRecord, type PostRecord } from '@/lib/feed-api';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiRequest,
}));

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

describe('feed-api 이미지 주소', () => {
  it('상대경로는 API 주소로 바꾸고 빈 값은 null, 원본 media URL은 정규화할 수 없을 때 그대로 둔다', () => {
    const post = normalizePostRecord({
      authorProfileImageUrl: 'uploads/p.png',
      media: [
        { mediaId: 'm-1', mediaType: 'IMAGE', mediaUrl: '/uploads/a.png', thumbnailUrl: '  ', sortOrder: 0 },
        { mediaId: 'm-2', mediaType: 'VIDEO', mediaUrl: '', thumbnailUrl: 'https://cdn.test/t.png', sortOrder: 1 },
      ],
    } as unknown as PostRecord);

    expect(post.authorProfileImageUrl).toBe('http://api.test/uploads/p.png');
    expect(post.media).toMatchObject([
      { mediaUrl: 'http://api.test/uploads/a.png', thumbnailUrl: null },
      { mediaUrl: '', thumbnailUrl: 'https://cdn.test/t.png' },
    ]);
  });
});

describe('게시글 숫자 URL', () => {
  it('getPostHref는 postNumber로 /posts/{n} 링크를 만든다', () => {
    expect(getPostHref(7)).toBe('/posts/7');
    expect(getPostHref(7, '?target=comments')).toBe('/posts/7?target=comments');
  });

  it('fetchPostDetailByNumber는 by-number 엔드포인트를 호출한다', async () => {
    apiRequest.mockResolvedValue({ postId: 'uuid-1', postNumber: 7, media: [] });
    const post = await fetchPostDetailByNumber(7);

    expect(apiRequest.mock.calls[0][0]).toBe('/api/v1/posts/by-number/7');
    expect(post).toMatchObject({ postId: 'uuid-1', postNumber: 7 });
  });
});

describe('fetchMyBookmarkCount', () => {
  it('숫자 0은 개수로 반환하고 객체 형태의 응답은 거부한다', async () => {
    apiRequest.mockResolvedValueOnce(0).mockResolvedValueOnce({ count: 25 });

    await expect(fetchMyBookmarkCount()).resolves.toBe(0);
    await expect(fetchMyBookmarkCount()).rejects.toThrow('전체 북마크 개수 응답이 올바르지 않습니다.');
  });
});
