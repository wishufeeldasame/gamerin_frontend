import { adminApiRequest } from '@/lib/admin-report-api';

export type AdminSettingKey =
  | 'AUTO_HIDE_ENABLED'
  | 'AUTO_HIDE_THRESHOLD'
  | 'NEW_REPORT_ALERT'
  | 'DEFAULT_SANCTION_LEVEL'
  | 'RE_REVIEW_DEADLINE_DAYS';

export interface AdminSettingApiItem {
  configKey: string;
  configValue: string;
  description: string | null;
  updatedAt: string;
}

export type AdminSettingsUpdate = Partial<Record<AdminSettingKey, string>>;

export function fetchAdminSettings(signal?: AbortSignal) {
  return adminApiRequest<AdminSettingApiItem[]>('/api/v1/admin/settings', { signal });
}

export function updateAdminSettings(settings: AdminSettingsUpdate, signal?: AbortSignal) {
  return adminApiRequest<AdminSettingApiItem[]>('/api/v1/admin/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
    signal,
  });
}
