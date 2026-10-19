import { adminApiRequest } from '@/lib/admin-report-api';
import type { PageResponse } from '@/types/api';
import type { ReportTargetType } from '@/types/report';

export interface AdminAuditLog {
  id: string;
  adminId: string;
  adminNickname: string;
  actionType: string;
  targetType: ReportTargetType | null;
  targetId: string | null;
  requestId: string | null;
  details: string | null;
  createdAt: string;
}

export interface AdminAuditSearchParams {
  adminId?: string;
  actionType?: string;
  targetType?: ReportTargetType;
  page?: number;
  size?: number;
  sort?: 'createdAt,desc' | 'createdAt,asc';
}

export function fetchAdminAuditLogs(params: AdminAuditSearchParams = {}, signal?: AbortSignal) {
  const searchParams = new URLSearchParams();
  if (params.adminId) searchParams.set('adminId', params.adminId);
  if (params.actionType) searchParams.set('actionType', params.actionType);
  if (params.targetType) searchParams.set('targetType', params.targetType);
  searchParams.set('page', String(params.page ?? 0));
  searchParams.set('size', String(params.size ?? 20));
  searchParams.set('sort', params.sort ?? 'createdAt,desc');

  return adminApiRequest<PageResponse<AdminAuditLog>>(
    `/api/v1/admin/audit-logs?${searchParams.toString()}`,
    { signal },
  );
}
