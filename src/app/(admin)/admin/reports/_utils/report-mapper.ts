import type {
  AdminReportApiItem,
  AdminReportApiUser,
  AdminReportDetailResponse,
  AdminReportReasonCode,
  AdminReportStatusCode,
  AdminReportTargetTypeCode,
} from '@/lib/admin-report-api';
import type {
  AdminReport,
  AdminReportStatus,
  AdminReportTargetType,
  AdminReportUser,
} from '@/types/admin';

export const statusCodeByLabel: Record<AdminReportStatus, AdminReportStatusCode> = {
  접수: 'RECEIVED',
  '검토 중': 'IN_REVIEW',
  '처리 완료': 'RESOLVED',
  반려: 'REJECTED',
};

export const statusLabelByCode: Record<AdminReportStatusCode, AdminReportStatus> = {
  RECEIVED: '접수',
  IN_REVIEW: '검토 중',
  RESOLVED: '처리 완료',
  REJECTED: '반려',
};

export const reasonCodeByLabel: Record<string, AdminReportReasonCode> = {
  '욕설 및 비방': 'PROFANITY',
  '스팸 및 반복 홍보': 'SPAM',
  '부적절한 콘텐츠': 'INAPPROPRIATE',
  '사칭 및 허위 정보': 'IMPERSONATION',
  기타: 'OTHER',
};

export const reportReasonLabels = Object.keys(reasonCodeByLabel);

export const targetTypeCodeByLabel: Record<AdminReportTargetType, AdminReportTargetTypeCode> = {
  게시글: 'POST',
  댓글: 'COMMENT',
  사용자: 'USER',
  멘토링: 'MENTORING',
  메시지: 'MESSAGE',
};

const targetTypeLabelByCode: Record<AdminReportTargetTypeCode, AdminReportTargetType> = {
  POST: '게시글',
  COMMENT: '댓글',
  USER: '사용자',
  MENTORING: '멘토링',
  MESSAGE: '메시지',
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '';

  return `${part('year')}.${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`;
}

function formatJoinedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).replace(/\s/g, '');
}

function mapUser(user: AdminReportApiUser): AdminReportUser {
  return {
    id: user.id,
    name: user.nickname,
    handle: `@${user.handle}`,
    initial: user.nickname.trim().charAt(0) || '?',
    joinedAt: formatJoinedAt(user.joinedAt),
    reportsReceived: user.reportsReceived,
    activeSanction: user.activeSanction ?? '제재 없음',
  };
}

function fallbackTargetUser(): AdminReportUser {
  return {
    name: '대상 사용자 정보 없음',
    handle: '-',
    initial: '?',
    joinedAt: '-',
    reportsReceived: 0,
    activeSanction: '확인 불가',
  };
}

export function mapAdminReport(
  report: AdminReportApiItem,
  detail?: AdminReportDetailResponse,
): AdminReport {
  const reporterHandle = report.reporterHandle?.trim();
  const reporterLabel = reporterHandle ? `@${reporterHandle}` : report.reporterNickname;

  return {
    id: report.reportCode,
    reportUuid: report.id,
    targetType: targetTypeLabelByCode[report.targetType],
    target: report.targetSnippet?.trim() || `${targetTypeLabelByCode[report.targetType]} ${report.targetId}`,
    reason: report.reasonLabel,
    status: statusLabelByCode[report.status],
    reporter: reporterLabel,
    administrator: report.assignedAdminNickname ?? '미배정',
    receivedAt: formatDateTime(report.createdAt),
    description: report.details?.trim() || '신고자가 별도의 상세 설명을 입력하지 않았습니다.',
    content: report.targetSnippet?.trim() || '신고 당시 콘텐츠를 확인할 수 없습니다.',
    reporterUser: detail ? mapUser(detail.reporter) : {
      id: report.reporterId,
      name: report.reporterNickname,
      handle: reporterLabel,
      initial: report.reporterNickname.trim().charAt(0) || '?',
      joinedAt: '-',
      reportsReceived: 0,
    },
    targetUser: detail?.targetUser ? mapUser(detail.targetUser) : fallbackTargetUser(),
    targetId: report.targetId,
    contentHidden: detail?.contentHidden ?? false,
    updatedAt: formatDateTime(report.updatedAt),
  };
}
