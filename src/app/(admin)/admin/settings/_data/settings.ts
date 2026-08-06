export type AdminSettingsState = {
  serviceName: string;
  allowSignup: boolean;
  maintenanceMode: boolean;
  defaultSanction: string;
  reportReviewDays: string;
  autoHideReports: boolean;
  autoHideThreshold: string;
  newReportNotification: boolean;
  requireTwoFactor: boolean;
};

export const initialAdminSettings: AdminSettingsState = {
  serviceName: 'GamerIN',
  allowSignup: true,
  maintenanceMode: false,
  defaultSanction: '',
  reportReviewDays: '7',
  autoHideReports: true,
  autoHideThreshold: '5',
  newReportNotification: true,
  requireTwoFactor: true,
};
