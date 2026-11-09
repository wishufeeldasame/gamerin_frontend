'use client';

import { useToast } from '@/app/context/ToastContext';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EMPTY_SIGNUP_CONSENT, SignupConsent, isSignupConsentComplete, toSignupConsentPayload } from '@/app/auth/_components/SignupConsent';
import { useAuth } from '@/app/context/AuthContext';
import {
  EmailVerificationExpiredError,
  confirmSignupEmailVerification,
  requestSignupEmailVerification,
  signUpWithPassword,
} from '@/lib/auth-api';
import { AuthTextField } from '@/app/auth/_components/AuthTextField';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { readLoginReturnTo, requestLogin } from '@/lib/login-prompt';
import { getPublicRequestErrorMessage } from '@/lib/public-request-error';
import {
  HANDLE_MAX_LENGTH,
  NICKNAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  validateEmail,
  validateHandle,
  validateNickname,
  validatePassword,
} from '@/lib/auth-validation';

// 백엔드 회원가입 API(SignUpRequest)에 생년월일 필드가 없어 입력을 숨기고 검증에서 뺀다.
// 계약이 생기면 true로 바꾸고 회원가입 요청 본문에 추가한다.
const BIRTH_DATE_ENABLED = false;

const formatRemaining = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export default function SignupPage() {
  const toast = useToast();
  const router = useRouter();
  const { user, isAuthReady } = useAuth();

  const [signupStep, setSignupStep] = useState<1 | 2>(1);


  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [signupId, setSignupId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');
  const [signupConsent, setSignupConsent] = useState(EMPTY_SIGNUP_CONSENT);
  const [signupPending, setSignupPending] = useState(false);

  // 인증번호를 보낸 이메일과 만료·재발송 가능 시각(ms). 이메일을 고치면 처음부터 다시 인증한다.
  const [emailCode, setEmailCode] = useState<{ email: string; expiresAt: number; resendAt: number } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationPending, setVerificationPending] = useState(false);
  const [now, setNow] = useState(0);
  // 이메일 수정·모달 닫기 뒤 도착한 이전 요청의 응답을 버린다.
  const verificationRunRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const nameError = validateNickname(signupName);
  const emailError = validateEmail(signupEmail);
  const handleError = validateHandle(signupId);
  const passwordError = validatePassword(signupPassword);
  const isEmailVerified = Boolean(emailVerificationToken);
  const codeSecondsLeft = emailCode ? Math.max(0, Math.ceil((emailCode.expiresAt - now) / 1000)) : 0;
  const resendSecondsLeft = emailCode ? Math.max(0, Math.ceil((emailCode.resendAt - now) / 1000)) : 0;
  const isStep1Valid = isSignupConsentComplete(signupConsent);
  const isStep2Valid = Boolean(
    isStep1Valid && !nameError && !emailError && isEmailVerified &&
    (!BIRTH_DATE_ENABLED || (birthMonth && birthDay && birthYear)) &&
    !handleError && !passwordError && signupPassword === signupPasswordConfirm
  );

  const resetEmailVerification = () => {
    verificationRunRef.current += 1;
    setEmailCode(null);
    setVerificationCode('');
    setEmailVerificationToken('');
    setVerificationError('');
    setVerificationPending(false);
  };

  const handleSendVerificationCode = async () => {
    if (emailError || verificationPending || resendSecondsLeft > 0 || isEmailVerified) return;
    const email = signupEmail.trim();
    const run = ++verificationRunRef.current;
    setVerificationPending(true);
    setVerificationError('');

    try {
      const sent = await requestSignupEmailVerification(email);
      if (run !== verificationRunRef.current) return;
      const sentAt = Date.now();
      setNow(sentAt);
      setEmailCode({
        email,
        expiresAt: sentAt + sent.expiresInSeconds * 1000,
        resendAt: sentAt + sent.resendCooldownSeconds * 1000,
      });
      setVerificationCode('');
    } catch (error) {
      if (run !== verificationRunRef.current) return;
      setVerificationError(getPublicRequestErrorMessage(error, '인증번호 발송에 실패했습니다.'));
    } finally {
      if (run === verificationRunRef.current) setVerificationPending(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    if (!emailCode || verificationPending || !/^\d{6}$/.test(verificationCode) || codeSecondsLeft === 0) return;
    const run = ++verificationRunRef.current;
    setVerificationPending(true);
    setVerificationError('');

    try {
      const token = await confirmSignupEmailVerification(emailCode.email, verificationCode);
      if (run !== verificationRunRef.current) return;
      setEmailVerificationToken(token);
      setVerificationCode('');
    } catch (error) {
      if (run !== verificationRunRef.current) return;
      setVerificationError(getPublicRequestErrorMessage(error, '인증번호 확인에 실패했습니다.'));
    } finally {
      if (run === verificationRunRef.current) setVerificationPending(false);
    }
  };

  const handleNextStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isStep1Valid) {
      setSignupStep(2);
    }
  };

  const handleCompleteSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isStep2Valid) return;

    if (signupPending) return;
    setSignupPending(true);

    try {
      await signUpWithPassword({
        handle: signupId.trim(),
        nickname: signupName.trim(),
        email: signupEmail.trim(),
        password: signupPassword,
        passwordConfirm: signupPasswordConfirm,
        emailVerificationToken,
        ...toSignupConsentPayload(signupConsent),
      });

      if (!mountedRef.current) return;
      router.replace('/');
      requestLogin({ initialHandle: signupId.trim(), returnTo: readLoginReturnTo(), message: '가입이 완료되었습니다. 로그인해 주세요.' });
    } catch (error) {
      if (error instanceof EmailVerificationExpiredError) {
        resetEmailVerification();
        setVerificationError(error.message);
        return;
      }
      toast.error(getPublicRequestErrorMessage(error, '회원가입에 실패했습니다.'));
    } finally {
      setSignupPending(false);
    }
  };

  useEffect(() => {
    if (!emailCode || isEmailVerified) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [emailCode, isEmailVerified]);

  useEffect(() => {
    if (isAuthReady && user) router.replace(readLoginReturnTo());
  }, [isAuthReady, user, router]);

  if (isAuthReady && user) return null;
  return (
    <AuthPageShell
      title="회원가입"
      description={signupStep === 1 ? '서비스 이용을 위한 약관을 확인하고 동의해 주세요.' : '이메일을 인증하고 계정 정보를 입력해 주세요.'}
    >
      <div>
        <p role="status" className="mb-4 text-label text-fg-secondary">
          {signupStep} / 2 · {signupStep === 1 ? '약관 동의' : '계정 정보 입력'}
        </p>
        {signupStep === 1 ? (
          <form onSubmit={handleNextStep}>
            <SignupConsent value={signupConsent} onChange={setSignupConsent} />
            <button type="submit" disabled={!isStep1Valid} className="btn-primary mt-6 h-12 w-full">
              다음
            </button>
          </form>
        ) : (
              <form onSubmit={handleCompleteSignup} noValidate>
                <h2 className="mb-6 text-title text-fg-primary">계정 정보 입력</h2>
                <div className="mb-5">
                  <label htmlFor="signup-nickname" className="mb-2 block text-label text-fg-primary">닉네임</label>
                  <div className="relative">
                    <AuthTextField
                      type="text"
                      id="signup-nickname"
                      autoFocus
                      invalid={Boolean(signupName && nameError)}
                      aria-describedby={Boolean(signupName && nameError) ? "signup-nickname-error" : undefined}
                      name="nickname"
                      autoComplete="nickname"
                      value={signupName}
                      onChange={(event) => setSignupName(event.target.value)}
                      placeholder="닉네임"
                      maxLength={NICKNAME_MAX_LENGTH}
                      className="pr-20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-caption text-fg-secondary">
                      {signupName.length} / {NICKNAME_MAX_LENGTH}
                    </span>
                  </div>
                  {signupName && nameError ? (
                    <p id="signup-nickname-error" className="ml-2 mt-2 text-caption text-fg-danger">{nameError}</p>
                  ) : null}
                </div>
                <div className="mb-8">
                  <label htmlFor="signup-email" className="mb-2 block text-label text-fg-primary">이메일</label>
                  <div className="flex gap-2">
                    <AuthTextField
                      type="email"
                      id="signup-email"
                      invalid={Boolean(signupEmail && emailError)}
                      aria-describedby={Boolean(signupEmail && emailError) ? "signup-email-error" : undefined}
                      name="email"
                      autoComplete="email"
                      value={signupEmail}
                      onChange={(event) => {
                        setSignupEmail(event.target.value);
                        resetEmailVerification();
                      }}
                      placeholder="이메일"
                      className="min-w-0 flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={Boolean(emailError) || verificationPending || resendSecondsLeft > 0 || isEmailVerified}
                      className="btn-secondary h-12 px-3"
                    >
                      {!emailCode ? '인증번호 받기' : resendSecondsLeft > 0 ? `재발송 (${resendSecondsLeft}초)` : '재발송'}
                    </button>
                  </div>
                  {signupEmail && emailError ? (
                    <p id="signup-email-error" className="ml-2 mt-2 text-caption text-fg-danger">{emailError}</p>
                  ) : null}
                  {emailCode && !isEmailVerified ? (
                    <>
                      <div className="mt-3 flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <AuthTextField
                            type="text"
                            name="email-verification-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            aria-label="인증번호"
                            value={verificationCode}
                            onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              void handleConfirmVerificationCode();
                            }}
                            placeholder="인증번호 6자리"
                            maxLength={6}
                            className="pr-16"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-caption tabular-nums text-fg-danger">
                            {formatRemaining(codeSecondsLeft)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConfirmVerificationCode}
                          disabled={verificationCode.length !== 6 || verificationPending || codeSecondsLeft === 0}
                          className="btn-secondary h-12 px-3"
                        >
                          확인
                        </button>
                      </div>
                      <p className="ml-2 mt-2 text-caption text-fg-secondary">
                        {codeSecondsLeft > 0
                          ? `${emailCode.email}(으)로 보낸 인증번호를 입력해 주세요.`
                          : '인증번호가 만료되었습니다. 인증번호를 다시 받아 주세요.'}
                      </p>
                    </>
                  ) : null}
                  {isEmailVerified ? (
                    <p className="ml-2 mt-2 text-sm text-fg-secondary">이메일 인증이 완료되었습니다.</p>
                  ) : null}
                  {verificationError ? (
                    <p role="alert" className="ml-2 mt-2 text-caption text-fg-danger">{verificationError}</p>
                  ) : null}
                </div>
                {BIRTH_DATE_ENABLED ? (
                <div className="mb-3">
                  <h3 className="mb-2 text-heading text-fg-primary">생년월일</h3>
                  <p className="mb-5 text-body text-fg-secondary">
                    본인 확인 및 계정 보호를 위해 사용합니다.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={birthMonth}
                      onChange={(event) => setBirthMonth(event.target.value)}
                      className="input-base h-12 min-w-0"
                    >
                      <option value="">월</option>
                      {Array.from({ length: 12 }, (_, index) => (
                        <option key={index + 1} value={String(index + 1)}>
                          {index + 1}월
                        </option>
                      ))}
                    </select>
                    <select
                      value={birthDay}
                      onChange={(event) => setBirthDay(event.target.value)}
                      className="input-base h-12 min-w-0"
                    >
                      <option value="">일</option>
                      {Array.from({ length: 31 }, (_, index) => (
                        <option key={index + 1} value={String(index + 1)}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                    <select
                      value={birthYear}
                      onChange={(event) => setBirthYear(event.target.value)}
                      className="input-base h-12 min-w-0"
                    >
                      <option value="">연도</option>
                      {Array.from({ length: 100 }, (_, index) => {
                        const year = new Date().getFullYear() - index;
                        return (
                          <option key={year} value={String(year)}>
                            {year}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                ) : null}
                <div className="mb-5">
                  <label htmlFor="signup-username" className="mb-2 block text-label text-fg-primary">아이디</label>
                  <div className="relative">
                    <AuthTextField
                      type="text"
                      id="signup-username"
                      invalid={Boolean(signupId && handleError)}
                      aria-describedby={Boolean(signupId && handleError) ? "signup-username-error" : undefined}
                      name="username"
                      autoComplete="username"
                      value={signupId}
                      onChange={(event) => setSignupId(event.target.value)}
                      placeholder="아이디 (영문 소문자, 숫자, _ 사용 가능)"
                      maxLength={HANDLE_MAX_LENGTH}
                      className="pr-20"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-caption text-fg-secondary">
                      {signupId.length} / {HANDLE_MAX_LENGTH}
                    </span>
                  </div>
                  {signupId && handleError ? (
                    <p id="signup-username-error" className="ml-2 mt-2 text-caption text-fg-danger">{handleError}</p>
                  ) : null}
                </div>
                <div className="mb-2">
                  <label htmlFor="signup-new-password" className="mb-2 block text-label text-fg-primary">비밀번호</label>
                  <AuthTextField
                    type="password"
                    id="signup-new-password"
                    name="new-password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    placeholder="비밀번호 (8~20자, 영문·숫자·특수문자 포함)"
                    maxLength={PASSWORD_MAX_LENGTH}
                    invalid={signupPassword.length > 0 && Boolean(passwordError)}
                    aria-describedby={signupPassword && passwordError ? "signup-password-error" : undefined}
                  />
                </div>
                {signupPassword.length > 0 && passwordError ? (
                  <p id="signup-password-error" className="mb-5 ml-2 text-caption text-fg-danger">{passwordError}</p>
                ) : null}
                <div className="mb-2">
                  <label htmlFor="signup-new-password-confirm" className="mb-2 block text-label text-fg-primary">비밀번호 확인</label>
                  <AuthTextField
                    type="password"
                    id="signup-new-password-confirm"
                    name="new-password-confirm"
                    autoComplete="new-password"
                    value={signupPasswordConfirm}
                    onChange={(event) => setSignupPasswordConfirm(event.target.value)}
                    placeholder="비밀번호 확인"
                    maxLength={PASSWORD_MAX_LENGTH}
                    invalid={signupPasswordConfirm.length > 0 && signupPassword !== signupPasswordConfirm}
                    aria-describedby={signupPasswordConfirm ? "signup-password-match" : undefined}
                  />
                </div>
                {signupPasswordConfirm.length > 0 ? (
                  <p
                    id="signup-password-match"
                    className={`mb-8 ml-2 text-caption ${
                      signupPassword === signupPasswordConfirm ? 'text-fg-secondary' : 'text-fg-danger'
                    }`}
                  >
                    {signupPassword === signupPasswordConfirm
                      ? '비밀번호가 일치합니다.'
                      : '비밀번호가 일치하지 않습니다.'}
                  </p>
                ) : null}
                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => setSignupStep(1)} disabled={signupPending} className="btn-secondary h-12">
                    이전
                  </button>
                  <button
                    type="submit"
                    disabled={!isStep2Valid || signupPending}
                    className="btn-primary h-12 flex-1"
                  >
                    {signupPending ? '가입 중...' : '가입 완료'}
                  </button>
                </div>
              </form>
        )}
      </div>
      <Link href="/?login=1" className="mt-6 inline-block text-label text-fg-brand">로그인</Link>
    </AuthPageShell>
  );
}
