import { describe, expect, it, vi } from 'vitest';
import { createComment, fetchPostComments, fetchPostDetailByNumber, fetchUserRecommendations, getPostHref, normalizePostRecord, recordPostViews, type PostRecord } from '@/lib/feed-api';

const apiRequest = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api-client')>()),
  apiRequest,
}));

vi.mock('@/lib/api-base', () => ({
  getApiBaseUrl: () => 'http://api.test',
}));

describe('feed-api 이미지 주소', () => {
  it('추천 친구는 인증 전용 배열 응답을 받고 이미지 주소를 정규화한다', async () => {
    const users = [
      { userId: 'a', profileImageUrl: '/uploads/profile.png', mutualCount: 2, winRate: 58.5 },
      { userId: 'b', profileImageUrl: null, representativeTier: null, winRate: null },
    ];
    apiRequest.mockResolvedValueOnce(users);
    const controller = new AbortController();
    await expect(fetchUserRecommendations({ signal: controller.signal })).resolves.toEqual([
      { ...users[0], profileImageUrl: 'http://api.test/uploads/profile.png' },
      users[1],
    ]);
    expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/users/me/recommendations?limit=5',
      expect.objectContaining({ auth: 'required' }), { signal: controller.signal });
  });

  it('추천 후보가 없으면 빈 배열을 반환한다', async () => {
    apiRequest.mockResolvedValueOnce([]);
    await expect(fetchUserRecommendations()).resolves.toEqual([]);
  });

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

  it('댓글 작성자 프로필 이미지도 API 주소로 바꾼다', async () => {
    apiRequest.mockResolvedValueOnce([{ commentId: 'c-1', authorProfileImageUrl: '/uploads/profile-images/a.png' }]);
    expect((await fetchPostComments('p-1'))[0].authorProfileImageUrl).toBe('http://api.test/uploads/profile-images/a.png');

    apiRequest.mockResolvedValueOnce({ commentId: 'c-2', authorProfileImageUrl: null });
    expect((await createComment('p-1', '내용')).authorProfileImageUrl).toBeNull();
  });
});

describe('조회수', () => {
  it.each([
    [0, 0],
    [12_345, 12_345],
    [undefined, null],
    [null, null],
    ['12', null],
    [-1, null],
    [1.5, null],
    [Number.NaN, null],
  ])('viewCount %s → %s', (viewCount, expected) => {
    expect(normalizePostRecord({ viewCount } as unknown as PostRecord).viewCount).toBe(expected);
  });

  it('노출한 게시물 ID를 POST /posts/views로 보낸다', async () => {
    apiRequest.mockResolvedValueOnce({ counted: 2 });
    await expect(recordPostViews(['a', 'b'], { keepalive: true })).resolves.toEqual({ counted: 2 });
    expect(apiRequest).toHaveBeenLastCalledWith('/api/v1/posts/views', expect.anything(), {
      keepalive: true,
      method: 'POST',
      body: JSON.stringify({ postIds: ['a', 'b'] }),
    });
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
