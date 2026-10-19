import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, MODERATION_REJECTED_MESSAGE } from '@/lib/api-client';
import { createJsonPost, createMultipartPost, type PostRecord } from '@/lib/feed-api';
import { type PostDraft, usePendingPosts } from '@/hooks/usePendingPosts';

vi.mock('@/lib/feed-api', () => ({
  createJsonPost: vi.fn(),
  createMultipartPost: vi.fn(),
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

function draft(overrides: Partial<PostDraft> = {}): PostDraft {
  return { content: '첫 게시물', externalLinkUrl: '', imageFiles: [], videoFile: null, thumbnailFile: null, ...overrides };
}

const createdPost = { postId: 'post-1', content: '첫 게시물' } as PostRecord;
let objectUrlCount = 0;

describe('usePendingPosts', () => {
  beforeEach(() => {
    objectUrlCount = 0;
    vi.mocked(createJsonPost).mockReset();
    vi.mocked(createMultipartPost).mockReset();
    URL.createObjectURL = vi.fn(() => `blob:preview-${++objectUrlCount}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('제출 즉시 임시 게시물을 보여주고 성공하면 서버 게시물로 교체한다', async () => {
    const request = deferred<PostRecord>();
    vi.mocked(createMultipartPost).mockReturnValue(request.promise);
    const onCreated = vi.fn();
    const { result } = renderHook(() => usePendingPosts(onCreated));
    const images = [new File(['a'], 'a.png', { type: 'image/png' }), new File(['b'], 'b.png', { type: 'image/png' })];

    act(() => result.current.submit(draft({ imageFiles: images })));

    expect(result.current.pendingPosts).toHaveLength(1);
    expect(result.current.pendingPosts[0]).toMatchObject({
      status: 'uploading',
      previews: [
        { type: 'image', url: 'blob:preview-1' },
        { type: 'image', url: 'blob:preview-2' },
      ],
    });
    const formData = vi.mocked(createMultipartPost).mock.calls[0][0];
    expect(formData.get('content')).toBe('첫 게시물');
    expect(formData.getAll('mediaFiles')).toHaveLength(2);

    await act(async () => request.resolve(createdPost));

    expect(onCreated).toHaveBeenCalledWith(createdPost);
    expect(result.current.pendingPosts).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-2');
  });

  it('실패하면 내용을 유지한 채 실패 상태로 두고 재시도로 같은 내용을 다시 보낸다', async () => {
    vi.mocked(createJsonPost).mockRejectedValueOnce(new ApiError('서버 오류', 500)).mockResolvedValueOnce(createdPost);
    const onCreated = vi.fn();
    const { result } = renderHook(() => usePendingPosts(onCreated));

    await act(async () => result.current.submit(draft()));

    expect(result.current.pendingPosts[0]).toMatchObject({
      status: 'failed',
      errorMessage: '서버 오류',
      draft: { content: '첫 게시물' },
    });

    await act(async () => result.current.retry(result.current.pendingPosts[0].id));

    expect(createJsonPost).toHaveBeenCalledTimes(2);
    expect(createJsonPost).toHaveBeenLastCalledWith({ content: '첫 게시물', externalLinkUrl: '' });
    expect(onCreated).toHaveBeenCalledWith(createdPost);
    expect(result.current.pendingPosts).toEqual([]);
  });

  it('검열 거부(422)는 정책 위반 문구로 표시하고 삭제하면 미리보기 URL을 해제한다', async () => {
    vi.mocked(createMultipartPost).mockRejectedValue(new ApiError('Content violates moderation policy: x', 422));
    const { result } = renderHook(() => usePendingPosts(vi.fn()));

    await act(async () => result.current.submit(draft({ imageFiles: [new File(['a'], 'a.png')] })));

    expect(result.current.pendingPosts[0].errorMessage).toBe(MODERATION_REJECTED_MESSAGE);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    act(() => result.current.discard(result.current.pendingPosts[0].id));

    expect(result.current.pendingPosts).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('언마운트하면 남은 미리보기 URL을 해제하고 늦은 응답은 반영하지 않는다', async () => {
    const request = deferred<PostRecord>();
    vi.mocked(createMultipartPost).mockReturnValue(request.promise);
    const onCreated = vi.fn();
    const { result, unmount } = renderHook(() => usePendingPosts(onCreated));

    act(() => result.current.submit(draft({ videoFile: new File(['v'], 'v.mp4', { type: 'video/mp4' }) })));
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');

    await act(async () => request.resolve(createdPost));
    expect(onCreated).not.toHaveBeenCalled();
  });
});
