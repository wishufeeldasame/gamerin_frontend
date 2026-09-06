import {
  adminApiRequest,
  type AdminReportTargetTypeCode,
} from '@/lib/admin-report-api';

const ADMIN_CONTENTS_BASE = '/api/v1/admin/contents';

export interface AdminHiddenContentApiItem {
  id: string;
  targetType: AdminReportTargetTypeCode;
  targetId: string;
  reportCount: number;
  isHidden: boolean;
  updatedAt: string;
}

export interface AdminHiddenContentPageResponse {
  content: AdminHiddenContentApiItem[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
  empty?: boolean;
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

  return adminApiRequest<AdminHiddenContentPageResponse>(
    `${ADMIN_CONTENTS_BASE}/hidden?${searchParams.toString()}`,
    { signal },
  );
}

export function restoreAdminHiddenContent(
  targetType: AdminReportTargetTypeCode,
  targetId: string,
) {
  return adminApiRequest<AdminHiddenContentApiItem>(
    `${ADMIN_CONTENTS_BASE}/${encodeURIComponent(targetType)}/${encodeURIComponent(targetId)}/restore`,
    { method: 'POST' },
  );
}
