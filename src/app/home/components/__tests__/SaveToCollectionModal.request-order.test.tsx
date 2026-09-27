import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkCollection } from '@/types/bookmark';

const mocks = vi.hoisted(() => ({
  addBookmarkToCollection: vi.fn(),
  createCollection: vi.fn(),
  fetchCollectionsForPost: vi.fn(),
  removeBookmarkFromCollection: vi.fn(),
}));

vi.mock('@/app/context/BookmarkCollectionContext', () => ({
  useBookmarkCollections: () => mocks,
}));

import SaveToCollectionModal from '../SaveToCollectionModal';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function collection(name: string, containsPost: boolean): BookmarkCollection {
  return {
    collectionId: name,
    name,
    coverImageUrl: null,
    bookmarkCount: containsPost ? 1 : 0,
    containsPost,
    createdAt: '2026-09-24T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  };
}

const baseProps = {
  postId: 'post-1',
  isBookmarked: true,
  onClose: vi.fn(),
};

describe('SaveToCollectionModal collection request ordering', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
  });

  it('ignores a previous response when the same post is reopened', async () => {
    const firstRequest = deferred<BookmarkCollection[]>();
    const secondRequest = deferred<BookmarkCollection[]>();
    mocks.fetchCollectionsForPost
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { rerender } = render(
      <SaveToCollectionModal {...baseProps} isOpen />,
    );
    expect(await screen.findByText('모음집을 불러오는 중...')).toBeInTheDocument();

    rerender(<SaveToCollectionModal {...baseProps} isOpen={false} />);
    rerender(<SaveToCollectionModal {...baseProps} isOpen />);

    await waitFor(() => {
      expect(mocks.fetchCollectionsForPost).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      firstRequest.resolve([collection('stale collection', true)]);
    });

    expect(screen.getByText('모음집을 불러오는 중...')).toBeInTheDocument();
    expect(screen.queryByText('stale collection')).not.toBeInTheDocument();

    await act(async () => {
      secondRequest.resolve([collection('latest collection', true)]);
    });

    const latestCheckbox = await screen.findByRole('checkbox', {
      name: 'latest collection',
    });
    expect(latestCheckbox).toBeChecked();
    expect(screen.queryByText('모음집을 불러오는 중...')).not.toBeInTheDocument();
  });

  it('ignores a previous request error while the reopened request is loading', async () => {
    const firstRequest = deferred<BookmarkCollection[]>();
    const secondRequest = deferred<BookmarkCollection[]>();
    mocks.fetchCollectionsForPost
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const { rerender } = render(
      <SaveToCollectionModal {...baseProps} isOpen />,
    );
    await screen.findByText('모음집을 불러오는 중...');

    rerender(<SaveToCollectionModal {...baseProps} isOpen={false} />);
    rerender(<SaveToCollectionModal {...baseProps} isOpen />);

    await waitFor(() => {
      expect(mocks.fetchCollectionsForPost).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      firstRequest.reject(new Error('stale request failed'));
    });

    expect(screen.getByText('모음집을 불러오는 중...')).toBeInTheDocument();
    expect(screen.queryByText('stale request failed')).not.toBeInTheDocument();

    await act(async () => {
      secondRequest.resolve([collection('latest collection', false)]);
    });

    expect(
      await screen.findByRole('checkbox', { name: 'latest collection' }),
    ).not.toBeChecked();
  });
});
