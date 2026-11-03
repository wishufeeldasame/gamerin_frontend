import Link from 'next/link';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legal-versions';

export interface SignupConsentValue {
  age: boolean;
  terms: boolean;
  privacy: boolean;
}

export const EMPTY_SIGNUP_CONSENT: SignupConsentValue = { age: false, terms: false, privacy: false };

export const isSignupConsentComplete = ({ age, terms, privacy }: SignupConsentValue) => age && terms && privacy;

// 가입 요청 본문의 동의 필드. 서버가 동의 항목과 함께 약관 버전을 검증·기록한다.
export const toSignupConsentPayload = ({ age, terms, privacy }: SignupConsentValue) => ({
  agreedToTerms: terms,
  agreedToPrivacy: privacy,
  agreedToAge14: age,
  termsVersion: TERMS_VERSION,
  privacyVersion: PRIVACY_VERSION,
});

const checkboxClassName = 'mt-0.5 h-5 w-5 shrink-0 accent-black dark:accent-[#f5b93d]';

interface SignupConsentProps {
  value: SignupConsentValue;
  onChange: (value: SignupConsentValue) => void;
}

// 로컬·소셜 가입 공통 동의 UI. 문서는 입력값이 사라지지 않게 새 탭으로 연다.
export function SignupConsent({ value, onChange }: SignupConsentProps) {
  const complete = isSignupConsentComplete(value);

  return (
    <fieldset className="space-y-3 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
      <legend className="px-1 font-bold text-black">약관 동의</legend>

      <div className="space-y-1 text-xs leading-5 text-zinc-500">
        <p>수집 항목: 이메일, 아이디, 닉네임, 비밀번호(Google 가입은 Google 식별자, 이메일, 이름)</p>
        <p>이용 목적: 회원 관리, 서비스 제공, 유해 콘텐츠 차단</p>
        <p>보유 기간: 탈퇴 시까지. 일부 기록은 프로젝트 종료 시까지(처리방침 제4조)</p>
        <p>국외 이전: 서버는 일본 Oracle Cloud. 게시글·댓글·DM 내용은 검사를 위해 미국 OpenAI로 전송됩니다.</p>
      </div>

      <label className="flex items-start gap-2 border-b border-zinc-200 pb-3 font-bold text-black">
        <input
          type="checkbox"
          className={checkboxClassName}
          checked={complete}
          onChange={(event) => {
            const checked = event.target.checked;
            onChange({ age: checked, terms: checked, privacy: checked });
          }}
        />
        필수 항목 전체 동의
      </label>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          className={checkboxClassName}
          checked={value.age}
          onChange={(event) => onChange({ ...value, age: event.target.checked })}
        />
        (필수) 만 14세 이상입니다
      </label>

      <div className="flex items-start justify-between gap-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className={checkboxClassName}
            checked={value.terms}
            onChange={(event) => onChange({ ...value, terms: event.target.checked })}
          />
          (필수) 이용약관에 동의합니다
        </label>
        <Link href="/terms" target="_blank" className="shrink-0 text-xs font-bold underline">
          이용약관 보기
        </Link>
      </div>

      <div className="flex items-start justify-between gap-2">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className={checkboxClassName}
            checked={value.privacy}
            onChange={(event) => onChange({ ...value, privacy: event.target.checked })}
          />
          (필수) 개인정보 처리방침에 동의합니다
        </label>
        <Link href="/privacy" target="_blank" className="shrink-0 text-xs font-bold underline">
          처리방침 보기
        </Link>
      </div>

      {!complete ? (
        <p role="status" className="text-xs font-semibold text-red-500">
          필수 항목에 모두 동의해야 가입할 수 있습니다.
        </p>
      ) : null}
    </fieldset>
  );
}
