import { adminApiRequest } from '@/lib/admin-report-api';
import type { PageResponse } from '@/types/api';
import type { ReportTargetType } from '@/types/report';

const ADMIN_CONTENTS_BASE = '/api/v1/admin/contents';

export interface AdminHiddenContentApiItem {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reportCount: number;
  isHidden: boolean;
  updatedAt: string;
}

export interface AdminHiddenContentSearchParams {
  page?: number;
  size?: number;
  sort?: 'updatedAt,desc' | 'updatedAt,asc';
}

export function fetchAdminHiddenContents(
  params: AdminHiddenContentSearchParams = {},
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    page: String(params.page ?? 0),
    size: String(params.size ?? 100),
    sort: params.sort ?? 'updatedAt,desc',
  });

  return adminApiRequest<PageResponse<AdminHiddenContentApiItem>>(
    `${ADMIN_CONTENTS_BASE}/hidden?${searchParams.toString()}`,
    { signal },
  );
}

export function restoreAdminHiddenContent(
  targetType: ReportTargetType,
  targetId: string,
  signal?: AbortSignal,
) {
  return adminApiRequest<AdminHiddenContentApiItem>(
    `${ADMIN_CONTENTS_BASE}/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/restore`,
    { method: 'POST', signal },
  );
}
