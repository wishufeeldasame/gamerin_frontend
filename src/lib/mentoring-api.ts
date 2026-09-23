import { ApiError, type ApiRequestOptions, apiRequest } from '@/lib/api-client';

const MENTORING_BASE = '/api/v1/mentoring';

export type MentorStatus = 'ACTIVE' | 'INACTIVE' | string;
export type ProgramStatus = 'ACTIVE' | 'CLOSED';
export type ApplicationStatus =
  | 'APPLIED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ONGOING'
  | 'FINISHED'
  | 'COMPLETED'
  | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'ESCROW_HELD' | 'SETTLED' | 'REFUNDED';

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
  numberOfElements?: number;
}

export interface MentorProfileResponse {
  userId: string;
  nickname: string;
  status: MentorStatus;
  about: string;
  ratingAvg: number;
  reviewCount: number;
  menteeCount: number;
}

export interface MentoringProgramResponse {
  id: string;
  mentorId: string;
  mentorNickName?: string;
  mentorNickname?: string;
  gameName: string;
  title: string;
  content: string | null;
  availableTimeDesc: string | null;
  status: ProgramStatus;
  price: number;
  tags: string[] | null;
  createdAt: string;
}

export interface MentoringProgramDetailResponse {
  id: string;
  mentorId: string;
  mentorNickname: string;
  mentorAbout: string;
  gameName: string;
  title: string;
  content: string | null;
  availableTimeDesc: string | null;
  status: ProgramStatus;
  price: number;
  tags: string[] | null;
  createdAt: string;
}

export interface MentoringApplicationResponse {
  id: string;
  programId: string;
  programTitle: string;
  mentorId: string;
  mentorNickname: string;
  menteeId: string;
  menteeNickname: string;
  appliedMileage: number;
  status: ApplicationStatus;
  paymentStatus: PaymentStatus;
  message: string;
  createdAt: string;
  reviewed: boolean;
}

export interface MentoringReviewResponse {
  id: string;
  applicationId: string;
  programId: string;
  programTitle: string;
  menteeNickname: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface MentoringProgramRequest {
  gameName: string;
  title: string;
  content: string;
  availableTimeDesc: string;
  price: number;
  tags: string[];
}

export interface MentoringProgramUpdateRequest {
  title: string;
  content: string;
  availableTimeDesc: string;
  price: number;
  status: ProgramStatus;
  tags: string[];
}

type RequestOptions = ApiRequestOptions & {
  authRequired?: boolean;
};

export class MentoringAuthError extends Error {
  constructor() {
    super('로그인이 필요하거나 인증이 만료되었습니다. 다시 로그인해주세요.');
    this.name = 'MentoringAuthError';
  }
}

export class MentoringApiError extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'MentoringApiError';
  }
}

export function isMentoringAuthError(error: unknown): error is MentoringAuthError {
  return (
    error instanceof MentoringAuthError ||
    (error instanceof Error &&
      (error.message.includes('로그인이 필요') ||
        error.message.includes('Authentication is required') ||
        error.message.includes('sign in again') ||
        error.message.includes('token has expired')))
  );
}

export function isMentoringNotFoundError(error: unknown): error is MentoringApiError {
  return error instanceof MentoringApiError && error.status === 404;
}

