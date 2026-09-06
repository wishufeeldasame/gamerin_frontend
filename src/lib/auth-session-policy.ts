export const BLOCKED_ACCOUNT_MESSAGE =
  '정지되었거나 비활성화된 계정입니다. 계정 상태를 확인해주세요.';

const blockedAccountStatuses = new Set([
  'INACTIVE',
  'SUSPENDED',
  'BANNED',
  'PERMANENT_BAN',
  'DEACTIVATED',
  'DELETED',
  'LOCKED',
  'BLOCKED',
]);

const blockedAccountCodes = new Set([
  'ACCOUNT_INACTIVE',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_BANNED',
  'USER_SUSPENDED',
  'PERMANENT_BAN',
  'SUSPENSION_ACTIVE',
]);

type AccountErrorPayload = {
  code?: unknown;
  errorCode?: unknown;
  message?: unknown;
  data?: {
    status?: unknown;
  } | null;
} | null;

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function isBlockedAccountStatus(status: unknown) {
  return blockedAccountStatuses.has(normalize(status));
}

export function isBlockedAccountResponse(
  httpStatus: number,
  payload: AccountErrorPayload,
) {
  if (isBlockedAccountStatus(payload?.data?.status)) {
    return true;
  }

  const code = normalize(payload?.errorCode ?? payload?.code);
  if (blockedAccountCodes.has(code)) {
    return true;
  }

  if (httpStatus !== 403 && httpStatus !== 423) {
    return false;
  }

  const message = typeof payload?.message === 'string' ? payload.message : '';
  return /활성 상태 계정이 아닙니다|비활성|정지된 계정|이용\s*(?:정지|제한)|영구\s*(?:정지|제한)|suspend|bann/i.test(
    message,
  );
}
