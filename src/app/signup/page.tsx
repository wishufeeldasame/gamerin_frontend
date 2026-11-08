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
  const isStep1Valid = Boolean(
    !nameError &&
      !emailError &&
      isEmailVerified &&
      (!BIRTH_DATE_ENABLED || (birthMonth && birthDay && birthYear))
  );
  const isStep2Valid =
    !handleError && !passwordError && signupPassword === signupPasswordConfirm && isSignupConsentComplete(signupConsent);

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
        setSignupStep(1);
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
    <AuthPageShell title="회원가입" description="이메일을 인증하고 GamerIN 계정을 만들어 주세요.">
      <div>
            {signupStep === 1 ? (
              <form onSubmit={handleNextStep} noValidate>
                <h2 className="mb-8 text-3xl font-extrabold text-black">계정 만들기</h2>
                <div className="mb-5">
                  <div className="relative">
                    <input
                      type="text"
                      name="nickname"
                      autoComplete="nickname"
                      value={signupName}
                      onChange={(event) => setSignupName(event.target.value)}
                      placeholder="닉네임"
                      maxLength={NICKNAME_MAX_LENGTH}
                      className="w-full rounded-xl border border-gray-300 px-4 py-4 pr-20 text-black outline-none focus:border-black dark:placeholder:!text-zinc-400 dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d]"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-zinc-400">
                      {signupName.length} / {NICKNAME_MAX_LENGTH}
                    </span>
                  </div>
                  {signupName && nameError ? (
                    <p className="ml-2 mt-2 text-sm text-red-500">{nameError}</p>
                  ) : null}
                </div>
                <div className="mb-8">
                  <div className="flex gap-2">
                    <input
                      type="email"
                      name="email"
                      autoComplete="email"
                      value={signupEmail}
                      onChange={(event) => {
                        setSignupEmail(event.target.value);
                        resetEmailVerification();
                      }}
                      placeholder="이메일"
                      className="min-w-0 flex-1 rounded-xl border border-gray-300 px-4 py-4 text-black outline-none focus:border-black dark:placeholder:!text-zinc-400 dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d]"
                    />
                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={Boolean(emailError) || verificationPending || resendSecondsLeft > 0 || isEmailVerified}
                      className="shrink-0 rounded-xl bg-black px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {!emailCode ? '인증번호 받기' : resendSecondsLeft > 0 ? `재발송 (${resendSecondsLeft}초)` : '재발송'}
                    </button>
                  </div>
                  {signupEmail && emailError ? (
                    <p className="ml-2 mt-2 text-sm text-red-500">{emailError}</p>
                  ) : null}
                  {emailCode && !isEmailVerified ? (
                    <>
                      <div className="mt-3 flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <input
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
                            className="w-full rounded-xl border border-gray-300 px-4 py-4 pr-16 text-black outline-none focus:border-black dark:placeholder:!text-zinc-400 dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d]"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm tabular-nums text-red-500">
                            {formatRemaining(codeSecondsLeft)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleConfirmVerificationCode}
                          disabled={verificationCode.length !== 6 || verificationPending || codeSecondsLeft === 0}
                          className="shrink-0 rounded-xl bg-black px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                          확인
                        </button>
                      </div>
                      <p className="ml-2 mt-2 text-sm text-gray-500 dark:text-zinc-400">
                        {codeSecondsLeft > 0
                          ? `${emailCode.email}(으)로 보낸 인증번호를 입력해 주세요.`
                          : '인증번호가 만료되었습니다. 인증번호를 다시 받아 주세요.'}
                      </p>
                    </>
                  ) : null}
                  {isEmailVerified ? (
                    <p className="ml-2 mt-2 text-sm text-green-600 dark:text-green-400">이메일 인증이 완료되었습니다.</p>
                  ) : null}
                  {verificationError ? (
                    <p role="alert" className="ml-2 mt-2 text-sm text-red-500">{verificationError}</p>
                  ) : null}
                </div>
                {BIRTH_DATE_ENABLED ? (
                <div className="mb-3">
                  <h3 className="mb-2 text-lg font-bold text-black">생년월일</h3>
                  <p className="mb-5 text-sm leading-6 text-gray-500">
                    본인 확인 및 계정 보호를 위해 사용합니다.
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={birthMonth}
                      onChange={(event) => setBirthMonth(event.target.value)}
                      className="rounded-xl border border-gray-300 px-3 py-4 text-black outline-none focus:border-black"
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
                      className="rounded-xl border border-gray-300 px-3 py-4 text-black outline-none focus:border-black"
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
                      className="rounded-xl border border-gray-300 px-3 py-4 text-black outline-none focus:border-black"
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
                <button
                  type="submit"
                  disabled={!isStep1Valid}
                  className={`mt-8 w-full rounded-xl py-3.5 text-base font-bold transition ${
                    !isStep1Valid ? 'cursor-not-allowed bg-gray-300 text-white' : 'bg-black text-white hover:opacity-90'
                  }`}
                >
                  다음
                </button>
              </form>
            ) : null}

            {signupStep === 2 ? (
              <form onSubmit={handleCompleteSignup} noValidate>
                <h2 className="mb-4 text-2xl font-extrabold text-black sm:text-3xl">
                  아이디와 비밀번호를 설정하세요.
                </h2>
                <p className="mb-10 text-base text-gray-600 dark:text-zinc-400">
                  로그인에 사용할 아이디와 비밀번호를 입력해 주세요.
                </p>
                <div className="mb-5">
                  <div className="relative">
                    <input
                      type="text"
                      name="username"
                      autoComplete="username"
                      value={signupId}
                      onChange={(event) => setSignupId(event.target.value)}
                      placeholder="아이디 (영문 소문자, 숫자, _ 사용 가능)"
                      maxLength={HANDLE_MAX_LENGTH}
                      className="w-full rounded-xl border border-gray-300 px-4 py-4 pr-20 text-black outline-none focus:border-black dark:placeholder:!text-zinc-400 dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d]"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-zinc-400">
                      {signupId.length} / {HANDLE_MAX_LENGTH}
                    </span>
                  </div>
                  {signupId && handleError ? (
                    <p className="ml-2 mt-2 text-sm text-red-500">{handleError}</p>
                  ) : null}
                </div>
                <div className="mb-2">
                  <input
                    type="password"
                    name="new-password"
                    autoComplete="new-password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    placeholder="비밀번호 (8~20자, 영문·숫자·특수문자 포함)"
                    maxLength={PASSWORD_MAX_LENGTH}
                    className={`w-full rounded-xl border px-4 py-4 text-black outline-none dark:placeholder:!text-zinc-400 dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d] ${
                      signupPassword.length > 0 && passwordError
                        ? 'border-red-500'
                        : 'border-gray-300 focus:border-black'
                    }`}
                  />
                </div>
                {signupPassword.length > 0 && passwordError ? (
                  <p className="mb-5 ml-2 text-sm text-red-500">{passwordError}</p>
                ) : null}
                <div className="mb-2">
                  <input
                    type="password"
                    name="new-password-confirm"
                    autoComplete="new-password"
                    value={signupPasswordConfirm}
                    onChange={(event) => setSignupPasswordConfirm(event.target.value)}
                    placeholder="비밀번호 확인"
                    maxLength={PASSWORD_MAX_LENGTH}
                    className={`w-full rounded-xl border px-4 py-4 text-black outline-none dark:placeholder:!text-zinc-400 dark:focus:!border-[#f5b93d] dark:focus:ring-1 dark:focus:ring-[#f5b93d] ${
                      signupPasswordConfirm.length > 0
                        ? signupPassword === signupPasswordConfirm
                          ? 'border-gray-300 focus:border-black'
                          : 'border-red-500'
                        : 'border-gray-300 focus:border-black'
                    }`}
                  />
                </div>
                {signupPasswordConfirm.length > 0 ? (
                  <p
                    className={`mb-8 ml-2 text-sm ${
                      signupPassword === signupPasswordConfirm ? 'text-green-600 dark:text-green-400' : 'text-red-500'
                    }`}
                  >
                    {signupPassword === signupPasswordConfirm
                      ? '비밀번호가 일치합니다.'
                      : '비밀번호가 일치하지 않습니다.'}
                  </p>
                ) : null}
                <div className="mt-4">
                  <SignupConsent value={signupConsent} onChange={setSignupConsent} />
                </div>
                <button
                  type="submit"
                  disabled={!isStep2Valid || signupPending}
                  className={`mt-4 w-full rounded-xl py-3.5 text-base font-bold transition ${
                    !isStep2Valid ? 'cursor-not-allowed bg-gray-300 text-white' : 'bg-black text-white hover:opacity-90'
                  }`}
                >
                  가입 완료
                </button>
              </form>
            ) : null}
      </div>
      <Link href="/?login=1" className="mt-6 inline-block text-label text-fg-brand">로그인</Link>
    </AuthPageShell>
  );
}
