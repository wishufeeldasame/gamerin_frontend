export type AdminReportStatus = '접수' | '검토 중' | '처리 완료' | '반려';

export type AdminReportTargetType = '게시글' | '댓글' | '사용자' | '메시지';

export type AdminReportReason =
  | '광고·홍보'
  | '욕설·비하·혐오'
  | '음란·성적 콘텐츠'
  | '도배·시스템 악용'
  | '사기·거래 피해'
  | '기타';

export type AdminReportUser = {
  name: string;
  handle: string;
  initial: string;
  joinedAt: string;
  reportsReceived: number;
  activeSanction?: string;
};

export type AdminReport = {
  id: string;
  targetType: AdminReportTargetType;
  target: string;
  reason: AdminReportReason;
  status: AdminReportStatus;
  reporter: string;
  administrator: string;
  receivedAt: string;
  description: string;
  content: string;
  reporterUser: AdminReportUser;
  targetUser: AdminReportUser;
};

export type AdminUserStatus = '활성' | '정지';

export type AdminUser = {
  name: string;
  handle: string;
  id: string;
  initial: string;
  avatarColor: string;
  status: AdminUserStatus;
  reports: number;
  confirmedViolations: number;
  sanction: string;
  registeredAt: string;
  role?: '관리자' | '멘토';
};

export type AdminSanctionType =
  | 'warning'
  | '3days'
  | '7days'
  | '30days'
  | 'permanent';

export type AdminAuditAction =
  | '신고 검토 시작'
  | '신고 처리 완료'
  | '신고 반려'
  | '콘텐츠 숨김'
  | '콘텐츠 복구'
  | '사용자 경고'
  | '사용자 정지'
  | '정지 해제';

export type AdminAuditTargetType = '신고' | '게시글' | '댓글' | '사용자';

export type AdminAuditLog = {
  id: string;
  administrator: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  reason: string;
  createdAt: string;
};
