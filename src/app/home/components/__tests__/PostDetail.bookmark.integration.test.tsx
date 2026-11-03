import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { render } from '@/test/feedback';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostRecord } from '@/lib/feed-api';
import type { BookmarkCollection } from '@/types/bookmark';

const api = vi.hoisted(() => ({
  addPostToBookmarkCollection: vi.fn(),
  fetchBookmarkCollections: vi.fn(),
  fetchMyBookmarks: vi.fn(),
  fetchPostComments: vi.fn(),
  fetchPostDetail: vi.fn(),
  unbookmarkPost: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1', handle: 'viewer' }, isAuthReady: true }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/lib/feed-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/feed-api')>()),
  addPostToBookmarkCollection: api.addPostToBookmarkCollection,
  fetchBookmarkCollections: api.fetchBookmarkCollections,
  fetchMyBookmarks: api.fetchMyBookmarks,
  fetchPostComments: api.fetchPostComments,
  fetchPostDetail: api.fetchPostDetail,
  unbookmarkPost: api.unbookmarkPost,
}));
// The list card is unrelated to the detail modal operation.
vi.mock('@/app/home/components/Post', () => ({
  Post: ({ post }: { post: PostRecord }) => <div data-testid={'list-post-' + post.postId} />,
}));

import {
  BookmarkCollectionProvider,
  useBookmarkCollections,
} from '@/app/context/BookmarkCollectionContext';
import BookmarksPage from '@/app/(app)/bookmarks/page';
import { PostDetail } from '../PostDetail';

const post: PostRecord = {
  postId: 'post-1',
  author: '작성자',
  authorHandle: 'author',
  authorProfileImageUrl: null,
  authorVerifiedBadge: false,
  game: null,
  content: '상세 북마크 테스트',
  media: [],
  likes: 0,
  comments: 0,
  shares: 0,
  isReposted: false,
  repostCount: 0,
  likedByMe: false,
  bookmarkedByMe: true,
  savedCollectionIds: ['collection-a'],
  mine: false,
  createdAt: '2026-09-17T00:00:00Z',
};

