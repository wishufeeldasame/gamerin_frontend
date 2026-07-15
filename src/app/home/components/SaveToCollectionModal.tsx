'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Folder, Plus, X } from 'lucide-react';
import { useBookmarkCollections } from '@/app/context/BookmarkCollectionContext';

interface SaveToCollectionModalProps {
  isOpen: boolean;
  postId: string;
  isBookmarked?: boolean;
  onClose: () => void;
  onBookmarkStateChange?: (isBookmarked: boolean) => Promise<boolean>;
}

export default function SaveToCollectionModal({
  isOpen,
  postId,
  isBookmarked = false,
  onClose,
  onBookmarkStateChange,
}: SaveToCollectionModalProps) {
  const titleId = useId();
  const initializedPostIdRef = useRef<string | null>(null);
  const { collections, createCollection, toggleBookmarkInCollection } =
    useBookmarkCollections();
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');
  const [error, setError] = useState('');
  const [pendingCollectionId, setPendingCollectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      initializedPostIdRef.current = null;
      return;
    }

    if (initializedPostIdRef.current === postId || collections.length === 0) {
      return;
    }

    initializedPostIdRef.current = postId;

    if (
      isBookmarked &&
      !collections.some((collection) => collection.savedPostIds.includes(postId))
    ) {
      toggleBookmarkInCollection(collections[0].id, postId);
    }
  }, [
    collections,
    isBookmarked,
    isOpen,
    postId,
    toggleBookmarkInCollection,
  ]);

  if (!isOpen) {
    return null;
  }

  const handleCreateCollection = async () => {
    if (pendingCollectionId) {
      return;
    }

    const trimmedTitle = newCollectionTitle.trim();
    if (!trimmedTitle) {
      setError('모음집 이름을 입력해 주세요.');
      return;
    }

    setPendingCollectionId('new');
    setError('');

    try {
      const stateUpdated = onBookmarkStateChange
        ? await onBookmarkStateChange(true)
        : true;
      if (!stateUpdated) {
        setError('서버에 북마크를 저장하지 못했습니다.');
        return;
      }

      const collection = createCollection(trimmedTitle);
      toggleBookmarkInCollection(collection.id, postId);
      setNewCollectionTitle('');
      setIsCreating(false);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : '모음집을 만들 수 없습니다.',
      );
    } finally {
      setPendingCollectionId(null);
    }
  };

  const handleCollectionChange = async (collectionId: string, isChecked: boolean) => {
    if (pendingCollectionId) {
      return;
    }

    const selectedCount = collections.filter((item) =>
      item.savedPostIds.includes(postId),
    ).length;
    const willRemainBookmarked = isChecked ? selectedCount > 1 : true;

    setPendingCollectionId(collectionId);
    setError('');

    try {
      const stateUpdated = onBookmarkStateChange
        ? await onBookmarkStateChange(willRemainBookmarked)
        : true;
      if (!stateUpdated) {
        setError('서버에 북마크를 저장하지 못했습니다.');
        return;
      }

      toggleBookmarkInCollection(collectionId, postId);
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : '모음집을 수정할 수 없습니다.',
      );
    } finally {
      setPendingCollectionId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-neutral-900"
      >
        <header className="relative flex h-14 items-center justify-center border-b border-zinc-200 px-14 dark:border-neutral-700">
          <h2 id={titleId} className="text-base font-bold text-zinc-950 dark:text-zinc-100">
            모음집에 저장
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            className="absolute right-4 flex h-9 w-9 items-center justify-center text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
          >
            <X size={22} />
          </button>
        </header>

        <div className="max-h-80 overflow-y-auto py-2">
          {collections.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-zinc-500">
              아직 만든 모음집이 없습니다.
            </p>
          ) : (
            collections.map((collection) => {
              const isChecked = collection.savedPostIds.includes(postId);
              return (
                <label
                  key={collection.id}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-zinc-50 dark:hover:bg-neutral-800"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-neutral-800">
                    {collection.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={collection.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Folder size={20} className="text-zinc-400" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {collection.title}
                  </span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={pendingCollectionId !== null}
                    onChange={() => {
                      void handleCollectionChange(collection.id, isChecked);
                    }}
                    className="h-5 w-5 accent-[#f5b93d]"
                  />
                </label>
              );
            })
          )}
        </div>

        <footer className="border-t border-zinc-200 p-4 dark:border-neutral-700">
          {isCreating ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCollectionTitle}
                  onChange={(event) => {
                    setNewCollectionTitle(event.target.value);
                    setError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleCreateCollection();
                    }
                  }}
                  disabled={pendingCollectionId !== null}
                  maxLength={40}
                  placeholder="모음집 이름"
                  className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 text-sm text-zinc-950 outline-none focus:border-[#f5b93d] dark:border-neutral-600 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateCollection()}
                  disabled={pendingCollectionId !== null}
                  className="rounded-md bg-[#f5b93d] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#f8c957] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingCollectionId === 'new' ? '저장 중...' : '만들기'}
                </button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError('');
                setIsCreating(true);
              }}
              disabled={pendingCollectionId !== null}
              className="flex w-full items-center justify-center gap-2 py-1 text-sm font-bold text-zinc-900 transition hover:text-[#d99a18] disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-100 dark:hover:text-[#f5b93d]"
            >
              <Plus size={18} />
              새 모음집 만들기
            </button>
          )}
          {!isCreating && error ? <p className="mt-2 text-xs text-red-500">{error}</p> : null}
        </footer>
      </section>
    </div>
  );
}
