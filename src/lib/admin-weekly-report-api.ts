import { adminApiRequest } from '@/lib/admin-report-api';
import type { ValorantRegion } from '@/lib/game-stats-api';
import type { WeeklyGameReport } from '@/lib/membership-content';

export interface WeeklyReportCollectionIssue {
  matchId: string | null;
  startedAt: string | null;
  map: string | null;
  httpStatus: number | null;
  reason: string;
}

export interface AdminWeeklyGameReport extends WeeklyGameReport {
  collectionIssues?: WeeklyReportCollectionIssue[];
}

export function generateAdminValorantWeeklyReport(riotId: string, region: ValorantRegion, signal?: AbortSignal) {
  return adminApiRequest<AdminWeeklyGameReport>('/api/v1/admin/weekly-reports/valorant', {
    method: 'POST',
    body: JSON.stringify({ riotId, region }),
    signal,
  });
}
