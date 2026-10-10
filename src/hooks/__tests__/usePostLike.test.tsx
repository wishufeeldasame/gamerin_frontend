import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { likePost, unlikePost } from '@/lib/feed-api';
import { usePostLike } from '@/hooks/usePostLike';

const toastError = vi.fn();

vi.mock('@/app/context/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: toastError,
    info: vi.fn(),
  }),
}));

vi.mock('@/lib/feed-api', () => ({
  likePost: vi.fn(),
  unlikePost: vi.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('usePostLike', () => {
  beforeEach(() => {
    vi.mocked(likePost).mockResolvedValue(undefined);
    vi.mocked(unlikePost).mockResolvedValue(undefined);
  });

  it('좋아요를 낙관적으로 적용하고 성공 상태를 유지한다', async () => {
    const request = deferred<void>();
    vi.mocked(likePost).mockReturnValue(request.promise);
    const applyLikeState = vi.fn();
    const { result } = renderHook(() => usePostLike(applyLikeState));

    let togglePromise!: Promise<void>;
    act(() => {
      togglePromise = result.current.toggleLike({ postId: 'post-1', likedByMe: false });
    });

    expect(applyLikeState).toHaveBeenCalledWith('post-1', true);
    expect(result.current.likeLoadingByPostId['post-1']).toBe(true);

    await act(async () => {
      request.resolve();
      await togglePromise;
    });

    expect(applyLikeState).toHaveBeenCalledTimes(1);
    expect(result.current.likeLoadingByPostId['post-1']).toBeUndefined();
  });

  it('좋아요 해제를 요청한다', async () => {
    const applyLikeState = vi.fn();
    const { result } = renderHook(() => usePostLike(applyLikeState));

    await act(() => result.current.toggleLike({ postId: 'post-1', likedByMe: true }));

    expect(unlikePost).toHaveBeenCalledWith('post-1');
    expect(applyLikeState).toHaveBeenCalledWith('post-1', false);
  });

  it('실패하면 클릭 시점 상태만 롤백하고 서버 메시지를 표시한다', async () => {
    const request = deferred<void>();
    vi.mocked(likePost).mockReturnValue(request.promise);
    const state = {
      likedByMe: false,
      bookmarkedByMe: false,
      isReposted: false,
    };
    const applyLikeState = vi.fn((_postId: string, likedByMe: boolean) => {
      state.likedByMe = likedByMe;
    });
    const { result } = renderHook(() => usePostLike(applyLikeState));

    let togglePromise!: Promise<void>;
    act(() => {
      togglePromise = result.current.toggleLike({ postId: 'post-1', likedByMe: false });
    });
    state.bookmarkedByMe = true;
    state.isReposted = true;

    await act(async () => {
      request.reject(new Error('서버에서 좋아요를 처리하지 못했습니다.'));
      await togglePromise;
    });

    expect(state).toEqual({
      likedByMe: false,
      bookmarkedByMe: true,
      isReposted: true,
    });
    expect(applyLikeState).toHaveBeenNthCalledWith(1, 'post-1', true);
    expect(applyLikeState).toHaveBeenNthCalledWith(2, 'post-1', false);
    expect(toastError).toHaveBeenCalledWith('서버에서 좋아요를 처리하지 못했습니다.');
    expect(result.current.likeLoadingByPostId['post-1']).toBeUndefined();
  });

  it('주입된 콜백으로 여러 목록의 좋아요 상태를 함께 갱신한다', async () => {
    const state = { list: false, overview: false };
    const applyLikeState = vi.fn((_postId: string, likedByMe: boolean) => {
      state.list = likedByMe;
      state.overview = likedByMe;
    });
    const { result } = renderHook(() => usePostLike(applyLikeState));

    await act(() => result.current.toggleLike({ postId: 'post-1', likedByMe: false }));

    expect(state).toEqual({ list: true, overview: true });
    expect(applyLikeState).toHaveBeenCalledWith('post-1', true);
  });

  it('같은 게시물의 중복 요청은 무시한다', async () => {
    const request = deferred<void>();
    vi.mocked(likePost).mockReturnValue(request.promise);
    const applyLikeState = vi.fn();
    const { result } = renderHook(() => usePostLike(applyLikeState));

    let firstPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.toggleLike({ postId: 'post-1', likedByMe: false });
      void result.current.toggleLike({ postId: 'post-1', likedByMe: false });
    });

    expect(likePost).toHaveBeenCalledTimes(1);
    expect(applyLikeState).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve();
      await firstPromise;
    });
  });

  it('서로 다른 게시물 요청은 동시에 처리한다', async () => {
    const firstRequest = deferred<void>();
    const secondRequest = deferred<void>();
    vi.mocked(likePost)
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);
    const applyLikeState = vi.fn();
    const { result } = renderHook(() => usePostLike(applyLikeState));

    let firstPromise!: Promise<void>;
    let secondPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.toggleLike({ postId: 'post-1', likedByMe: false });
      secondPromise = result.current.toggleLike({ postId: 'post-2', likedByMe: false });
    });

    expect(result.current.likeLoadingByPostId).toEqual({ 'post-1': true, 'post-2': true });
    expect(likePost).toHaveBeenCalledTimes(2);

    await act(async () => {
      firstRequest.resolve();
      secondRequest.resolve();
      await Promise.all([firstPromise, secondPromise]);
    });

    expect(result.current.likeLoadingByPostId).toEqual({});
  });
});