// authRequired: false는 미리 refresh하지 않고 토큰 없이도 보낸다는 뜻일 뿐, 서버가 공개로 허용한다는 뜻은 아니다.
// backend SecurityConfig에서 /api/v1/mentoring/** 는 모두 인증이 필요하다.
function mentoringRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authRequired = true, ...fetchOptions } = options;

  return apiRequest<T>(
    path,
    {
      authRequired,
      envelope: 'optional',
      toError: ({ reason, status, message }) => {
        if (reason === 'http' && status === 404) {
          return new MentoringApiError(message ?? 'Mentoring resource was not found.', status);
        }

        if (reason === 'unauthenticated' || (reason === 'http' && status === 401)) {
          return authRequired
            ? new MentoringAuthError()
            : new Error('멘토링 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        }

        return new Error(message || '멘토링 요청 처리에 실패했습니다.');
      },
    },
    fetchOptions,
  );
}

export function emptyPage<T>(page = 0, size = 10): PageResponse<T> {
  return {
    content: [],
    totalPages: 0,
    totalElements: 0,
    number: page,
    size,
    first: true,
    last: true,
    empty: true,
    numberOfElements: 0,
  };
}

export function registerMentor(payload: { about: string }) {
  return mentoringRequest<MentorProfileResponse>(`${MENTORING_BASE}/mentors`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMentorProfile(mentorId: string) {
  return mentoringRequest<MentorProfileResponse>(`${MENTORING_BASE}/mentors/${mentorId}`, {
    authRequired: false,
  });
}

export function fetchMyMentorProfile() {
  return mentoringRequest<MentorProfileResponse | null>(`${MENTORING_BASE}/mentors/me`);
}

export function createMentoringProgram(payload: MentoringProgramRequest) {
  return mentoringRequest<MentoringProgramResponse>(`${MENTORING_BASE}/programs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMentoringPrograms(params: {
  gameName?: string;
  page?: number;
  size?: number;
}) {
  const search = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 10),
  });

  if (params.gameName) {
    search.set('gameName', params.gameName);
  }

  return mentoringRequest<PageResponse<MentoringProgramResponse>>(
    `${MENTORING_BASE}/programs?${search.toString()}`,
    { authRequired: false }
  );
}

export function fetchMentoringProgramDetail(programId: string) {
  return mentoringRequest<MentoringProgramDetailResponse>(`${MENTORING_BASE}/programs/${programId}`, {
    authRequired: false,
  });
}

export function updateMentoringProgram(programId: string, payload: MentoringProgramUpdateRequest) {
  return mentoringRequest<MentoringProgramResponse>(`${MENTORING_BASE}/programs/${programId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMentoringProgram(programId: string) {
  await mentoringRequest<null>(`${MENTORING_BASE}/programs/${programId}`, {
    method: 'DELETE',
  });
}

export function applyToMentoringProgram(payload: { programId: string; message: string }) {
  return mentoringRequest<MentoringApplicationResponse>(`${MENTORING_BASE}/applications`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMenteeApplications(page = 0, size = 10) {
  return mentoringRequest<PageResponse<MentoringApplicationResponse>>(
    `${MENTORING_BASE}/applications/mentee?page=${page}&size=${size}`
  );
}

export function fetchMentorApplications(page = 0, size = 10) {
  return mentoringRequest<PageResponse<MentoringApplicationResponse>>(
    `${MENTORING_BASE}/applications/mentor?page=${page}&size=${size}`
  );
}

export function acceptMentoringApplication(applicationId: string) {
  return mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/accept`,
    { method: 'PATCH' }
  );
}

export function rejectMentoringApplication(applicationId: string) {
  return mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/reject`,
    { method: 'PATCH' }
  );
}

export function cancelMentoringApplication(applicationId: string) {
  return mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/cancel`,
    { method: 'PATCH' }
  );
}

export function startMentoringApplication(applicationId: string) {
  return mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/start`,
    { method: 'PATCH' }
  );
}

export function finishMentoringApplication(applicationId: string) {
  return mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/finish`,
    { method: 'PATCH' }
  );
}

export function completeMentoringApplication(applicationId: string) {
  return mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/complete`,
    { method: 'PATCH' }
  );
}

export function createMentoringReview(payload: {
  applicationId: string;
  rating: number;
  content: string;
}) {
  return mentoringRequest<MentoringReviewResponse>(`${MENTORING_BASE}/reviews`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMentorReviews(mentorId: string, page = 0, size = 10) {
  return mentoringRequest<PageResponse<MentoringReviewResponse>>(
    `${MENTORING_BASE}/mentors/${mentorId}/reviews?page=${page}&size=${size}`
  );
}
