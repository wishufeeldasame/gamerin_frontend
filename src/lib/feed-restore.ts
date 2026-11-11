import type { CursorPage } from '@/types/api';

// 피드에서 게시물 상세로 갔다가 뒤로 돌아올 때만 목록과 열었던 게시물 위치를 되살린다. 메모리에만 둔다.
export interface FeedSnapshot<T> extends CursorPage<T> {
  key: string;
  postId: string;
  // 열 때 게시물 카드 위쪽이 화면에서 떨어져 있던 거리(px).
  top: number;
}

let snapshot: FeedSnapshot<unknown> | null = null;
let poppedSinceSave = false;

if (typeof window !== 'undefined') {
  // 피드에 도착하는 뒤로·앞으로 이동만 복원 대상이다. 다른 화면으로 돌아간 뒤 링크로 들어온 피드는 새로 받는다.
  window.addEventListener('popstate', () => {
    poppedSinceSave = window.location.pathname === '/';
  });
}

export function saveFeedSnapshot<T>(next: FeedSnapshot<T>) {
  snapshot = next;
  poppedSinceSave = false;
}

// 뒤로·앞으로 이동으로 돌아온 경우에만 돌려준다. 링크로 새로 들어온 피드는 처음부터 받는다.
export function peekFeedSnapshot<T>(key: string) {
  return poppedSinceSave && snapshot?.key === key ? (snapshot as FeedSnapshot<T>) : null;
}

export function clearFeedSnapshot() {
  snapshot = null;
}
