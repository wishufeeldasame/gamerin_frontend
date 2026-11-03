export type ReportTargetType = 'POST' | 'COMMENT' | 'USER' | 'MENTORING' | 'MESSAGE';

export type ReportReasonCode =
  | 'PROFANITY'
  | 'SPAM'
  | 'INAPPROPRIATE'
  | 'IMPERSONATION'
  | 'OTHER';

export type ReportStatus = 'RECEIVED' | 'IN_REVIEW' | 'RESOLVED' | 'REJECTED';
