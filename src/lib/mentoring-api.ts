import { ApiError, AUTH_REQUIRED_MESSAGE, type ApiFailureReason, type ApiRequestOptions, type ApiClientConfig, apiRequest } from '@/lib/api-client';
import type { PageResponse } from '@/types/api';
import { invalidateMileageAfter } from '@/lib/mileage-sync';
import type { RepresentativeTier } from '@/lib/representative-tier';

const MENTORING_BASE = '/api/v1/mentoring';

export type MentorStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE' | string;
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

export interface MentorProfileResponse {
  userId: string;
  nickname: string;
  status: MentorStatus;
  about: string;
  ratingAvg: number;
  reviewCount: number;
  menteeCount: number;
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
}

export interface GameResponse {
  code: string;
  name: string;
}

export interface MentoringProgramResponse {
  id: string;
  /** URL용 짧은 숫자 번호 */
  publicNo?: number;
  mentorId: string;
  mentorNickName?: string;
  mentorNickname?: string;
  /** 멘토 프로필 이동용 핸들 */
  mentorHandle?: string;
  gameName: string;
  title: string;
  content: string | null;
  availableTimeDesc: string | null;
  status: ProgramStatus;
  price: number;
  tags: string[] | null;
  createdAt: string;
  /** 멘토의 멤버십 배지 */
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
}

export interface MentoringProgramDetailResponse {
  id: string;
  /** URL용 짧은 숫자 번호 */
  publicNo?: number;
  mentorId: string;
  mentorNickname: string;
  mentorHandle?: string;
  mentorAbout: string;
  gameName: string;
  title: string;
  content: string | null;
  availableTimeDesc: string | null;
  status: ProgramStatus;
  price: number;
  tags: string[] | null;
  createdAt: string;
  /** 멘토의 멤버십 배지 */
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
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
  mentorMembershipBadge?: boolean;
  mentorRepresentativeTier?: RepresentativeTier | null;
  menteeMembershipBadge?: boolean;
  menteeRepresentativeTier?: RepresentativeTier | null;
  /** 신청 시점에 저장된 정산 수수료율(bp). 멘토 관점 응답에만 있다. */
  feeRateBp?: number;
  feeAmount?: number;
  payoutAmount?: number;
  /** 비가입 멘토에게 멤버십 수수료 안내를 보여줄지 */
  nonMemberNotice?: boolean;
  feeNotice?: string;
}

export interface MentoringReviewResponse {
  id: string;
  applicationId?: string;
  programId: string;
  programTitle: string;
  menteeNickname: string;
  /** 리뷰 작성자 프로필 이동용 핸들 */
  menteeHandle?: string;
  rating: number;
  content: string;
  createdAt: string;
  /** 리뷰 작성자(멘티)의 멤버십 배지 */
  membershipBadge?: boolean;
  representativeTier?: RepresentativeTier | null;
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
  auth?: ApiClientConfig['auth'];
};

export class MentoringApiError extends ApiError {
  constructor(message: string, status: number, reason: ApiFailureReason = 'http') {
    super(message, status, reason);
    this.name = 'MentoringApiError';
  }
}

export function isMentoringNotFoundError(error: unknown): error is MentoringApiError {
  return error instanceof MentoringApiError && error.status === 404;
}

// 공개 읽기는 optional, 정적 게임 코드는 public, 나머지는 required다.
function mentoringRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = 'required', ...fetchOptions } = options;

  return apiRequest<T>(
    path,
    {
      auth,
      envelope: 'optional',
      toError: ({ reason, status, message }) => {
        const serverMessage = message?.trim() ? message : undefined;
        if (reason === 'http' && status === 404) {
          return new MentoringApiError(serverMessage ?? '멘토링 정보를 찾을 수 없습니다.', status, reason);
        }

        const fallback = reason === 'unauthenticated' || reason === 'blocked' || status === 401
          ? AUTH_REQUIRED_MESSAGE
          : auth === 'required'
            ? '멘토링 요청 처리에 실패했습니다.'
            : '멘토링 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        return new MentoringApiError(serverMessage ?? fallback, status, reason);
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

export function fetchGames() {
  return mentoringRequest<GameResponse[]>('/api/v1/games', { auth: 'public' });
}

export function registerMentor(payload: { about: string }) {
  return mentoringRequest<MentorProfileResponse>(`${MENTORING_BASE}/mentors`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMentorProfile(mentorId: string) {
  return mentoringRequest<MentorProfileResponse>(`${MENTORING_BASE}/mentors/${mentorId}`, {
    auth: 'optional',
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

/** 프로그램 상세 설명에 넣을 이미지를 올리고 공개 URL을 돌려받는다. */
export function uploadMentoringProgramImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return mentoringRequest<{ imageUrl: string }>(`${MENTORING_BASE}/program-images`, {
    method: 'POST',
    body: formData,
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
    { auth: 'optional' }
  );
}

export function fetchMentoringProgramDetail(programId: string) {
  return mentoringRequest<MentoringProgramDetailResponse>(/^\d+$/.test(programId) ? `${MENTORING_BASE}/programs/no/${programId}` : `${MENTORING_BASE}/programs/${programId}`, {
    auth: 'optional',
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

// 신청하면 마일리지가 차감되고(MentoringService.applyToProgram) 취소하면 환불된다.
export function applyToMentoringProgram(payload: { programId: string; message: string }) {
  return invalidateMileageAfter(mentoringRequest<MentoringApplicationResponse>(`${MENTORING_BASE}/applications`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
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
  return invalidateMileageAfter(mentoringRequest<MentoringApplicationResponse>(
    `${MENTORING_BASE}/applications/${applicationId}/cancel`,
    { method: 'PATCH' }
  ));
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
    `${MENTORING_BASE}/mentors/${mentorId}/reviews?page=${page}&size=${size}`,
    { auth: 'optional' },
  );
}
