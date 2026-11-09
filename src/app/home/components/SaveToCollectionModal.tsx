'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Folder, Plus, X } from 'lucide-react';
import { useBookmarkCollections } from '@/app/context/BookmarkCollectionContext';
import type { BookmarkCollection } from '@/types/bookmark';

interface SaveToCollectionModalProps {
  isOpen: boolean;
  postId: string;
  isBookmarked?: boolean;
  onClose: () => void;
  onCollectionChange?: (collectionId: string, containsPost: boolean) => void;
  onBookmarkStateChange?: (
    isBookmarked: boolean,
    options?: { skipRequest?: boolean },
  ) => Promise<boolean>;
}

export default function SaveToCollectionModal({
  isOpen,
  postId,
  isBookmarked = false,
  onClose,
  onCollectionChange,
  onBookmarkStateChange,
}: SaveToCollectionModalProps) {
  const titleId = useId();
  const collectionRequestIdRef = useRef(0);
  const {
    createCollection,
    fetchCollectionsForPost,
    refreshCollections,
    addBookmarkToCollection,
    removeBookmarkFromCollection,
  } = useBookmarkCollections();
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isPostBookmarked, setIsPostBookmarked] = useState(isBookmarked);
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
    if (isOpen) {
      setIsPostBookmarked(isBookmarked);
    }
  }, [isBookmarked, isOpen]);

  useEffect(() => {
    const requestId = ++collectionRequestIdRef.current;
    if (!isOpen) {
      return;
    }

    let cancelled = false;
    const isCurrentRequest = () =>
      !cancelled && collectionRequestIdRef.current === requestId;

    const loadCollections = async () => {
      try {
        setLoadingCollections(true);
        setError('');
        const nextCollections = await fetchCollectionsForPost(postId);
        if (isCurrentRequest()) {
          setCollections(nextCollections);
        }
      } catch (loadError) {
        if (isCurrentRequest()) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : '모음집을 불러오지 못했습니다.',
          );
        }
      } finally {
        if (isCurrentRequest()) {
          setLoadingCollections(false);
        }
      }
    };

    void loadCollections();

    return () => {
      cancelled = true;
    };
  }, [fetchCollectionsForPost, isOpen, postId]);

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
      const collection = await createCollection(trimmedTitle, postId);
      setCollections((current) => [{ ...collection, containsPost: true }, ...current]);
      setIsPostBookmarked(true);
      await onBookmarkStateChange?.(true, { skipRequest: true });
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

  const completeBookmarkRemoval = async () => {
    setCollections((current) =>
      current.map((collection) => ({
        ...collection,
        containsPost: false,
      })),
    );
    setIsPostBookmarked(false);
    await refreshCollections();
  };

  const handleCollectionChange = async (collectionId: string, isChecked: boolean) => {
    if (pendingCollectionId) {
      return;
    }

    setPendingCollectionId(collectionId);
    setError('');

    try {
      if (isChecked) {
        const selectedCount = collections.filter((collection) => collection.containsPost).length;
        if (selectedCount <= 1 && onBookmarkStateChange) {
          const stateUpdated = await onBookmarkStateChange(false);
          if (!stateUpdated) {
            setError('서버에서 북마크를 해제하지 못했습니다.');
            return;
          }

          await completeBookmarkRemoval();
          return;
        }

        await removeBookmarkFromCollection(collectionId, postId);
        setCollections((current) =>
          current.map((collection) =>
            collection.collectionId === collectionId
              ? {
                  ...collection,
                  containsPost: false,
                  bookmarkCount: Math.max(0, collection.bookmarkCount - 1),
                }
              : collection,
          ),
        );
        onCollectionChange?.(collectionId, false);
      } else {
        await addBookmarkToCollection(collectionId, postId);
        setCollections((current) =>
          current.map((collection) =>
            collection.collectionId === collectionId
              ? {
                  ...collection,
                  containsPost: true,
                  bookmarkCount: collection.bookmarkCount + 1,
                }
              : collection,
          ),
        );
        setIsPostBookmarked(true);
        await onBookmarkStateChange?.(true, { skipRequest: true });
        onCollectionChange?.(collectionId, true);
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : '모음집을 수정할 수 없습니다.',
      );
    } finally {
      setPendingCollectionId(null);
    }
  };

  const handleRemoveAllBookmarks = async () => {
    if (pendingCollectionId || !onBookmarkStateChange) {
      return;
    }

    setPendingCollectionId('all');
    setError('');

    try {
      const stateUpdated = await onBookmarkStateChange(false);
      if (!stateUpdated) {
        setError('서버에서 북마크를 해제하지 못했습니다.');
        return;
      }

      await completeBookmarkRemoval();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '북마크를 해제할 수 없습니다.');
    } finally {
      setPendingCollectionId(null);
    }
  };

  return (
    <div
      className="modal-overlay z-[70]"
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
        className="modal-panel flex flex-col overflow-hidden lg:max-w-[420px]"
      >
        <div aria-hidden="true" className="modal-handle" />
        <header className="relative flex min-h-16 shrink-0 items-center px-5 pr-14 lg:px-6">
          <h2 id={titleId} className="text-title text-fg-primary">
            모음집에 저장
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            className="btn-icon absolute right-3"
          >
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto py-2">
          {loadingCollections ? (
            <p role="status" className="px-5 py-10 text-center text-label text-fg-secondary">
              모음집을 불러오는 중...
            </p>
          ) : collections.length === 0 ? (
            <p className="px-5 py-10 text-center text-label text-fg-secondary">
              아직 만든 모음집이 없습니다.
            </p>
          ) : (
            collections.map((collection) => {
              const isChecked = Boolean(collection.containsPost);
              return (
                <label
                  key={collection.collectionId}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition hover:bg-subtle"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-control bg-subtle">
                    {collection.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={collection.coverImageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Folder size={20} className="text-icon-secondary" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-body text-fg-primary">
                    {collection.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={pendingCollectionId !== null}
                    onChange={() => {
                      void handleCollectionChange(collection.collectionId, isChecked);
                    }}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border border-line-strong text-transparent peer-checked:border-brand peer-checked:bg-brand peer-checked:text-fg-on-brand peer-disabled:opacity-60 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-line-focus">
                    <Check size={14} strokeWidth={3} />
                  </span>
                </label>
              );
            })
          )}
        </div>

        <footer className="border-t border-line px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] lg:px-6 lg:pb-6">
          {isPostBookmarked ? (
            <button
              type="button"
              onClick={() => void handleRemoveAllBookmarks()}
              disabled={loadingCollections || pendingCollectionId !== null}
              className="btn-secondary mb-3 w-full bg-danger-subtle text-fg-danger hover:bg-danger-subtle/70"
            >
              {pendingCollectionId === 'all' ? '해제 중...' : '전체 북마크 해제'}
            </button>
          ) : null}

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
                  aria-label="모음집 이름"
                  className="input-base min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateCollection()}
                  disabled={pendingCollectionId !== null}
                  className="btn-primary h-11"
                >
                  {pendingCollectionId === 'new' ? '저장 중...' : '만들기'}
                </button>
              </div>
              {error && <p role="alert" className="text-caption text-fg-danger">{error}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError('');
                setIsCreating(true);
              }}
              disabled={pendingCollectionId !== null}
              className="btn-secondary w-full"
            >
              <Plus size={18} />
              새 모음집 만들기
            </button>
          )}
          {!isCreating && error ? <p role="alert" className="mt-2 text-caption text-fg-danger">{error}</p> : null}
        </footer>
      </section>
    </div>
  );
}
