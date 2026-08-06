export type DashboardSummaryIcon = 'clock' | 'review' | 'complete' | 'suspended';

export type DashboardSummaryCard = {
  value: number;
  label: string;
  description: string;
  icon: DashboardSummaryIcon;
  iconBackground: string;
  iconColor: string;
};

export const dashboardSummaryCards: DashboardSummaryCard[] = [
  { value: 12, label: '신고 대기', description: '확인이 필요한 신고', icon: 'clock', iconBackground: '#fef6e7', iconColor: '#d97706' },
  { value: 5, label: '검토 중', description: '처리 진행 중인 신고', icon: 'review', iconBackground: '#eef3ff', iconColor: '#315ef5' },
  { value: 27, label: '오늘 처리 완료', description: '오늘 완료된 신고', icon: 'complete', iconBackground: '#e7f6ee', iconColor: '#168a4a' },
  { value: 8, label: '현재 정지 사용자', description: '제재가 적용된 사용자', icon: 'suspended', iconBackground: '#feeceb', iconColor: '#e5484d' },
];

export const dashboardReportReasons = [
  { label: '욕설·비하·혐오', count: 48 },
  { label: '광고·홍보', count: 31 },
  { label: '도배·시스템 악용', count: 22 },
  { label: '음란·성적 콘텐츠', count: 15 },
  { label: '사기·거래 피해', count: 12 },
  { label: '기타', count: 9 },
];
