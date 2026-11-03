// 가입·소셜 가입·비밀번호 재설정의 입력 규칙. 백엔드 SignUpRequest·SocialSignUpRequest·ResetPasswordRequest와 같게 유지한다.
export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;
export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 20;

const HANDLE_PATTERN = /^[a-z0-9_]+$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_COMPOSITION = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;

// 각 함수는 규칙을 어기면 이유(한국어)를, 통과하면 null을 반환한다.
// 핸들·닉네임·이메일은 앞뒤 공백을 뺀 값을 검사한다. 서버로도 trim한 값을 보내야 한다. 비밀번호는 그대로 검사한다.
export function validateHandle(value: string): string | null {
  const handle = value.trim();
  if (handle && !HANDLE_PATTERN.test(handle)) {
    return '아이디는 영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다.';
  }
  if (handle.length < HANDLE_MIN_LENGTH || handle.length > HANDLE_MAX_LENGTH) {
    return `아이디는 ${HANDLE_MIN_LENGTH}~${HANDLE_MAX_LENGTH}자로 입력해주세요.`;
  }
  return null;
}

export function validateNickname(value: string): string | null {
  const length = value.trim().length;
  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자로 입력해주세요.`;
  }
  return null;
}

export function validateEmail(value: string): string | null {
  return EMAIL_PATTERN.test(value.trim()) ? null : '올바른 이메일 형식으로 입력해주세요.';
}

export function validatePassword(value: string): string | null {
  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}~${PASSWORD_MAX_LENGTH}자로 입력해주세요.`;
  }
  if (!PASSWORD_COMPOSITION.test(value)) {
    return '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.';
  }
  return null;
}
