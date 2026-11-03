import type { AdminSettingApiItem, AdminSettingKey, AdminSettingsUpdate } from '@/lib/admin-settings-api';

export const sanctionApiValues = {
  warning: 'WARNING',
  '3-days': 'SUSPENSION_3D',
  '7-days': 'SUSPENSION_7D',
  '30-days': 'SUSPENSION_30D',
  permanent: 'PERMANENT_BAN',
} as const;

export type AdminSanctionChoice = keyof typeof sanctionApiValues;

export type AdminSettingsState = {
  defaultSanction: AdminSanctionChoice;
  reportReviewDays: string;
  autoHideReports: boolean;
  autoHideThreshold: string;
  newReportNotification: boolean;
};

export const settingApiKeys = {
  autoHideReports: 'AUTO_HIDE_ENABLED',
  autoHideThreshold: 'AUTO_HIDE_THRESHOLD',
  newReportNotification: 'NEW_REPORT_ALERT',
  defaultSanction: 'DEFAULT_SANCTION_LEVEL',
  reportReviewDays: 'RE_REVIEW_DEADLINE_DAYS',
} as const satisfies Record<keyof AdminSettingsState, AdminSettingKey>;

function positiveInteger(value: string, label: string) {
  const trimmed = value.trim();
  const parsed = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || !Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label}은(는) 1 이상의 정수여야 합니다.`);
  }
  return String(parsed);
}

export function settingsFromApi(items: AdminSettingApiItem[]): AdminSettingsState {
  const values = new Map(items.map((item) => [item.configKey, item.configValue]));
  const read = (key: AdminSettingKey) => {
    const value = values.get(key);
    if (typeof value !== 'string') throw new Error(`등록된 설정값을 찾을 수 없습니다: ${key}`);
    return value.trim();
  };
  const readBoolean = (key: AdminSettingKey) => {
    const value = read(key).toLowerCase();
    if (value !== 'true' && value !== 'false') throw new Error(`설정값이 올바르지 않습니다: ${key}`);
    return value === 'true';
  };
  const sanction = read('DEFAULT_SANCTION_LEVEL');
  const defaultSanction = (Object.keys(sanctionApiValues) as AdminSanctionChoice[])
    .find((choice) => sanctionApiValues[choice] === sanction);
  if (!defaultSanction) throw new Error('기본 제재 수준 설정값이 올바르지 않습니다.');
  return {
    autoHideReports: readBoolean('AUTO_HIDE_ENABLED'),
    autoHideThreshold: positiveInteger(read('AUTO_HIDE_THRESHOLD'), '자동 숨김 임계값'),
    newReportNotification: readBoolean('NEW_REPORT_ALERT'),
    defaultSanction,
    reportReviewDays: positiveInteger(read('RE_REVIEW_DEADLINE_DAYS'), '신고 재검토 기한'),
  };
}

export function serializeSettings(settings: AdminSettingsState): Record<AdminSettingKey, string> {
  return {
    AUTO_HIDE_ENABLED: String(settings.autoHideReports),
    AUTO_HIDE_THRESHOLD: positiveInteger(settings.autoHideThreshold, '자동 숨김 임계값'),
    NEW_REPORT_ALERT: String(settings.newReportNotification),
    DEFAULT_SANCTION_LEVEL: sanctionApiValues[settings.defaultSanction],
    RE_REVIEW_DEADLINE_DAYS: positiveInteger(settings.reportReviewDays, '신고 재검토 기한'),
  };
}

export function changedSettings(settings: AdminSettingsState, baseline: AdminSettingsState): AdminSettingsUpdate {
  const current = serializeSettings(settings);
  const saved = serializeSettings(baseline);
  return Object.fromEntries(
    (Object.keys(current) as AdminSettingKey[])
      .filter((key) => current[key] !== saved[key])
      .map((key) => [key, current[key]]),
  );
}
