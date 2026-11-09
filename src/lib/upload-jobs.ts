import { ApiError, isAuthError } from '@/lib/api-client';
import type { PostRecord } from '@/lib/feed-api';
import type { ChatMessage } from '@/lib/message-store';

export type UploadJob = {
  jobId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  errorCode: string | null;
  errorMessage: string | null;
  post: PostRecord | null;
  message: ChatMessage | null;
};

export type UploadRecord = {
  userId: string;
  kind: 'post' | 'message';
  clientId: string;
  conversationId?: string;
  jobId?: string;
};

export type UploadPhase = 'sending' | 'queued' | 'processing' | 'unavailable' | 'missing';
export const UPLOAD_POLL_INTERVAL_MS = 3000;
export const UPLOAD_PHASE_LABELS: Record<UploadPhase, string> = {
  sending: '파일 전송 중…',
  queued: '서버 접수 완료 · 처리 대기 중. 화면을 떠나도 계속 처리됩니다.',
  processing: '서버 처리 중. 화면을 떠나도 계속 처리됩니다.',
  unavailable: '통신 장애로 접수·처리 상태를 확인할 수 없습니다. 상태를 다시 확인해 주세요.',
  missing: '작업을 찾을 수 없습니다. 원본이 없는 경우 파일을 다시 선택하기 전에 게시 여부를 확인해 주세요.',
};

const STORAGE_KEY = 'gamerin_upload_jobs';

// 파일·본문·토큰은 저장하지 않는다. 읽을 때도 허용한 메타데이터만 취한다.
function readRecords(): UploadRecord[] {
  try {
    const values: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(values)) return [];
    return values.flatMap((value) => {
      if (!value || typeof value !== 'object' || typeof value.userId !== 'string' ||
        typeof value.clientId !== 'string' || !['post', 'message'].includes(value.kind) ||
        (value.kind === 'message' && typeof value.conversationId !== 'string')) return [];
      return [{ userId: value.userId, kind: value.kind, clientId: value.clientId,
        ...(typeof value.conversationId === 'string' ? { conversationId: value.conversationId } : {}),
        ...(typeof value.jobId === 'string' ? { jobId: value.jobId } : {}) }];
    });
  } catch { return []; }
}

export function loadUploadRecords(userId: string, kind: UploadRecord['kind']) {
  return readRecords().filter((record) => record.userId === userId && record.kind === kind);
}

export function saveUploadRecord(record: UploadRecord) {
  if (!record.userId) return;
  const records = readRecords().filter((item) => !sameRecord(item, record));
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...records, record])); } catch { /* 저장이 막혀도 현재 화면의 메모리로 추적한다. */ }
}

function sameRecord(left: UploadRecord, right: UploadRecord) {
  return left.userId === right.userId && left.kind === right.kind && left.clientId === right.clientId;
}

export function removeUploadRecord(record: UploadRecord) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readRecords().filter((item) => !sameRecord(item, record)))); } catch { /* 저장이 막혀도 화면 조작은 계속한다. */ }
}

export function assertUploadJob(value: UploadJob): UploadJob {
  if (!value || typeof value.jobId !== 'string' || !value.jobId.trim() ||
    !['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(value.status) ||
    !(value.post === null || (typeof value.post === 'object' && !Array.isArray(value.post))) ||
    !(value.message === null || (typeof value.message === 'object' && !Array.isArray(value.message))) ||
    (value.status === 'FAILED'
      ? typeof value.errorCode !== 'string' || !value.errorCode.trim() ||
        typeof value.errorMessage !== 'string' || !value.errorMessage.trim() || value.post !== null || value.message !== null
      : value.errorCode !== null || value.errorMessage !== null) ||
    ((value.status === 'QUEUED' || value.status === 'PROCESSING') && (value.post !== null || value.message !== null))) {
    throw new ApiError('업로드 상태 응답을 확인할 수 없습니다.', 0, 'invalid-response');
  }
  return value;
}

export class UploadJobError extends Error {
  constructor(public readonly kind: 'rejected' | 'failed' | 'invalid' | 'unavailable' | 'missing', message: string) {
    super(message);
  }
}

/** 접수 이후에는 조회만 한다. 응답 유실 뒤에는 같은 키 조회 후 원본이 있을 때만 재전송한다. */
export async function trackUpload(record: UploadRecord, options: {
  recover?: boolean;
  send?: () => Promise<UploadJob>;
  fetchJob: (id: string, byClientId: boolean) => Promise<UploadJob>;
  active: () => boolean;
  onPhase: (phase: UploadPhase) => void;
}) {
  const ensureActive = () => { if (!options.active()) throw new DOMException('Upload disposed', 'AbortError'); };
  const lookup = () => options.fetchJob(record.jobId ?? record.clientId, !record.jobId);
  let job: UploadJob | undefined;
  ensureActive();
  saveUploadRecord(record);
  try {
    if (record.jobId || options.recover) {
      try { job = await lookup(); } catch (error) {
        ensureActive();
        if (!(error instanceof ApiError && error.status === 404 && !record.jobId && options.send)) throw error;
      }
    }
    ensureActive();
    if (!job) {
      if (!options.send) throw new UploadJobError('missing', UPLOAD_PHASE_LABELS.missing);
      options.onPhase('sending');
      try { job = await options.send(); } catch (error) {
        ensureActive();
        if (isAuthError(error) || (error instanceof Error && error.name === 'AbortError')) throw error;
        // 전송 응답을 잃어도 이미 접수됐을 수 있다. 새 키나 자동 재전송을 만들지 않는다.
        try { job = await lookup(); } catch (lookupError) {
          ensureActive();
          if (isAuthError(lookupError)) throw lookupError;
          if (lookupError instanceof ApiError && lookupError.status === 404 && error instanceof ApiError &&
            [400, 403, 409, 413, 422].includes(error.status)) {
            throw new UploadJobError('invalid', `요청을 접수하지 못했습니다. ${error.message}`);
          }
          throw new UploadJobError('unavailable', `${UPLOAD_PHASE_LABELS.unavailable} ${error instanceof Error ? error.message : ''}`);
        }
      }
    }
    ensureActive();
    job = assertUploadJob(job);
    record.jobId = job.jobId;
    saveUploadRecord(record);
    while (job.status === 'QUEUED' || job.status === 'PROCESSING') {
      options.onPhase(job.status === 'QUEUED' ? 'queued' : 'processing');
      await new Promise((resolve) => setTimeout(resolve, UPLOAD_POLL_INTERVAL_MS));
      ensureActive();
      job = assertUploadJob(await lookup());
      ensureActive();
    }
    if (job.status === 'FAILED') {
      throw new UploadJobError(job.errorCode === 'MODERATION_REJECTED' ? 'rejected' : 'failed', job.errorMessage!);
    }
    removeUploadRecord(record);
    return job;
  } catch (error) {
    ensureActive();
    if (error instanceof UploadJobError || isAuthError(error) || (error instanceof Error && error.name === 'AbortError')) throw error;
    throw new UploadJobError(error instanceof ApiError && error.status === 404 ? 'missing' : 'unavailable',
      error instanceof ApiError && error.status === 404 ? UPLOAD_PHASE_LABELS.missing : UPLOAD_PHASE_LABELS.unavailable);
  }
}
