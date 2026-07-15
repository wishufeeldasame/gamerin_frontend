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
import type { BookmarkCollection } from '@/types/bookmark';
import { useAuth } from '@/app/context/AuthContext';

interface BookmarkCollectionContextValue {
  collections: BookmarkCollection[];
  createCollection: (title: string, coverImageUrl?: string | null) => BookmarkCollection;
  toggleBookmarkInCollection: (collectionId: string, postId: string) => void;
  getSavedCollectionIds: (postId: string) => string[];
}

const initialCollections: BookmarkCollection[] = [
  {
    id: 'collection-favorites',
    title: '즐겨찾기',
    coverImageUrl: null,
    createdAt: new Date(0).toISOString(),
    savedPostIds: [],
  },
];

const BOOKMARK_COLLECTIONS_STORAGE_KEY_PREFIX = 'gamerin_bookmark_collections';

const BookmarkCollectionContext = createContext<BookmarkCollectionContextValue | null>(null);

function isBookmarkCollection(value: unknown): value is BookmarkCollection {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const collection = value as Record<string, unknown>;
  return (
    typeof collection.id === 'string' &&
    collection.id.length > 0 &&
    typeof collection.title === 'string' &&
    collection.title.trim().length > 0 &&
    collection.title.length <= 100 &&
    (collection.coverImageUrl === null ||
      typeof collection.coverImageUrl === 'string') &&
    typeof collection.createdAt === 'string' &&
    Array.isArray(collection.savedPostIds) &&
    collection.savedPostIds.every((postId) => typeof postId === 'string')
  );
}

function createCollectionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `collection-${Date.now()}`;
}

function getBookmarkCollectionsStorageKey(userId: string) {
  return `${BOOKMARK_COLLECTIONS_STORAGE_KEY_PREFIX}:${userId}`;
}

function createInitialCollections() {
  return initialCollections.map((collection) => ({
    ...collection,
    savedPostIds: [...collection.savedPostIds],
  }));
}

export function BookmarkCollectionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const currentUserId = isAuthReady ? user?.id ?? null : null;
  const storageKey = currentUserId
    ? getBookmarkCollectionsStorageKey(currentUserId)
    : null;
  const [collectionsState, setCollectionsState] = useState<{
    userId: string | null;
    collections: BookmarkCollection[];
  }>({ userId: null, collections: [] });

  // Do not expose a previous account's collections while the next account loads.
  const collections =
    collectionsState.userId === currentUserId ? collectionsState.collections : [];

  useEffect(() => {
    try {
      window.localStorage.removeItem(BOOKMARK_COLLECTIONS_STORAGE_KEY_PREFIX);
    } catch {
      // localStorage 사용이 제한된 환경에서는 무시
    }
  }, []);

  useEffect(() => {
    if (!isAuthReady || !currentUserId || !storageKey) {
      setCollectionsState({ userId: null, collections: [] });
      return;
    }

    try {
      const storedCollections = window.localStorage.getItem(storageKey);
      if (!storedCollections) {
        setCollectionsState({
          userId: currentUserId,
          collections: createInitialCollections(),
        });
        return;
      }

      const parsedCollections: unknown = JSON.parse(storedCollections);
      if (
        Array.isArray(parsedCollections) &&
        parsedCollections.every(isBookmarkCollection)
      ) {
        setCollectionsState({ userId: currentUserId, collections: parsedCollections });
        return;
      }

      throw new Error('Invalid bookmark collection data');
    } catch {
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Storage can be unavailable in restricted browser contexts.
      }

      setCollectionsState({
        userId: currentUserId,
        collections: createInitialCollections(),
      });
    }
  }, [currentUserId, isAuthReady, storageKey]);

  const createCollection = useCallback(
    (title: string, coverImageUrl: string | null = null) => {
      if (!currentUserId || !storageKey || collectionsState.userId !== currentUserId) {
        throw new Error('모음집을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.');
      }

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        throw new Error('모음집 이름을 입력해 주세요.');
      }

      const collection: BookmarkCollection = {
        id: createCollectionId(),
        title: trimmedTitle,
        coverImageUrl,
        createdAt: new Date().toISOString(),
        savedPostIds: [],
      };

      setCollectionsState((current) => {
        if (current.userId !== currentUserId) {
          return current;
        }

        const next = [...current.collections, collection];
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return { userId: currentUserId, collections: next };
      });
      return collection;
    },
    [collectionsState.userId, currentUserId, storageKey],
  );

  const toggleBookmarkInCollection = useCallback(
    (collectionId: string, postId: string) => {
      if (!currentUserId || !storageKey || collectionsState.userId !== currentUserId) {
        return;
      }

      setCollectionsState((current) => {
        if (current.userId !== currentUserId) {
          return current;
        }

        const next = current.collections.map((collection) => {
          if (collection.id !== collectionId) {
            return collection;
          }

          const isSaved = collection.savedPostIds.includes(postId);
          return {
            ...collection,
            savedPostIds: isSaved
              ? collection.savedPostIds.filter((savedPostId) => savedPostId !== postId)
              : [...collection.savedPostIds, postId],
          };
        });

        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return { userId: currentUserId, collections: next };
      });
    },
    [collectionsState.userId, currentUserId, storageKey],
  );

  const getSavedCollectionIds = useCallback(
    (postId: string) =>
      collections
        .filter((collection) => collection.savedPostIds.includes(postId))
        .map((collection) => collection.id),
    [collections],
  );

  const value = useMemo(
    () => ({
      collections,
      createCollection,
      toggleBookmarkInCollection,
      getSavedCollectionIds,
    }),
    [collections, createCollection, toggleBookmarkInCollection, getSavedCollectionIds],
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
