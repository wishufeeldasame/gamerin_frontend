import { adminApiRequest, type AdminPenaltyType } from '@/lib/admin-report-api';
import { toAbsoluteAssetUrl } from '@/lib/asset-url';
import type { PageResponse } from '@/types/api';

const ADMIN_USERS_BASE = '/api/v1/admin/users';

export type AdminUserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export interface AdminUserResponse {
  id: string;
  handle: string;
  nickname: string;
  email: string;
  profileImageUrl: string | null;
  role: 'USER' | 'ADMIN';
  status: AdminUserStatus;
  createdAt: string;
  /** USER 대상을 직접 신고한 건수. 콘텐츠 신고와 위반 확정 건수가 아니다. */
  reportsReceivedCount: number;
  activeSanction: string;
  activePenaltyId: string | null;
}

export interface UserPenaltyResponse {
  id: string;
  userId: string;
  userNickname: string;
  reportId: string | null;
  penaltyType: AdminPenaltyType;
  reason: string;
  startAt: string;
  endAt: string | null;
  isActive: boolean;
  administeredByAdminId: string | null;
  administeredByAdminNickname: string | null;
  createdAt: string;
}

export interface AdminUserPenaltySearchParams {
  page?: number;
  size?: number;
  sort?: 'createdAt,desc' | 'createdAt,asc';
}

export interface AdminUserSearchParams extends AdminUserPenaltySearchParams {
  query?: string;
  status?: AdminUserStatus;
  hasSanction?: boolean;
}

export interface AdminUserPenaltyCreateRequest {
  penaltyType: AdminPenaltyType;
  reason: string;
  durationDays?: number | null;
  reportId?: string | null;
}

function pageQuery(params: AdminUserPenaltySearchParams, defaultSize: number) {
  const search = new URLSearchParams();
  search.set('page', String(params.page ?? 0));
  search.set('size', String(params.size ?? defaultSize));
  search.set('sort', params.sort ?? 'createdAt,desc');
  return search;
}

function normalizeUser(user: AdminUserResponse): AdminUserResponse {
  return { ...user, profileImageUrl: toAbsoluteAssetUrl(user.profileImageUrl) };
}

export async function fetchAdminUsers(params: AdminUserSearchParams = {}, signal?: AbortSignal): Promise<PageResponse<AdminUserResponse>> {
  const search = new URLSearchParams();
  const query = params.query?.trim().replace(/^@/, '');
  if (query) search.set('query', query);
  if (params.status) search.set('status', params.status);
  if (params.hasSanction !== undefined) search.set('hasSanction', String(params.hasSanction));
  pageQuery(params, 20).forEach((value, key) => search.set(key, value));
  const page = await adminApiRequest<PageResponse<AdminUserResponse>>(`${ADMIN_USERS_BASE}?${search}`, { signal });
  return { ...page, content: page.content.map(normalizeUser) };
}

export async function fetchAdminUser(userId: string, signal?: AbortSignal): Promise<AdminUserResponse> {
  return normalizeUser(await adminApiRequest<AdminUserResponse>(`${ADMIN_USERS_BASE}/${encodeURIComponent(userId)}`, { signal }));
}

export async function fetchAdminUserByHandle(handle: string, signal?: AbortSignal): Promise<AdminUserResponse> {
  return normalizeUser(await adminApiRequest<AdminUserResponse>(`${ADMIN_USERS_BASE}/by-handle/${encodeURIComponent(handle)}`, { signal }));
}

export function fetchAdminUserPenalties(userId: string, params: AdminUserPenaltySearchParams = {}, signal?: AbortSignal): Promise<PageResponse<UserPenaltyResponse>> {
  return adminApiRequest<PageResponse<UserPenaltyResponse>>(`${ADMIN_USERS_BASE}/${encodeURIComponent(userId)}/penalties?${pageQuery(params, 10)}`, { signal });
}

export function createAdminUserPenalty(userId: string, request: AdminUserPenaltyCreateRequest, signal?: AbortSignal): Promise<UserPenaltyResponse> {
  return adminApiRequest<UserPenaltyResponse>(`${ADMIN_USERS_BASE}/${encodeURIComponent(userId)}/penalties`, {
    method: 'POST', body: JSON.stringify(request), signal,
  });
}

export function revokeAdminUserPenalty(userId: string, penaltyId: string, signal?: AbortSignal): Promise<UserPenaltyResponse> {
  return adminApiRequest<UserPenaltyResponse>(`${ADMIN_USERS_BASE}/${encodeURIComponent(userId)}/penalties/${encodeURIComponent(penaltyId)}`, {
    method: 'DELETE', signal,
  });
}
