import { describe, expect, it, vi } from 'vitest';
import { fetchMyBookmarkCount, normalizePostRecord, type PostRecord } from '@/lib/feed-api';
import { clearStoredAuth, setAccessToken } from '@/lib/auth-store';
import { installFetchRoutes, json } from '@/test/fetch-routes';

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

describe('fetchMyBookmarkCount', () => {
  it('숫자 0은 개수로 반환하고 객체 형태의 응답은 거부한다', async () => {
    const api = installFetchRoutes();
    const path = '/api/v1/users/me/bookmarks/count';
    api.route(path, () => json(200, { success: true, data: 0 }), () =>
      json(200, { success: true, data: { count: 25 } }),
    );
    setAccessToken('test-token');

    try {
      await expect(fetchMyBookmarkCount()).resolves.toBe(0);
      await expect(fetchMyBookmarkCount()).rejects.toThrow('전체 북마크 개수 응답이 올바르지 않습니다.');
    } finally {
      clearStoredAuth();
    }
  });
});
