'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
const EMPTY_COLLECTIONS: BookmarkCollection[] = [];

type OwnedCollections = {
  ownerId: string | null;
  items: BookmarkCollection[];
};

function createStaleAuthRequestError() {
  const error = new Error('사용자가 변경되어 요청이 취소되었습니다.');
  error.name = 'AbortError';
  return error;
}

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
  const [ownedCollections, setOwnedCollections] = useState<OwnedCollections>({
    ownerId: null,
    items: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const authenticatedUserId = isAuthReady && user ? String(user.id) : null;
  const activeUserIdRef = useRef<string | null>(authenticatedUserId);
  const authGenerationRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const collections =
    ownedCollections.ownerId === authenticatedUserId
      ? ownedCollections.items
      : EMPTY_COLLECTIONS;

  useEffect(() => {
    activeUserIdRef.current = authenticatedUserId;
    authGenerationRef.current += 1;
    refreshRequestIdRef.current += 1;
    setOwnedCollections({
      ownerId: authenticatedUserId,
      items: [],
    });
    setError(null);
  }, [authenticatedUserId]);

  const isCurrentAuthRequest = useCallback(
    (requestedUserId: string | null, requestedGeneration: number) =>
      requestedUserId !== null &&
      activeUserIdRef.current === requestedUserId &&
      authGenerationRef.current === requestedGeneration,
    [],
  );

  const refreshCollections = useCallback(async () => {
    const requestId = ++refreshRequestIdRef.current;
    const requestedUserId = authenticatedUserId;
    const requestedGeneration = authGenerationRef.current;

    if (!requestedUserId) {
      setOwnedCollections({
        ownerId: null,
        items: [],
      });
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const nextCollections = await fetchBookmarkCollections();

      if (
        requestId !== refreshRequestIdRef.current ||
        !isCurrentAuthRequest(requestedUserId, requestedGeneration)
      ) {
        return;
      }

      setOwnedCollections({
        ownerId: requestedUserId,
        items: nextCollections,
      });
    } catch (loadError) {
      if (
        requestId !== refreshRequestIdRef.current ||
        !isCurrentAuthRequest(requestedUserId, requestedGeneration)
      ) {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : '모음집을 불러오지 못했습니다.');
      setOwnedCollections({
        ownerId: requestedUserId,
        items: [],
      });
    } finally {
      if (
        requestId === refreshRequestIdRef.current &&
        isCurrentAuthRequest(requestedUserId, requestedGeneration)
      ) {
        setLoading(false);
      }
    }
  }, [authenticatedUserId, isCurrentAuthRequest]);

  useEffect(() => {
    void refreshCollections();

    return () => {
      refreshRequestIdRef.current += 1;
    };
  }, [refreshCollections]);

  const fetchCollectionsForPost = useCallback(async (postId: string) => {
    const requestedUserId = authenticatedUserId;
    const requestedGeneration = authGenerationRef.current;
    const nextCollections = await fetchBookmarkCollections(postId);

    if (!isCurrentAuthRequest(requestedUserId, requestedGeneration)) {
      throw createStaleAuthRequestError();
    }

    setOwnedCollections({
      ownerId: requestedUserId,
      items: nextCollections.map(withoutPostContainment),
    });
    return nextCollections;
  }, [authenticatedUserId, isCurrentAuthRequest]);

  const createCollection = useCallback(async (name: string, initialPostId?: string | null) => {
    const requestedUserId = authenticatedUserId;
    const requestedGeneration = authGenerationRef.current;
    const collection = await createBookmarkCollection(name, initialPostId);

    if (!isCurrentAuthRequest(requestedUserId, requestedGeneration)) {
      throw createStaleAuthRequestError();
    }

    setOwnedCollections((current) => ({
      ownerId: requestedUserId,
      items:
        current.ownerId === requestedUserId
          ? upsertCollection(current.items, collection)
          : [collection],
    }));
    return collection;
  }, [authenticatedUserId, isCurrentAuthRequest]);

  const addBookmarkToCollection = useCallback(async (collectionId: string, postId: string) => {
    const requestedUserId = authenticatedUserId;
    const requestedGeneration = authGenerationRef.current;
    const state = await addPostToBookmarkCollection(collectionId, postId);

    if (!isCurrentAuthRequest(requestedUserId, requestedGeneration)) {
      throw createStaleAuthRequestError();
    }

    setOwnedCollections((current) => ({
      ownerId: requestedUserId,
      items:
        current.ownerId === requestedUserId
          ? upsertCollection(current.items, state.collection)
          : [state.collection],
    }));
  }, [authenticatedUserId, isCurrentAuthRequest]);

  const removeBookmarkFromCollection = useCallback(async (collectionId: string, postId: string) => {
    const requestedUserId = authenticatedUserId;
    const requestedGeneration = authGenerationRef.current;
    const state = await removePostFromBookmarkCollection(collectionId, postId);

    if (!isCurrentAuthRequest(requestedUserId, requestedGeneration)) {
      throw createStaleAuthRequestError();
    }

    setOwnedCollections((current) => ({
      ownerId: requestedUserId,
      items:
        current.ownerId === requestedUserId
          ? upsertCollection(current.items, state.collection)
          : [state.collection],
    }));
  }, [authenticatedUserId, isCurrentAuthRequest]);

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
