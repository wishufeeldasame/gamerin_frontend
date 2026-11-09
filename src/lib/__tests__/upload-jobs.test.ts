import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { trackUpload, loadUploadRecords, saveUploadRecord, assertUploadJob, UPLOAD_POLL_INTERVAL_MS,
  type UploadJob, type UploadRecord } from '@/lib/upload-jobs';

const record = (): UploadRecord => ({ userId: 'u-1', kind: 'post', clientId: 'client-1' });
const job = (status: UploadJob['status'], overrides: Partial<UploadJob> = {}): UploadJob => ({
  jobId: 'job-1', status, errorCode: null, errorMessage: null, post: null, message: null, ...overrides,
});
const notFound = () => new ApiError('없음', 404);

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('비동기 업로드 추적', () => {
  it('불완전한 작업 응답을 완료·실패로 확정하지 않는다', () => {
    expect(() => assertUploadJob({ ...job('COMPLETED'), message: undefined } as unknown as UploadJob))
      .toThrow('업로드 상태 응답을 확인할 수 없습니다.');
    expect(() => assertUploadJob(job('FAILED', { errorCode: 'PROCESSING_FAILED' })))
      .toThrow('업로드 상태 응답을 확인할 수 없습니다.');
  });
  it('접수 뒤 조회만 하고 완료 시 복원 메타데이터를 지운다', async () => {
    const send = vi.fn().mockResolvedValue(job('QUEUED'));
    const fetchJob = vi.fn().mockResolvedValueOnce(job('PROCESSING')).mockResolvedValueOnce(job('COMPLETED'));
    const onPhase = vi.fn();
    const promise = trackUpload(record(), { send, fetchJob, onPhase, active: () => true });
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 2);
    expect(await promise).toMatchObject({ status: 'COMPLETED', post: null });
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetchJob.mock.calls).toEqual([['job-1', false], ['job-1', false]]);
    expect(onPhase.mock.calls.flat()).toEqual(['sending', 'queued', 'processing']);
    expect(loadUploadRecords('u-1', 'post')).toEqual([]);
  });

  it('접수 응답 유실은 같은 키 조회로 복구하고 다시 전송하지 않는다', async () => {
    const send = vi.fn().mockRejectedValue(new ApiError('네트워크', 0));
    const fetchJob = vi.fn().mockResolvedValue(job('COMPLETED'));
    await trackUpload(record(), { send, fetchJob, onPhase: vi.fn(), active: () => true });
    expect(fetchJob).toHaveBeenCalledWith('client-1', true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('조회도 실패하면 불확정으로 남기고 수동 재확인에서 404일 때 같은 키로만 재전송한다', async () => {
    const target = record();
    const send = vi.fn().mockRejectedValueOnce(new ApiError('응답 유실', 0)).mockResolvedValue(job('COMPLETED'));
    const fetchJob = vi.fn().mockRejectedValue(notFound());
    const options = { send, fetchJob, onPhase: vi.fn(), active: () => true };
    await expect(trackUpload(target, options)).rejects.toMatchObject({ kind: 'unavailable' });
    expect(loadUploadRecords('u-1', 'post')[0].clientId).toBe('client-1');
    await trackUpload(target, { ...options, recover: true });
    expect(target.clientId).toBe('client-1');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('접수된 작업의 통신 장애 후에는 jobId로 조회만 재시도한다', async () => {
    const target = { ...record(), jobId: 'job-1' };
    const send = vi.fn();
    const fetchJob = vi.fn().mockRejectedValueOnce(new ApiError('장애', 503)).mockResolvedValue(job('COMPLETED'));
    const options = { send, fetchJob, onPhase: vi.fn(), active: () => true };
    await expect(trackUpload(target, options)).rejects.toMatchObject({ kind: 'unavailable' });
    await trackUpload(target, options);
    expect(send).not.toHaveBeenCalled();
    expect(fetchJob.mock.calls).toEqual([['job-1', false], ['job-1', false]]);
  });

  it.each(['MODERATION_REJECTED', 'PROCESSING_FAILED', 'INVALID_UPLOAD'])('%s를 통신 장애와 구분한다', async (errorCode) => {
    const fetchJob = vi.fn().mockResolvedValue(job('FAILED', { errorCode, errorMessage: '사용자용 사유' }));
    await expect(trackUpload(record(), { recover: true, fetchJob, onPhase: vi.fn(), active: () => true }))
      .rejects.toMatchObject({ kind: errorCode === 'MODERATION_REJECTED' ? 'rejected' : 'failed', message: '사용자용 사유' });
    expect(loadUploadRecords('u-1', 'post')).toHaveLength(1);
  });

  it('새로고침 뒤 원본 없이 404이면 재전송하지 않는다', async () => {
    await expect(trackUpload(record(), { recover: true, fetchJob: vi.fn().mockRejectedValue(notFound()),
      onPhase: vi.fn(), active: () => true })).rejects.toMatchObject({ kind: 'missing' });
  });

  it('접수된 jobId가 404여도 파일을 다시 보내지 않는다', async () => {
    const send = vi.fn();
    await expect(trackUpload({ ...record(), jobId: 'gone' }, { send,
      fetchJob: vi.fn().mockRejectedValue(notFound()), onPhase: vi.fn(), active: () => true }))
      .rejects.toMatchObject({ kind: 'missing' });
    expect(send).not.toHaveBeenCalled();
  });

  it('400 응답과 키 조회 404는 통신 장애가 아닌 접수 거절로 표시한다', async () => {
    await expect(trackUpload(record(), { send: vi.fn().mockRejectedValue(new ApiError('잘못된 파일', 400)),
      fetchJob: vi.fn().mockRejectedValue(notFound()), onPhase: vi.fn(), active: () => true }))
      .rejects.toMatchObject({ kind: 'invalid', message: '요청을 접수하지 못했습니다. 잘못된 파일' });
  });

  it('처리 중 화면을 해제하면 다음 폴링 요청을 보내지 않는다', async () => {
    let active = true;
    const fetchJob = vi.fn();
    const promise = trackUpload(record(), { send: vi.fn().mockResolvedValue(job('QUEUED')), fetchJob,
      onPhase: () => { active = false; }, active: () => active });
    const checked = expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await checked;
    expect(fetchJob).not.toHaveBeenCalled();
  });

  it('인증 전환·해제 뒤 늦은 응답으로 완료를 반영하거나 메타데이터를 지우지 않는다', async () => {
    let active = true;
    let resolve!: (value: UploadJob) => void;
    const promise = trackUpload(record(), { send: () => new Promise((done) => { resolve = done; }),
      fetchJob: vi.fn(), onPhase: vi.fn(), active: () => active });
    active = false;
    resolve(job('COMPLETED'));
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(loadUploadRecords('u-1', 'post')).toHaveLength(1);
  });

  it('복원은 사용자와 종류로 제한하고 비허용 저장 필드는 읽지 않는다', () => {
    saveUploadRecord(record());
    saveUploadRecord({ userId: 'u-2', kind: 'message', conversationId: 'c-1', clientId: 'dm-1' });
    expect(loadUploadRecords('u-1', 'message')).toEqual([]);
    expect(loadUploadRecords('u-2', 'post')).toEqual([]);
    localStorage.setItem('gamerin_upload_jobs', JSON.stringify([{ ...record(), content: 'secret', token: 'secret', file: {} }]));
    expect(loadUploadRecords('u-1', 'post')).toEqual([record()]);
  });
});
