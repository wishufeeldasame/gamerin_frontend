import { ApiError, apiRequest } from '@/lib/api-client';

/** 회원 탈퇴. 성공하면 서버에서 계정이 익명화되므로 호출 측에서 바로 로그아웃한다. */
export async function deleteMyAccount() {
  await apiRequest<null>('/api/v1/users/me', {
    toError: ({ reason, status, message }) =>
      new ApiError(message?.trim() ? message : '계정을 삭제하지 못했습니다.', status, reason),
  }, {
    method: 'DELETE',
  });
}
