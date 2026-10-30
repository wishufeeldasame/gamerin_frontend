import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, MODERATION_REJECTED_MESSAGE } from '@/lib/api-client';
import {
  createJsonPost,
  createMultipartPost,
  fetchPostVideoJob,
  type MultipartPostResult,
  type PostRecord,
  type PostVideoJob,
} from '@/lib/feed-api';
import { type PostDraft, usePendingPosts, VIDEO_JOB_POLL_INTERVAL_MS } from '@/hooks/usePendingPosts';

vi.mock('@/lib/feed-api', () => ({
  createJsonPost: vi.fn(),
  createMultipartPost: vi.fn(),
  fetchPostVideoJob: vi.fn(),
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
const createdResult: MultipartPostResult = { kind: 'post', post: createdPost };
const videoFile = () => new File(['v'], 'v.mp4', { type: 'video/mp4' });

function videoJob(status: PostVideoJob['status'], overrides: Partial<PostVideoJob> = {}): PostVideoJob {
  return { jobId: 'job-1', status, errorMessage: null, post: null, ...overrides };
}
let objectUrlCount = 0;

describe('usePendingPosts', () => {
  beforeEach(() => {
    objectUrlCount = 0;
    vi.mocked(createJsonPost).mockReset();
    vi.mocked(createMultipartPost).mockReset();
    vi.mocked(fetchPostVideoJob).mockReset();
    URL.createObjectURL = vi.fn(() => `blob:preview-${++objectUrlCount}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('제출 즉시 임시 게시물을 보여주고 성공하면 서버 게시물로 교체한다', async () => {
    const request = deferred<MultipartPostResult>();
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

    await act(async () => request.resolve(createdResult));

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
    const request = deferred<MultipartPostResult>();
    vi.mocked(createMultipartPost).mockReturnValue(request.promise);
    const onCreated = vi.fn();
    const { result, unmount } = renderHook(() => usePendingPosts(onCreated));

    act(() => result.current.submit(draft({ videoFile: videoFile() })));
    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');

    await act(async () => request.resolve(createdResult));
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('영상은 처리 작업이 끝날 때까지 업로드 중으로 두고 완료되면 게시물을 전달하고 완료 알림을 호출한다', async () => {
    vi.useFakeTimers();
    vi.mocked(createMultipartPost).mockResolvedValue({ kind: 'videoJob', job: videoJob('QUEUED') });
    vi.mocked(fetchPostVideoJob)
      .mockResolvedValueOnce(videoJob('PROCESSING'))
      .mockResolvedValueOnce(videoJob('COMPLETED', { post: createdPost }));
    const onCreated = vi.fn();
    const onVideoProcessed = vi.fn();
    const { result } = renderHook(() => usePendingPosts(onCreated, { onVideoProcessed }));

    await act(async () => result.current.submit(draft({ videoFile: videoFile() })));

    expect(result.current.pendingPosts[0]).toMatchObject({ status: 'uploading', phase: 'processing' });
    expect(onCreated).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(VIDEO_JOB_POLL_INTERVAL_MS));
    expect(result.current.pendingPosts).toHaveLength(1);

    await act(async () => vi.advanceTimersByTimeAsync(VIDEO_JOB_POLL_INTERVAL_MS));

    expect(fetchPostVideoJob).toHaveBeenCalledWith('job-1');
    expect(result.current.pendingPosts).toEqual([]);
    expect(onCreated).toHaveBeenCalledWith(createdPost);
    expect(onVideoProcessed).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-1');
  });

  it('서버 처리가 실패하면 서버 문구로 실패 상태가 되고 일시 오류는 다시 확인한다', async () => {
    vi.useFakeTimers();
    vi.mocked(createMultipartPost).mockResolvedValue({ kind: 'videoJob', job: videoJob('QUEUED') });
    vi.mocked(fetchPostVideoJob)
      .mockRejectedValueOnce(new ApiError('Network error', 0, 'unavailable'))
      .mockRejectedValueOnce(new ApiError('Invalid response', 200, 'invalid-response'))
      .mockResolvedValueOnce(videoJob('FAILED', { errorMessage: '영상 처리 시간이 초과됐습니다.' }));
    const onVideoProcessed = vi.fn();
    const { result } = renderHook(() => usePendingPosts(vi.fn(), { onVideoProcessed }));

    await act(async () => result.current.submit(draft({ videoFile: videoFile() })));
    await act(async () => vi.advanceTimersByTimeAsync(VIDEO_JOB_POLL_INTERVAL_MS * 3));

    expect(fetchPostVideoJob).toHaveBeenCalledTimes(3);
    expect(result.current.pendingPosts[0]).toMatchObject({
      status: 'failed',
      errorMessage: '영상 처리 시간이 초과됐습니다.',
    });
    expect(onVideoProcessed).not.toHaveBeenCalled();
  });

  it('파일을 보내는 동안만 페이지 이탈 경고를 켜고 서버 처리 중에는 끈다', async () => {
    vi.useFakeTimers();
    const request = deferred<MultipartPostResult>();
    vi.mocked(createMultipartPost).mockReturnValue(request.promise);
    vi.mocked(fetchPostVideoJob).mockResolvedValue(videoJob('PROCESSING'));
    const addListener = vi.spyOn(window, 'addEventListener');
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { result } = renderHook(() => usePendingPosts(vi.fn()));

    act(() => result.current.submit(draft({ videoFile: videoFile() })));
    expect(addListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    await act(async () => request.resolve({ kind: 'videoJob', job: videoJob('QUEUED') }));

    expect(result.current.pendingPosts[0].phase).toBe('processing');
    expect(removeListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('처리 중에 언마운트하면 상태 확인을 멈춘다', async () => {
    vi.useFakeTimers();
    vi.mocked(createMultipartPost).mockResolvedValue({ kind: 'videoJob', job: videoJob('QUEUED') });
    vi.mocked(fetchPostVideoJob).mockResolvedValue(videoJob('PROCESSING'));
    const { result, unmount } = renderHook(() => usePendingPosts(vi.fn()));

    await act(async () => result.current.submit(draft({ videoFile: videoFile() })));
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(VIDEO_JOB_POLL_INTERVAL_MS * 3));

    expect(fetchPostVideoJob).not.toHaveBeenCalled();
  });
});
