import { adminApiRequest } from '@/lib/admin-report-api';
import type { PageResponse } from '@/types/api';

const ADMIN_MENTORING_BASE = '/api/v1/admin/mentoring';

export type AdminMentorStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'INACTIVE';
export type AdminProgramStatus = 'ACTIVE' | 'CLOSED';

export interface AdminMentorApiItem {
  userId: string;
  name: string;
  handle: string;
  bio: string | null;
  ratingAvg: number | null;
  reviewCount: number;
  menteeCount: number;
  status: AdminMentorStatus;
  appliedAt: string;
}

export interface AdminMentoringProgramApiItem {
  id: string;
  title: string;
  game: string;
  mentorHandle: string;
  mentorNickname: string;
  price: number | null;
  sessions: number;
  rating: number | null;
  reports: number;
  status: AdminProgramStatus;
  isHidden: boolean;
  createdAt: string;
}

export interface AdminMentoringSummary {
  pendingMentorCount: number;
  activeProgramCount: number;
  monthlySessionCount: number;
  escrowHeldAmount: number;
}

interface AdminMentoringPageParams {
  page?: number;
  size?: number;
  sort?: 'createdAt,desc' | 'createdAt,asc';
}

export interface AdminMentorSearchParams extends AdminMentoringPageParams {
  status?: AdminMentorStatus;
}

export interface AdminProgramSearchParams extends AdminMentoringPageParams {
  status?: AdminProgramStatus;
  keyword?: string;
}

function pageSearchParams(params: AdminMentoringPageParams) {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? 20));
  search.set('sort', params.sort ?? 'createdAt,desc');
  return search;
}

export function fetchAdminMentoringSummary(signal?: AbortSignal) {
  return adminApiRequest<AdminMentoringSummary>(`${ADMIN_MENTORING_BASE}/summary`, { signal });
}

export function fetchAdminMentors(params: AdminMentorSearchParams = {}, signal?: AbortSignal) {
  const search = pageSearchParams(params);
  if (params.status) search.set('status', params.status);
  return adminApiRequest<PageResponse<AdminMentorApiItem>>(
    `${ADMIN_MENTORING_BASE}/mentors?${search}`, { signal },
  );
}

export function fetchAdminMentoringPrograms(params: AdminProgramSearchParams = {}, signal?: AbortSignal) {
  const search = pageSearchParams(params);
  if (params.status) search.set('status', params.status);
  if (params.keyword?.trim()) search.set('keyword', params.keyword.trim());
  return adminApiRequest<PageResponse<AdminMentoringProgramApiItem>>(
    `${ADMIN_MENTORING_BASE}/programs?${search}`, { signal },
  );
}

export function approveAdminMentor(userId: string, signal?: AbortSignal) {
  return adminApiRequest<AdminMentorApiItem>(
    `${ADMIN_MENTORING_BASE}/mentors/${encodeURIComponent(userId)}/approve`,
    { method: 'POST', signal },
  );
}

export function rejectAdminMentor(userId: string, reason: string, signal?: AbortSignal) {
  return adminApiRequest<AdminMentorApiItem>(
    `${ADMIN_MENTORING_BASE}/mentors/${encodeURIComponent(userId)}/reject`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }), signal },
  );
}

export function updateAdminProgramStatus(programId: string, status: AdminProgramStatus, signal?: AbortSignal) {
  return adminApiRequest<AdminMentoringProgramApiItem>(
    `${ADMIN_MENTORING_BASE}/programs/${encodeURIComponent(programId)}/status`,
    { method: 'PATCH', body: JSON.stringify({ status }), signal },
  );
}

export function hideAdminMentoringProgram(programId: string, reason: string, signal?: AbortSignal) {
  return adminApiRequest<AdminMentoringProgramApiItem>(
    `${ADMIN_MENTORING_BASE}/programs/${encodeURIComponent(programId)}/hide`,
    { method: 'POST', body: JSON.stringify({ reason: reason.trim() }), signal },
  );
}
