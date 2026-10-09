import type { AdminMentorStatus, AdminProgramStatus } from '@/lib/admin-mentoring-api';

export type MentoringTab = 'applications' | 'programs';

export const mentorStatusLabels: Record<AdminMentorStatus, string> = {
  PENDING_APPROVAL: '승인 대기',
  ACTIVE: '활성',
  INACTIVE: '비활성',
};

export const programStatusLabels: Record<AdminProgramStatus, string> = {
  ACTIVE: '운영 중',
  CLOSED: '종료',
};