function collection(
  bookmarkCount: number,
  containsPost?: boolean,
  collectionId = 'collection-a',
): BookmarkCollection {
  return {
    collectionId,
    name: collectionId === 'collection-a' ? '모음집 A' : '모음집 B',
    coverImageUrl: null,
    bookmarkCount,
    containsPost,
    createdAt: '2026-09-17T00:00:00Z',
    updatedAt: '2026-09-17T00:00:00Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function ContextState() {
  const { loading, error } = useBookmarkCollections();
  return (
    <div>
      <output aria-label={'컬렉션 조회 상태'}>{loading ? '조회 중' : '대기'}</output>
      <output aria-label={'컬렉션 오류'}>{error ?? '없음'}</output>
    </div>
  );
}

function renderIntegratedScreens() {
  render(
    <BookmarkCollectionProvider>
      <ContextState />
      <PostDetail postId={'post-1'} onBack={vi.fn()} />
      <BookmarksPage />
    </BookmarkCollectionProvider>,
  );
}

function collectionButton(name = 'A') {
  return screen.getByRole('button', { name: new RegExp(`모음집 ${name}`) });
}

async function openCollectionModal() {
  await waitFor(() => {
    expect(within(collectionButton()).getByText('3개 게시물')).toBeInTheDocument();
  });
  fireEvent.click(await screen.findByRole('button', { name: '북마크 해제' }));
  await screen.findByRole('dialog');
  await screen.findByRole('checkbox', { name: '모음집 A' });
}

function globalCollectionReads() {
  return api.fetchBookmarkCollections.mock.calls.filter(([postId]) => !postId);
}

describe('PostDetail and /bookmarks collection synchronization', () => {
  beforeEach(() => {
    for (const mock of Object.values(api)) mock.mockReset();
    api.fetchPostDetail.mockResolvedValue(post);
    api.fetchPostComments.mockResolvedValue([]);
    api.fetchMyBookmarks.mockResolvedValue({ items: [post], nextCursor: null, hasNext: false });
    api.unbookmarkPost.mockResolvedValue(undefined);
  });

  it.each([
    ['전체 북마크 해제', 'all'],
    ['마지막 컬렉션 체크 해제', 'last'],
  ])('%s 후 재조회가 끝날 때까지 입력을 잠그고 실제 개수를 갱신한다', async (_name, action) => {
    const refresh = deferred<BookmarkCollection[]>();
    api.fetchBookmarkCollections
      .mockResolvedValueOnce([collection(3)])
      .mockResolvedValueOnce([collection(3, true)])
      .mockReturnValueOnce(refresh.promise);
    renderIntegratedScreens();
    await openCollectionModal();
    fireEvent.click(
      action === 'all'
        ? screen.getByRole('button', { name: '전체 북마크 해제' })
        : screen.getByRole('checkbox', { name: '모음집 A' }),
    );
    await waitFor(() => {
      expect(api.unbookmarkPost).toHaveBeenCalledOnce();
      expect(globalCollectionReads()).toHaveLength(2);
      expect(screen.getByRole('button', { name: '북마크 저장' })).toBeInTheDocument();
    });
    const collectionCheckbox = screen.getByRole('checkbox', { name: '모음집 A' });
    expect(collectionCheckbox).not.toBeChecked();
    expect(collectionCheckbox).toBeDisabled();

    fireEvent.click(collectionCheckbox);
    expect(api.addPostToBookmarkCollection).not.toHaveBeenCalled();

    await act(async () => {
      refresh.resolve([collection(2)]);
      await refresh.promise;
    });

    await waitFor(() => {
      expect(within(collectionButton()).getByText('2개 게시물')).toBeInTheDocument();
      expect(collectionCheckbox).toBeEnabled();
    });
    expect(globalCollectionReads()).toHaveLength(2);
  });

  it('전체 해제 재조회 후 한 컬렉션을 다시 추가해도 다른 컬렉션 개수를 유지한다', async () => {
    const refresh = deferred<BookmarkCollection[]>();
    api.fetchBookmarkCollections
      .mockResolvedValueOnce([
        collection(3),
        collection(5, undefined, 'collection-b'),
      ])
      .mockResolvedValueOnce([
        collection(3, true),
        collection(5, true, 'collection-b'),
      ])
      .mockReturnValueOnce(refresh.promise);
    api.addPostToBookmarkCollection.mockResolvedValue({
      postId: 'post-1',
      bookmarkedByMe: true,
      collectionIds: ['collection-a'],
      collection: collection(3),
    });
    renderIntegratedScreens();
    await openCollectionModal();
    fireEvent.click(screen.getByRole('button', { name: '전체 북마크 해제' }));
    await waitFor(() => {
      expect(globalCollectionReads()).toHaveLength(2);
      expect(screen.getByRole('checkbox', { name: '모음집 A' })).not.toBeChecked();
    });
    const collectionACheckbox = screen.getByRole('checkbox', { name: '모음집 A' });
    expect(collectionACheckbox).toBeDisabled();
    fireEvent.click(collectionACheckbox);
    expect(api.addPostToBookmarkCollection).not.toHaveBeenCalled();

    await act(async () => {
      refresh.resolve([
        collection(2),
        collection(4, undefined, 'collection-b'),
      ]);
      await refresh.promise;
    });

    await waitFor(() => {
      expect(within(collectionButton()).getByText('2개 게시물')).toBeInTheDocument();
      expect(within(collectionButton('B')).getByText('4개 게시물')).toBeInTheDocument();
      expect(collectionACheckbox).toBeEnabled();
    });

    fireEvent.click(collectionACheckbox);
    await waitFor(() => {
      expect(api.addPostToBookmarkCollection).toHaveBeenCalledWith('collection-a', 'post-1');
      expect(within(collectionButton()).getByText('3개 게시물')).toBeInTheDocument();
    });
    expect(within(collectionButton('B')).getByText('4개 게시물')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('컬렉션 조회 상태')).toHaveTextContent('대기');
    });
    expect(globalCollectionReads()).toHaveLength(2);
  });

  it('해제 후 재조회 GET이 실패해도 성공한 해제와 기존 목록을 유지한다', async () => {
    api.fetchBookmarkCollections
      .mockResolvedValueOnce([collection(3)])
      .mockResolvedValueOnce([collection(3, true)])
      .mockRejectedValueOnce(new Error('refresh failed'));
    renderIntegratedScreens();
    await openCollectionModal();
    fireEvent.click(screen.getByRole('button', { name: '전체 북마크 해제' }));
    await waitFor(() => {
      expect(api.unbookmarkPost).toHaveBeenCalledOnce();
      expect(screen.getByRole('button', { name: '북마크 저장' })).toBeInTheDocument();
      expect(screen.getByLabelText('컬렉션 오류')).toHaveTextContent('refresh failed');
      expect(screen.getByLabelText('컬렉션 조회 상태')).toHaveTextContent('대기');
      expect(screen.getByRole('checkbox', { name: '모음집 A' })).toBeEnabled();
    });
    expect(within(collectionButton()).getByText('3개 게시물')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(globalCollectionReads()).toHaveLength(2);
  });

  it('공통 Post 카드에서도 실제 모달 해제 후 /bookmarks 개수를 갱신한다', async () => {
    const { Post: ActualPost } = await vi.importActual<
      typeof import('@/app/home/components/Post')
    >('@/app/home/components/Post');
    api.fetchBookmarkCollections
      .mockResolvedValueOnce([collection(3)])
      .mockResolvedValueOnce([collection(3, true)])
      .mockResolvedValueOnce([collection(2)]);
    render(
      <BookmarkCollectionProvider>
        <ActualPost post={post} />
        <BookmarksPage />
      </BookmarkCollectionProvider>,
    );
    await openCollectionModal();
    fireEvent.click(screen.getByRole('button', { name: '전체 북마크 해제' }));
    await waitFor(() => {
      expect(api.unbookmarkPost).toHaveBeenCalledOnce();
      expect(within(collectionButton()).getByText('2개 게시물')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '북마크 저장' })).toBeInTheDocument();
    });
    expect(globalCollectionReads()).toHaveLength(2);
  });
});
