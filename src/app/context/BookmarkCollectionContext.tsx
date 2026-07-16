'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  addPostToBookmarkCollection,
  createBookmarkCollection,
  fetchBookmarkCollections,
  removePostFromBookmarkCollection,
} from '@/lib/feed-api';
import type { BookmarkCollection } from '@/types/bookmark';

interface BookmarkCollectionContextValue {
  collections: BookmarkCollection[];
  loading: boolean;
  error: string | null;
  refreshCollections: () => Promise<void>;
  fetchCollectionsForPost: (postId: string) => Promise<BookmarkCollection[]>;
  createCollection: (name: string, initialPostId?: string | null) => Promise<BookmarkCollection>;
  addBookmarkToCollection: (collectionId: string, postId: string) => Promise<void>;
  removeBookmarkFromCollection: (collectionId: string, postId: string) => Promise<void>;
}

const BookmarkCollectionContext = createContext<BookmarkCollectionContextValue | null>(null);

function upsertCollection(
  collections: BookmarkCollection[],
  nextCollection: BookmarkCollection,
) {
  const exists = collections.some(
    (collection) => collection.collectionId === nextCollection.collectionId,
  );

  if (!exists) {
    return [nextCollection, ...collections];
  }

  return collections.map((collection) =>
    collection.collectionId === nextCollection.collectionId
      ? { ...collection, ...nextCollection }
      : collection,
  );
}

function withoutPostContainment(collection: BookmarkCollection): BookmarkCollection {
  return {
    collectionId: collection.collectionId,
    name: collection.name,
    coverImageUrl: collection.coverImageUrl,
    bookmarkCount: collection.bookmarkCount,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

export function BookmarkCollectionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCollections = useCallback(async () => {
    if (!isAuthReady || !user) {
      setCollections([]);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCollections(await fetchBookmarkCollections());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '모음집을 불러오지 못했습니다.');
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthReady, user]);

  useEffect(() => {
    void refreshCollections();
  }, [refreshCollections]);

  const fetchCollectionsForPost = useCallback(async (postId: string) => {
    const nextCollections = await fetchBookmarkCollections(postId);
    setCollections(nextCollections.map(withoutPostContainment));
    return nextCollections;
  }, []);

  const createCollection = useCallback(async (name: string, initialPostId?: string | null) => {
    const collection = await createBookmarkCollection(name, initialPostId);
    setCollections((current) => upsertCollection(current, collection));
    return collection;
  }, []);

  const addBookmarkToCollection = useCallback(async (collectionId: string, postId: string) => {
    const state = await addPostToBookmarkCollection(collectionId, postId);
    setCollections((current) => upsertCollection(current, state.collection));
  }, []);

  const removeBookmarkFromCollection = useCallback(async (collectionId: string, postId: string) => {
    const state = await removePostFromBookmarkCollection(collectionId, postId);
    setCollections((current) => upsertCollection(current, state.collection));
  }, []);

  const value = useMemo(
    () => ({
      collections,
      loading,
      error,
      refreshCollections,
      fetchCollectionsForPost,
      createCollection,
      addBookmarkToCollection,
      removeBookmarkFromCollection,
    }),
    [
      collections,
      loading,
      error,
      refreshCollections,
      fetchCollectionsForPost,
      createCollection,
      addBookmarkToCollection,
      removeBookmarkFromCollection,
    ],
  );

  return (
    <BookmarkCollectionContext.Provider value={value}>
      {children}
    </BookmarkCollectionContext.Provider>
  );
}

export function useBookmarkCollections() {
  const context = useContext(BookmarkCollectionContext);
  if (!context) {
    throw new Error('useBookmarkCollections must be used within BookmarkCollectionProvider');
  }
  return context;
}
