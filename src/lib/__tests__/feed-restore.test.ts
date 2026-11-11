import { describe, expect, it } from 'vitest';
import { clearFeedSnapshot, peekFeedSnapshot, saveFeedSnapshot } from '@/lib/feed-restore';

const snapshot = { key: 'all:guest', items: [1], nextCursor: null, hasNext: false, postId: 'p1', top: 120 };

describe('feed-restore', () => {
  it('뒤로가기로 돌아온 같은 피드에만 스냅샷을 돌려준다', () => {
    saveFeedSnapshot(snapshot);
    expect(peekFeedSnapshot('all:guest')).toBeNull();

    // 피드가 아닌 화면으로 돌아간 뒤에는 복원하지 않는다.
    window.history.replaceState(null, '', '/posts/1');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(peekFeedSnapshot('all:guest')).toBeNull();

    window.history.replaceState(null, '', '/');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(peekFeedSnapshot('following:u1')).toBeNull();
    expect(peekFeedSnapshot('all:guest')).toEqual(snapshot);

    clearFeedSnapshot();
    expect(peekFeedSnapshot('all:guest')).toBeNull();
  });
});
