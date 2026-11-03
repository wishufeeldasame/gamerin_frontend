'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { useToast } from '@/app/context/ToastContext';
import type { CursorPage } from '@/types/api';

type CursorListKey = string | number;
type QueryKey = string | number | boolean | null;
type LoadPage<T> = (cursor: string | null, options: { signal: AbortSignal }) => Promise<CursorPage<T>>;

interface PageLoadedContext<T> {
  append: boolean;
  items: T[];
}

interface UseCursorListOptions<T> {
  loadPage: LoadPage<T>;
  getKey: (item: T) => CursorListKey;
  queryKey?: QueryKey;
  enabled?: boolean;
  initialErrorMessage?: string;
  loadMoreErrorMessage?: string;
  onPageLoaded?: (page: CursorPage<T>, context: PageLoadedContext<T>) => void;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function deduplicateByKey<T>(items: T[], getKey: (item: T) => CursorListKey) {
  const seen = new Set<CursorListKey>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function useCursorList<T>({
  loadPage,
  getKey,
  queryKey = null,
  enabled = true,
  initialErrorMessage = '목록을 불러오지 못했습니다.',
  loadMoreErrorMessage = '목록을 더 불러오지 못했습니다.',
  onPageLoaded,
}: UseCursorListOptions<T>) {
  const toast = useToast();
  const loadPageRef = useRef(loadPage);
  const getKeyRef = useRef(getKey);
  const onPageLoadedRef = useRef(onPageLoaded);
  const initialErrorMessageRef = useRef(initialErrorMessage);
  const loadMoreErrorMessageRef = useRef(loadMoreErrorMessage);
  const itemsRef = useRef<T[]>([]);
  const initialControllerRef = useRef<AbortController | null>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [items, setItemsState] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  loadPageRef.current = loadPage;
  getKeyRef.current = getKey;
  onPageLoadedRef.current = onPageLoaded;
  initialErrorMessageRef.current = initialErrorMessage;
  loadMoreErrorMessageRef.current = loadMoreErrorMessage;

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback((value) => {
    setItemsState((current) => {
      const next = typeof value === 'function'
        ? (value as (previous: T[]) => T[])(current)
        : value;
      itemsRef.current = next;
      return next;
    });
  }, []);

  const cancelRequests = useCallback(() => {
    initialControllerRef.current?.abort();
    loadMoreControllerRef.current?.abort();
    initialControllerRef.current = null;
    loadMoreControllerRef.current = null;
  }, []);

  const fetchFirstPage = useCallback(async (clearItems: boolean) => {
    cancelRequests();
    const generation = ++generationRef.current;
    const controller = new AbortController();
    initialControllerRef.current = controller;

    if (clearItems) setItems([]);
    setNextCursor(null);
    setHasNext(false);
    setError(null);
    setLoadMoreError(null);
    setLoadingMore(false);
    setLoading(true);

    try {
      const page = await loadPageRef.current(null, { signal: controller.signal });
      if (!mountedRef.current || generation !== generationRef.current || controller.signal.aborted) return;

      const nextItems = deduplicateByKey(page.items, getKeyRef.current);
      setItems(nextItems);
      setNextCursor(page.nextCursor);
      setHasNext(Boolean(page.hasNext && page.nextCursor));
      onPageLoadedRef.current?.(page, { append: false, items: nextItems });
    } catch (requestError) {
      if (!controller.signal.aborted && !isAbortError(requestError) && generation === generationRef.current) {
        setError(getErrorMessage(requestError, initialErrorMessageRef.current));
      }
    } finally {
      if (initialControllerRef.current === controller) initialControllerRef.current = null;
      if (mountedRef.current && generation === generationRef.current) setLoading(false);
    }
  }, [cancelRequests, setItems]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      void fetchFirstPage(true);
    } else {
      cancelRequests();
      generationRef.current += 1;
      setItems([]);
      setNextCursor(null);
      setHasNext(false);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      setLoadMoreError(null);
    }

    return () => {
      cancelRequests();
      generationRef.current += 1;
    };
  }, [cancelRequests, enabled, fetchFirstPage, queryKey, setItems]);

  useEffect(() => () => {
    mountedRef.current = false;
    cancelRequests();
    generationRef.current += 1;
  }, [cancelRequests]);

  const reload = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return fetchFirstPage(false);
  }, [enabled, fetchFirstPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || loading || loadingMore || !hasNext || !nextCursor || loadMoreControllerRef.current) return;

    const generation = generationRef.current;
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setLoadMoreError(null);

    try {
      const page = await loadPageRef.current(nextCursor, { signal: controller.signal });
      if (!mountedRef.current || generation !== generationRef.current || controller.signal.aborted) return;

      const mergedItems = deduplicateByKey([...itemsRef.current, ...page.items], getKeyRef.current);
      setItems(mergedItems);
      setNextCursor(page.nextCursor);
      setHasNext(Boolean(page.hasNext && page.nextCursor));
      onPageLoadedRef.current?.(page, { append: true, items: mergedItems });
    } catch (requestError) {
      if (!controller.signal.aborted && !isAbortError(requestError) && generation === generationRef.current) {
        const message = getErrorMessage(requestError, loadMoreErrorMessageRef.current);
        setLoadMoreError(message);
        toast.error(message);
      }
    } finally {
      if (loadMoreControllerRef.current === controller) loadMoreControllerRef.current = null;
      if (mountedRef.current && generation === generationRef.current) setLoadingMore(false);
    }
  }, [enabled, hasNext, loading, loadingMore, nextCursor, setItems, toast]);

  return {
    items,
    setItems,
    nextCursor,
    hasNext,
    loading,
    loadingMore,
    error,
    loadMoreError,
    reload,
    loadMore,
  };
}
