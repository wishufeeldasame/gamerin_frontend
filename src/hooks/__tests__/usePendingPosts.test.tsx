import { act, renderHook } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { createJsonPost, createPostUpload, fetchPostUploadJob, type PostRecord } from '@/lib/feed-api';
import { usePendingPosts, type PostDraft, VIDEO_JOB_POLL_INTERVAL_MS } from '@/hooks/usePendingPosts';
import { loadUploadRecords, saveUploadRecord, type UploadJob } from '@/lib/upload-jobs';
import { setAccessToken, clearStoredAuth } from '@/lib/auth-store';

vi.mock('@/lib/feed-api', () => ({ createJsonPost: vi.fn(), createPostUpload: vi.fn(), fetchPostUploadJob: vi.fn() }));
const post = { postId: 'p-1', postNumber: 1 } as PostRecord;
const draft = (media = true): PostDraft => ({ content: '본문', imageFiles: media ? [new File(['a'], 'a.png')] : [], videoFile: null, thumbnailFile: null });
const job = (status: UploadJob['status'], overrides: Partial<UploadJob> = {}): UploadJob => ({
  jobId: 'j-1', status, errorCode: null, errorMessage: null, post: null, message: null, ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear(); setAccessToken('test');
  URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.useRealTimers(); });

