import { adminApiRequest } from '@/lib/admin-report-api';

export interface AdminDashboardStats {
  receivedReportsCount: number;
  inReviewReportsCount: number;
  resolvedReportsCount: number;
  rejectedReportsCount: number;
  activePenaltiesCount: number;
  hiddenContentsCount: number;
}

export function fetchAdminDashboardStats(signal?: AbortSignal) {
  return adminApiRequest<AdminDashboardStats>('/api/v1/admin/dashboard/stats', { signal });
}
