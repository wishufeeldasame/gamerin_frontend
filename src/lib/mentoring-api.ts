'use client';

import { ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  numberOfElements: number;
}

export type MentorStatus = 'ACTIVE' | 'INACTIVE';
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

export interface MentorRegistrationRequest {
  about: string;
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

export interface MentoringApplicationRequest {
  programId: string;
  message: string;
}

export interface MentoringReviewRequest {
  applicationId: string;
  rating: number;
  content: string;
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
  mentorNickName: string;
  gameName: string;
  title: string;
  content: string;
  availableTimeDesc: string;
  status: ProgramStatus;
  price: number;
  tags: string[];
  createdAt: string;
}

export interface MentoringProgramDetailResponse {
  id: string;
  mentorId: string;
  mentorNickname: string;
  mentorAbout: string;
  gameName: string;
  title: string;
  content: string;
  availableTimeDesc: string;
  price: number;
  tags: string[];
  createdAt: string;
}

export interface MentoringApplicationResponse {
  id: string;
  programId: string;
  programTitle: string;
  mentorNickname: string;
  menteeNickname: string;
  appliedMileage: number;
  status: ApplicationStatus;
  paymentStatus: PaymentStatus;
  message: string;
  createdAt: string;
}

export interface MentoringReviewResponse {
  id: string;
  applicationId: string;
  menteeNickname: string;
  rating: number;
  content: string;
  createdAt: string;
}

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (token: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as ApiResponse<T> | { message?: string } | null;
    return { response, payload };
  };

  let token = await ensureAccessToken();
  if (!token) {
    throw new Error('로그인이 필요합니다.');
  }

  let result = await send(token);

  if (result.response.status === 401) {
    token = await refreshAccessToken();
    if (!token) {
      throw new Error('로그인이 필요합니다.');
    }
    result = await send(token);
  }

  if (!result.response.ok) {
    throw new Error(result.payload?.message ?? '요청을 처리하지 못했습니다.');
  }

  return (result.payload as ApiResponse<T>).data;
}

function toSearch(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function formatKoreanDate(date: string) {
  return new Date(date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMileage(value: number) {
  return new Intl.NumberFormat('ko-KR').format(value);
}

export async function fetchMentoringPrograms(params: {
  page?: number;
  size?: number;
  gameName?: string;
}) {
  return request<PageResponse<MentoringProgramResponse>>(
    `/api/v1/mentoring/programs${toSearch(params)}`
  );
}

export async function fetchMentoringProgramDetail(id: string) {
  return request<MentoringProgramDetailResponse>(`/api/v1/mentoring/programs/${id}`);
}

export async function fetchMentorProfile(mentorId: string) {
  return request<MentorProfileResponse>(`/api/v1/mentoring/mentors/${mentorId}`);
}

export async function registerMentor(payload: MentorRegistrationRequest) {
  return request<MentorProfileResponse>('/api/v1/mentoring/mentors', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createMentoringProgram(payload: MentoringProgramRequest) {
  return request<MentoringProgramResponse>('/api/v1/mentoring/programs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMentoringProgram(id: string, payload: MentoringProgramUpdateRequest) {
  return request<MentoringProgramResponse>(`/api/v1/mentoring/programs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteMentoringProgram(id: string) {
  return request<null>(`/api/v1/mentoring/programs/${id}`, {
    method: 'DELETE',
  });
}

export async function applyToProgram(payload: MentoringApplicationRequest) {
  return request<MentoringApplicationResponse>('/api/v1/mentoring/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMyMenteeApplications(page = 0, size = 10) {
  return request<PageResponse<MentoringApplicationResponse>>(
    `/api/v1/mentoring/applications/mentee${toSearch({ page, size })}`
  );
}

export async function fetchMyMentorApplications(page = 0, size = 10) {
  return request<PageResponse<MentoringApplicationResponse>>(
    `/api/v1/mentoring/applications/mentor${toSearch({ page, size })}`
  );
}

async function patchApplicationAction(id: string, action: 'accept' | 'reject' | 'start' | 'finish' | 'complete') {
  return request<MentoringApplicationResponse>(`/api/v1/mentoring/applications/${id}/${action}`, {
    method: 'PATCH',
  });
}

export function acceptApplication(id: string) {
  return patchApplicationAction(id, 'accept');
}

export function rejectApplication(id: string) {
  return patchApplicationAction(id, 'reject');
}

export function startMentoring(id: string) {
  return patchApplicationAction(id, 'start');
}

export function finishMentoring(id: string) {
  return patchApplicationAction(id, 'finish');
}

export function completeMentoring(id: string) {
  return patchApplicationAction(id, 'complete');
}

export async function createMentoringReview(payload: MentoringReviewRequest) {
  return request<MentoringReviewResponse>('/api/v1/mentoring/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMentorReviews(mentorId: string, page = 0, size = 10) {
  return request<PageResponse<MentoringReviewResponse>>(
    `/api/v1/mentoring/mentors/${mentorId}/reviews${toSearch({ page, size })}`
  );
}
