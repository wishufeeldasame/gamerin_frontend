import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookmarkCollection } from '@/types/bookmark';

const mocks = vi.hoisted(() => ({
  addPostToBookmarkCollection: vi.fn(),
  createBookmarkCollection: vi.fn(),
  fetchBookmarkCollections: vi.fn(),
  removePostFromBookmarkCollection: vi.fn(),
}));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
    isAuthReady: true,
  }),
}));

vi.mock('@/lib/feed-api', () => ({
  addPostToBookmarkCollection: mocks.addPostToBookmarkCollection,
  createBookmarkCollection: mocks.createBookmarkCollection,
  fetchBookmarkCollections: mocks.fetchBookmarkCollections,
  removePostFromBookmarkCollection: mocks.removePostFromBookmarkCollection,
}));

import {
  BookmarkCollectionProvider,
  useBookmarkCollections,
} from '../BookmarkCollectionContext';

function collection(
  bookmarkCount: number,
  containsPost?: boolean,
  collectionId = 'collection-1',
): BookmarkCollection {
  return {
    collectionId,
    name: `Collection ${collectionId}`,
    coverImageUrl: null,
    bookmarkCount,
    containsPost,
    createdAt: '2026-09-24T00:00:00Z',
    updatedAt: '2026-09-24T00:00:00Z',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function ContextHarness() {
  const {
    collections,
    loading,
    error,
    refreshCollections,
    fetchCollectionsForPost,
    addBookmarkToCollection,
    removeBookmarkFromCollection,
  } = useBookmarkCollections();
  const [lookupResult, setLookupResult] = useState('none');

  const summarize = (items: BookmarkCollection[]) =>
    items
      .map(
        (item) =>
          `${item.collectionId}:${item.bookmarkCount}:${String(item.containsPost)}`,
      )
      .join(',');

  return (
    <div>
      <output aria-label="collection count">
        {collections[0]?.bookmarkCount ?? 0}
      </output>
      <output aria-label="loading state">
        {loading ? 'loading' : 'idle'}
      </output>
      <output aria-label="collections state">{summarize(collections)}</output>
      <output aria-label="error state">{error ?? 'none'}</output>
      <output aria-label="lookup result">{lookupResult}</output>
      <button type="button" onClick={() => void refreshCollections()}>
        refresh
      </button>
      <button
        type="button"
        onClick={() => {
          void fetchCollectionsForPost('post-1').then((items) => {
            setLookupResult(summarize(items));
          });
        }}
      >
        fetch for post
      </button>
      <button
        type="button"
        onClick={() => void addBookmarkToCollection('collection-1', 'post-1')}
      >
        add
      </button>
      <button
        type="button"
        onClick={() =>
          void removeBookmarkFromCollection('collection-1', 'post-1')
        }
      >
        remove
      </button>
    </div>
  );
}

function renderContext() {
  return render(
    <BookmarkCollectionProvider>
      <ContextHarness />
    </BookmarkCollectionProvider>,
  );
}

describe('BookmarkCollectionContext request ordering', () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }

    mocks.createBookmarkCollection.mockResolvedValue(collection(1));
    mocks.removePostFromBookmarkCollection.mockResolvedValue({
      postId: 'post-1',
      bookmarkedByMe: false,
      collectionIds: [],
      collection: collection(1),
    });
  });

  it('keeps a later successful mutation when an older refresh resolves afterward', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(2)]);
    mocks.addPostToBookmarkCollection.mockResolvedValue({
      postId: 'post-1',
      bookmarkedByMe: true,
      collectionIds: ['collection-1'],
      collection: collection(3),
    });

    renderContext();
    expect(await screen.findByLabelText('collection count')).toHaveTextContent('2');

    const staleRefresh = deferred<BookmarkCollection[]>();
    mocks.fetchBookmarkCollections.mockReturnValueOnce(staleRefresh.promise);
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => {
      expect(screen.getByLabelText('loading state')).toHaveTextContent('loading');
    });

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    });

    await act(async () => {
      staleRefresh.resolve([collection(2)]);
      await staleRefresh.promise;
    });

    expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    await waitFor(() => {
      expect(screen.getByLabelText('loading state')).toHaveTextContent('idle');
    });

    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(4)]);
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('4');
    });
  });

  it('does not let an older post-specific lookup overwrite a later mutation', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(2)]);
    mocks.addPostToBookmarkCollection.mockResolvedValue({
      postId: 'post-1',
      bookmarkedByMe: true,
      collectionIds: ['collection-1'],
      collection: collection(3),
    });

    renderContext();
    expect(await screen.findByLabelText('collection count')).toHaveTextContent('2');

    const staleLookup = deferred<BookmarkCollection[]>();
    mocks.fetchBookmarkCollections.mockReturnValueOnce(staleLookup.promise);
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(3, true)]);
    fireEvent.click(screen.getByRole('button', { name: 'fetch for post' }));
    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    });

    await act(async () => {
      staleLookup.resolve([collection(2, true)]);
      await staleLookup.promise;
    });

    expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    await waitFor(() => {
      expect(screen.getByLabelText('lookup result')).toHaveTextContent(
        'collection-1:3:true',
      );
    });
  });
  it('serializes mutations for the same collection in invocation order', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([
      collection(2),
      collection(5, undefined, 'collection-2'),
    ]);
    const addMutation = deferred<{
      postId: string;
      bookmarkedByMe: boolean;
      collectionIds: string[];
      collection: BookmarkCollection;
    }>();
    const removeMutation = deferred<{
      postId: string;
      bookmarkedByMe: boolean;
      collectionIds: string[];
      collection: BookmarkCollection;
    }>();
    mocks.addPostToBookmarkCollection.mockReturnValueOnce(addMutation.promise);
    mocks.removePostFromBookmarkCollection.mockReturnValueOnce(removeMutation.promise);

    renderContext();
    await waitFor(() => {
      expect(screen.getByLabelText('collections state')).toHaveTextContent(
        'collection-1:2:undefined,collection-2:5:undefined',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    await waitFor(() => {
      expect(mocks.addPostToBookmarkCollection).toHaveBeenCalledTimes(1);
    });
    expect(mocks.removePostFromBookmarkCollection).not.toHaveBeenCalled();

    await act(async () => {
      addMutation.resolve({
        postId: 'post-1',
        bookmarkedByMe: true,
        collectionIds: ['collection-1'],
        collection: collection(3),
      });
      await addMutation.promise;
    });

    await waitFor(() => {
      expect(mocks.removePostFromBookmarkCollection).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    });

    await act(async () => {
      removeMutation.resolve({
        postId: 'post-1',
        bookmarkedByMe: false,
        collectionIds: [],
        collection: collection(2),
      });
      await removeMutation.promise;
    });

    await waitFor(() => {
      expect(screen.getByLabelText('collections state')).toHaveTextContent(
        'collection-1:2:undefined,collection-2:5:undefined',
      );
    });
  });

  it('preserves all collections when refresh fails before a mutation succeeds', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([
      collection(2),
      collection(5, undefined, 'collection-2'),
    ]);
    const failedRefresh = deferred<BookmarkCollection[]>();
    const addMutation = deferred<{
      postId: string;
      bookmarkedByMe: boolean;
      collectionIds: string[];
      collection: BookmarkCollection;
    }>();
    mocks.fetchBookmarkCollections.mockReturnValueOnce(failedRefresh.promise);
    mocks.addPostToBookmarkCollection.mockReturnValueOnce(addMutation.promise);

    renderContext();
    await waitFor(() => {
      expect(screen.getByLabelText('collections state')).toHaveTextContent(
        'collection-1:2:undefined,collection-2:5:undefined',
      );
    });

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    fireEvent.click(screen.getByRole('button', { name: 'add' }));

    await act(async () => {
      failedRefresh.reject(new Error('refresh failed'));
      await failedRefresh.promise.catch(() => undefined);
    });

    expect(screen.getByLabelText('collections state')).toHaveTextContent(
      'collection-1:2:undefined,collection-2:5:undefined',
    );
    expect(screen.getByLabelText('error state')).toHaveTextContent('refresh failed');
    expect(screen.getByLabelText('loading state')).toHaveTextContent('idle');

    await act(async () => {
      addMutation.resolve({
        postId: 'post-1',
        bookmarkedByMe: true,
        collectionIds: ['collection-1'],
        collection: collection(3),
      });
      await addMutation.promise;
    });

    await waitFor(() => {
      expect(screen.getByLabelText('collections state')).toHaveTextContent(
        'collection-1:3:undefined,collection-2:5:undefined',
      );
    });
  });

  it('retries an older post lookup after a newer refresh succeeds', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(2)]);

    renderContext();
    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('2');
    });

    const staleLookup = deferred<BookmarkCollection[]>();
    mocks.fetchBookmarkCollections.mockReturnValueOnce(staleLookup.promise);
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(3)]);
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(3, true)]);

    fireEvent.click(screen.getByRole('button', { name: 'fetch for post' }));
    await waitFor(() => {
      expect(mocks.fetchBookmarkCollections).toHaveBeenCalledWith('post-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    });

    await act(async () => {
      staleLookup.resolve([collection(2, false)]);
      await staleLookup.promise;
    });

    await waitFor(() => {
      expect(screen.getByLabelText('lookup result')).toHaveTextContent(
        'collection-1:3:true',
      );
    });
    expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    expect(screen.getByLabelText('loading state')).toHaveTextContent('idle');
    expect(screen.getByLabelText('error state')).toHaveTextContent('none');
    expect(mocks.fetchBookmarkCollections).toHaveBeenCalledTimes(4);
  });

  it('keeps a newer refresh error when an older post lookup finishes', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(2)]);

    renderContext();
    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('2');
    });

    const staleLookup = deferred<BookmarkCollection[]>();
    mocks.fetchBookmarkCollections.mockReturnValueOnce(staleLookup.promise);
    mocks.fetchBookmarkCollections.mockRejectedValueOnce(new Error('refresh failed'));
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(4, true)]);

    fireEvent.click(screen.getByRole('button', { name: 'fetch for post' }));
    await waitFor(() => {
      expect(mocks.fetchBookmarkCollections).toHaveBeenCalledWith('post-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));

    await waitFor(() => {
      expect(screen.getByLabelText('error state')).toHaveTextContent('refresh failed');
    });
    expect(screen.getByLabelText('collection count')).toHaveTextContent('2');
    expect(screen.getByLabelText('loading state')).toHaveTextContent('idle');

    await act(async () => {
      staleLookup.resolve([collection(1, false)]);
      await staleLookup.promise;
    });

    await waitFor(() => {
      expect(screen.getByLabelText('lookup result')).toHaveTextContent(
        'collection-1:4:true',
      );
    });
    expect(screen.getByLabelText('collection count')).toHaveTextContent('2');
    expect(screen.getByLabelText('error state')).toHaveTextContent('refresh failed');
    expect(mocks.fetchBookmarkCollections).toHaveBeenCalledTimes(4);
  });

  it('ignores an older refresh after a newer post lookup succeeds', async () => {
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(2)]);

    renderContext();
    await waitFor(() => {
      expect(screen.getByLabelText('collection count')).toHaveTextContent('2');
    });

    const staleRefresh = deferred<BookmarkCollection[]>();
    mocks.fetchBookmarkCollections.mockReturnValueOnce(staleRefresh.promise);
    mocks.fetchBookmarkCollections.mockResolvedValueOnce([collection(3, true)]);

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => {
      expect(screen.getByLabelText('loading state')).toHaveTextContent('loading');
    });
    fireEvent.click(screen.getByRole('button', { name: 'fetch for post' }));

    await waitFor(() => {
      expect(screen.getByLabelText('lookup result')).toHaveTextContent(
        'collection-1:3:true',
      );
    });

    await act(async () => {
      staleRefresh.resolve([collection(2)]);
      await staleRefresh.promise;
    });

    expect(screen.getByLabelText('collection count')).toHaveTextContent('3');
    await waitFor(() => {
      expect(screen.getByLabelText('loading state')).toHaveTextContent('idle');
    });
  });
});