describe('usePendingPosts', () => {
  it('텍스트만 작성하면 기존 동기 요청을 유지한다', async () => {
    vi.mocked(createJsonPost).mockResolvedValue(post);
    const onCreated = vi.fn();
    const { result } = renderHook(() => usePendingPosts(onCreated));
    await act(async () => result.current.submit(draft(false)));
    expect(createJsonPost).toHaveBeenCalledWith({ content: '본문' });
    expect(createPostUpload).not.toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(post);
  });

  it('접수·처리 중 상태와 이탈 경고를 구분하고 완료 시 교체한다', async () => {
    vi.useFakeTimers();
    let resolve!: (value: UploadJob) => void;
    vi.mocked(createPostUpload).mockReturnValue(new Promise((done) => { resolve = done; }));
    vi.mocked(fetchPostUploadJob).mockResolvedValueOnce(job('PROCESSING')).mockResolvedValueOnce(job('COMPLETED', { post }));
    const onCreated = vi.fn(); const onVideoProcessed = vi.fn();
    const { result } = renderHook(() => usePendingPosts(onCreated, { userId: 'u-1', onVideoProcessed }));
    act(() => result.current.submit(draft()));
    const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    const key = result.current.pendingPosts[0].id;
    expect(createPostUpload).toHaveBeenCalledWith(expect.any(FormData), key);
    expect(localStorage.getItem('gamerin_upload_jobs')).not.toContain('본문');
    await act(async () => resolve(job('QUEUED')));
    expect(result.current.pendingPosts[0].phase).toBe('queued');
    const acceptedEvent = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(acceptedEvent);
    expect(acceptedEvent.defaultPrevented).toBe(false);
    await act(async () => vi.advanceTimersByTimeAsync(VIDEO_JOB_POLL_INTERVAL_MS));
    expect(result.current.pendingPosts[0].phase).toBe('processing');
    await act(async () => vi.advanceTimersByTimeAsync(VIDEO_JOB_POLL_INTERVAL_MS));
    expect(onCreated).toHaveBeenCalledWith(post); expect(onVideoProcessed).toHaveBeenCalledWith(post);
    expect(result.current.pendingPosts).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });

  it('통신 장애에서는 키를 유지하고 404 확인 뒤 같은 원본을 재전송한다', async () => {
    vi.mocked(createPostUpload).mockRejectedValueOnce(new ApiError('통신', 0)).mockResolvedValueOnce(job('COMPLETED', { post }));
    vi.mocked(fetchPostUploadJob).mockRejectedValue(new ApiError('없음', 404));
    const { result } = renderHook(() => usePendingPosts(vi.fn(), { userId: 'u-1' }));
    await act(async () => result.current.submit(draft()));
    const key = result.current.pendingPosts[0].id;
    expect(result.current.pendingPosts[0].status).toBe('unavailable');
    await act(async () => result.current.retry(key));
    expect(vi.mocked(createPostUpload).mock.calls.map((call) => call[1])).toEqual([key, key]);
    expect(fetchPostUploadJob).toHaveBeenCalledWith(key, true);
  });

  it('명시적 시스템 실패 재시도만 새 키를 만들고 검열 거부는 새 작성으로 안내한다', async () => {
    vi.mocked(createPostUpload).mockResolvedValueOnce(job('FAILED', { errorCode: 'PROCESSING_FAILED', errorMessage: '처리 실패' }))
      .mockResolvedValueOnce(job('FAILED', { errorCode: 'MODERATION_REJECTED', errorMessage: '검열 거부' }));
    const { result } = renderHook(() => usePendingPosts(vi.fn()));
    await act(async () => result.current.submit(draft()));
    const oldKey = result.current.pendingPosts[0].id;
    await act(async () => result.current.retry(oldKey));
    expect(vi.mocked(createPostUpload).mock.calls[1][1]).not.toBe(oldKey);
    expect(result.current.pendingPosts[0].status).toBe('rejected');
    act(() => result.current.retry(result.current.pendingPosts[0].id));
    expect(createPostUpload).toHaveBeenCalledTimes(2);
  });

  it('복귀하면 같은 사용자 메타데이터만 조회하며 원본 없는 404를 표시한다', async () => {
    saveUploadRecord({ userId: 'u-1', kind: 'post', clientId: 'key-1' });
    saveUploadRecord({ userId: 'u-2', kind: 'post', clientId: 'key-2' });
    vi.mocked(fetchPostUploadJob).mockRejectedValue(new ApiError('없음', 404));
    const { result } = renderHook(() => usePendingPosts(vi.fn(), { userId: 'u-1' }));
    await act(async () => {});
    expect(fetchPostUploadJob).toHaveBeenCalledWith('key-1', true);
    expect(result.current.pendingPosts[0]).toMatchObject({ status: 'missing', hasOriginal: false });
    await act(async () => result.current.retry('key-1'));
    expect(createPostUpload).not.toHaveBeenCalled();
    expect(loadUploadRecords('u-2', 'post')).toHaveLength(1);
  });

  it.each(['unmount', 'auth'])('%s 뒤 늦은 접수 결과는 반영하지 않는다', async (mode) => {
    let resolve!: (value: UploadJob) => void;
    vi.mocked(createPostUpload).mockReturnValue(new Promise((done) => { resolve = done; }));
    const onCreated = vi.fn();
    const { result, unmount } = renderHook(() => usePendingPosts(onCreated, { userId: 'u-1' }));
    act(() => result.current.submit(draft()));
    if (mode === 'unmount') unmount(); else clearStoredAuth();
    await act(async () => resolve(job('COMPLETED', { post })));
    expect(onCreated).not.toHaveBeenCalled(); expect(fetchPostUploadJob).not.toHaveBeenCalled();
    expect(loadUploadRecords('u-1', 'post')).toHaveLength(1);
  });
  it('동영상·썸네일도 같은 비동기 경로에 원본 그대로 보낸다', async () => {
    vi.mocked(createPostUpload).mockResolvedValue(job('COMPLETED', { post }));
    const videoFile = new File(['video'], 'v.mp4', { type: 'video/mp4' });
    const thumbnailFile = new File(['thumb'], 'thumb.jpg', { type: 'image/jpeg' });
    const { result } = renderHook(() => usePendingPosts(vi.fn()));
    await act(async () => result.current.submit({ ...draft(false), videoFile, thumbnailFile }));
    const form = vi.mocked(createPostUpload).mock.calls[0][0];
    expect(form.get('mediaFiles')).toBe(videoFile);
    expect(form.get('thumbnailFile')).toBe(thumbnailFile);
  });

});
