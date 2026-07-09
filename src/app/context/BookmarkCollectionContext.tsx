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

const BOOKMARK_COLLECTIONS_STORAGE_KEY = 'gamerin_bookmark_collections';

const BookmarkCollectionContext = createContext<BookmarkCollectionContextValue | null>(null);

function createCollectionId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `collection-${Date.now()}`;
}

export function BookmarkCollectionProvider({ children }: { children: ReactNode }) {
  const [collections, setCollections] = useState<BookmarkCollection[]>(initialCollections);

  useEffect(() => {
    try {
      const storedCollections = window.localStorage.getItem(BOOKMARK_COLLECTIONS_STORAGE_KEY);
      if (!storedCollections) {
        return;
      }

      const parsedCollections = JSON.parse(storedCollections) as BookmarkCollection[];
      if (Array.isArray(parsedCollections)) {
        setCollections(parsedCollections);
      }
    } catch {
      window.localStorage.removeItem(BOOKMARK_COLLECTIONS_STORAGE_KEY);
    }
  }, []);

  const createCollection = useCallback((title: string, coverImageUrl: string | null = null) => {
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

    setCollections((current) => {
      const next = [...current, collection];
      window.localStorage.setItem(BOOKMARK_COLLECTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    return collection;
  }, []);

  const toggleBookmarkInCollection = useCallback((collectionId: string, postId: string) => {
    setCollections((current) => {
      const next = current.map((collection) => {
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

      window.localStorage.setItem(BOOKMARK_COLLECTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

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
