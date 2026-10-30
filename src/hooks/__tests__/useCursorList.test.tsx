import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCursorList } from '@/hooks/useCursorList';
import type { CursorPage } from '@/types/api';

interface Item {
  id: string;
  label: string;
}

const toastError = vi.fn();

vi.mock('@/app/context/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: toastError,
    info: vi.fn(),
  }),
}));

function page(items: Item[], nextCursor: string | null = null, hasNext = false): CursorPage<Item> {
  return { items, nextCursor, hasNext };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('useCursorList', () => {
  beforeEach(() => {
    toastError.mockReset();
  });

  it('첫 페이지를 불러오며 키가 같은 항목을 제거한다', async () => {
    const loadPage = vi.fn().mockResolvedValue(page([
      { id: '1', label: '첫 항목' },
      { id: '1', label: '중복 항목' },
      { id: '2', label: '둘째 항목' },
    ], 'next', true));
    const { result } = renderHook(() => useCursorList({ loadPage, getKey: (item: Item) => item.id }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(result.current.nextCursor).toBe('next');
    expect(result.current.hasNext).toBe(true);
  });

  it('queryKey가 바뀌면 이전 요청을 취소하고 오래된 응답을 버린다', async () => {
    const first = deferred<CursorPage<Item>>();
    const second = deferred<CursorPage<Item>>();
    const signals: AbortSignal[] = [];
    const loadPage = vi.fn((_cursor: string | null, options: { signal: AbortSignal }) => {
      signals.push(options.signal);
      return signals.length === 1 ? first.promise : second.promise;
    });
    const { result, rerender } = renderHook(
      ({ queryKey }) => useCursorList({ loadPage, getKey: (item: Item) => item.id, queryKey }),
      { initialProps: { queryKey: 'first' } },
    );

    rerender({ queryKey: 'second' });
    expect(signals[0]?.aborted).toBe(true);

    await act(async () => {
      second.resolve(page([{ id: '2', label: '새 결과' }]));
      await second.promise;
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      first.resolve(page([{ id: '1', label: '오래된 결과' }]));
      await first.promise;
    });

    expect(result.current.items).toEqual([{ id: '2', label: '새 결과' }]);
  });

  it('더보기 결과를 병합하고 키가 같은 항목을 제거한다', async () => {
    const loadPage = vi.fn()
      .mockResolvedValueOnce(page([{ id: '1', label: '첫 항목' }], 'next', true))
      .mockResolvedValueOnce(page([
        { id: '1', label: '중복 항목' },
        { id: '2', label: '둘째 항목' },
      ]));
    const { result } = renderHook(() => useCursorList({ loadPage, getKey: (item: Item) => item.id }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.loadMore());

    expect(result.current.items.map((item) => item.id)).toEqual(['1', '2']);
    expect(result.current.hasNext).toBe(false);
  });

  it('첫 페이지를 다시 조회하면 서버에서 사라진 항목을 제거한다', async () => {
    const loadPage = vi.fn()
      .mockResolvedValueOnce(page([
        { id: '1', label: '삭제될 항목' },
        { id: '2', label: '유지할 항목' },
      ]))
      .mockResolvedValueOnce(page([{ id: '2', label: '유지할 항목' }]));
    const { result } = renderHook(() => useCursorList({ loadPage, getKey: (item: Item) => item.id }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    await act(() => result.current.reload());

    expect(result.current.items).toEqual([{ id: '2', label: '유지할 항목' }]);
  });

  it('진행 중인 더보기 중복 호출과 커서 없는 요청을 막는다', async () => {
    const more = deferred<CursorPage<Item>>();
    const loadPage = vi.fn()
      .mockResolvedValueOnce(page([{ id: '1', label: '첫 항목' }], 'next', true))
      .mockReturnValueOnce(more.promise);
    const { result } = renderHook(() => useCursorList({ loadPage, getKey: (item: Item) => item.id }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let firstLoadMore!: Promise<void>;
    act(() => {
      firstLoadMore = result.current.loadMore();
      void result.current.loadMore();
    });
    expect(loadPage).toHaveBeenCalledTimes(2);

    await act(async () => {
      more.resolve(page([{ id: '2', label: '둘째 항목' }], null, true));
      await firstLoadMore;
    });
    expect(result.current.hasNext).toBe(false);

    await act(() => result.current.loadMore());
    expect(loadPage).toHaveBeenCalledTimes(2);
  });

  it('초기 오류를 노출하고 더보기 오류는 한국어 토스트로 알린다', async () => {
    const initialError = new Error('초기 조회 실패');
    const loadInitialPage = vi.fn().mockRejectedValue(initialError);
    const initial = renderHook(() => useCursorList({
      loadPage: loadInitialPage,
      getKey: (item: Item) => item.id,
    }));
    await waitFor(() => expect(initial.result.current.loading).toBe(false));
    expect(initial.result.current.error).toBe('초기 조회 실패');

    const loadPage = vi.fn()
      .mockResolvedValueOnce(page([{ id: '1', label: '첫 항목' }], 'next', true))
      .mockRejectedValueOnce('실패');
    const more = renderHook(() => useCursorList({
      loadPage,
      getKey: (item: Item) => item.id,
      loadMoreErrorMessage: '목록을 더 불러오지 못했습니다.',
    }));
    await waitFor(() => expect(more.result.current.loading).toBe(false));

    await act(() => more.result.current.loadMore());

    expect(more.result.current.loadMoreError).toBe('목록을 더 불러오지 못했습니다.');
    expect(toastError).toHaveBeenCalledWith('목록을 더 불러오지 못했습니다.');
  });

  it('setItems로 외부 변경을 반영하고 언마운트 시 요청을 취소한다', async () => {
    const nextPage = deferred<CursorPage<Item>>();
    let signal: AbortSignal | undefined;
    const loadPage = vi.fn((_cursor: string | null, options: { signal: AbortSignal }) => {
      signal = options.signal;
      return nextPage.promise;
    });
    const { result, unmount } = renderHook(() => useCursorList({ loadPage, getKey: (item: Item) => item.id }));

    act(() => {
      result.current.setItems([{ id: 'local', label: '로컬 항목' }]);
    });
    expect(result.current.items).toEqual([{ id: 'local', label: '로컬 항목' }]);

    unmount();
    expect(signal?.aborted).toBe(true);
  });
});
