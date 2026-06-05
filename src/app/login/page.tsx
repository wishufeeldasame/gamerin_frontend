'use client';

import { ChevronDown, Eye, EyeOff, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/app/context/AuthContext';
import { setAccessToken } from '@/lib/auth-store';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';


type LoginUserPayload = {
  userId?: string | number;
  id?: string | number;
  sub?: string | number;
  handle?: string;
  nickname?: string;
  name?: string;
  gameTier?: string;
  bio?: string;
};

type LoginPayload = LoginUserPayload & {
  accessToken?: string;
  token?: string;
  user?: LoginUserPayload;
  member?: LoginUserPayload;
  account?: LoginUserPayload;
};

function decodeJwtPayload(token: string): LoginUserPayload | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const json = decodeURIComponent(
      atob(paddedBase64)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );

    return JSON.parse(json) as LoginUserPayload;
  } catch {
    return null;
  }
}

function unwrapLoginPayload(body: unknown): LoginPayload {
  if (!body || typeof body !== 'object') return {};

  const envelope = body as { data?: LoginPayload };
  return envelope.data && typeof envelope.data === 'object' ? envelope.data : (body as LoginPayload);
}

async function fetchCurrentUser(accessToken?: string | null): Promise<LoginUserPayload | null> {
  try {
    const headers = new Headers();
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) return null;

    const body = await response.json().catch(() => null);
    const payload = unwrapLoginPayload(body);
    return payload.user ?? payload.member ?? payload.account ?? payload;
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { user, isAuthReady, login } = useAuth();

  const [showIdLogin, setShowIdLogin] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  const [loginHandle, setLoginHandle] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [signupId, setSignupId] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('');

  const isPasswordLongEnough = signupPassword.length >= 8;
  const isStep1Valid = Boolean(
    signupName.trim() &&
      emailRegex.test(signupEmail) &&
      birthMonth &&
      birthDay &&
      birthYear
  );
  const isStep2Valid =
    signupId.length >= 4 &&
    signupPassword.length >= 8 &&
    signupPassword === signupPasswordConfirm;

  const resetSignup = () => {
    setShowSignupModal(false);
    setSignupStep(1);
    setSignupName('');
    setSignupEmail('');
    setBirthMonth('');
    setBirthDay('');
    setBirthYear('');
    setSignupId('');
    setSignupPassword('');
    setSignupPasswordConfirm('');
  };

  const handleNextStep = () => {
    if (isStep1Valid) {
      setSignupStep(2);
    }
  };

  const handleCompleteSignup = async () => {
    if (!isStep2Valid) return;

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          handle: signupId.trim(),
          nickname: signupName.trim(),
          email: signupEmail.trim(),
          password: signupPassword,
          passwordConfirm: signupPasswordConfirm,
          agreedToTerms: true,
          agreedToPrivacy: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || '회원가입에 실패했습니다.');
      }

      resetSignup();
      setShowIdLogin(true);
      setLoginHandle(signupId.trim());
    } catch (error) {
      alert(error instanceof Error ? error.message : '회원가입에 실패했습니다.');
    }
  };

  const handleLocalLogin = async () => {
    if (!loginHandle.trim() || !loginPassword.trim()) {
      setLoginError('아이디와 비밀번호를 입력해주세요.');
      return;
    }

    setLoginError('');
    setLoginLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          handle: loginHandle.trim(),
          password: loginPassword,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message || '아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      const payload = unwrapLoginPayload(data);
      const accessToken = payload.accessToken ?? payload.token ?? null;
      if (accessToken) {
        setAccessToken(accessToken);
      }

      const responseUser = payload.user ?? payload.member ?? payload.account ?? payload;
      const tokenUser = accessToken ? decodeJwtPayload(accessToken) : null;
      const me = await fetchCurrentUser(accessToken);
      const userPayload = me ?? responseUser ?? tokenUser ?? {};
      const handle = userPayload.handle ?? tokenUser?.handle ?? loginHandle.trim();
      const nickname = userPayload.nickname ?? userPayload.name ?? tokenUser?.nickname ?? handle;
      const userId =
        userPayload.userId ??
        userPayload.id ??
        userPayload.sub ??
        tokenUser?.userId ??
        tokenUser?.id ??
        tokenUser?.sub ??
        handle;

      if (!userId) {
        throw new Error('서버로부터 유저 고유 ID를 받아오지 못했습니다.');
      }

      login({
        id: String(userId),
        name: nickname,
        nickname,
        handle,
        gameTier: userPayload.gameTier ?? tokenUser?.gameTier ?? 'Unranked',
        bio: userPayload.bio ?? tokenUser?.bio ?? '',
      });

      router.push('/home');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : '로그인에 실패했습니다.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/oauth2/authorization/google`;
  };

  useEffect(() => {
    if (!isAuthReady || !user) return;
    router.replace('/home');
  }, [isAuthReady, router, user]);

  if (isAuthReady && user) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-8 font-sans text-black sm:px-8">
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <section className="flex justify-center lg:justify-start">
          <div className="relative flex h-44 w-44 items-center justify-center sm:h-64 sm:w-64 lg:h-80 lg:w-80">
            <Image
              src="/logo.png"
              alt="GamerIN Logo"
              width={500}
              height={500}
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>
        </section>

        <section className="w-full space-y-7">
          <div className="space-y-2 text-center lg:text-left">
            <p className="text-sm font-black uppercase tracking-widest text-zinc-400">GamerIN</p>
            <h1 className="text-2xl font-black tracking-tight text-black sm:text-3xl">지금 가입하세요.</h1>
          </div>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="group flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white transition-all hover:border-zinc-800 hover:bg-zinc-50"
            >
              <Image src="/google.png" alt="Google" width={20} height={20} />
              <span className="text-[15px] font-bold text-zinc-900">Google로 계속하기</span>
            </button>

            <button
              type="button"
              onClick={() => setShowIdLogin((current) => !current)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white transition-all hover:border-zinc-800"
            >
              <span className="text-[15px] font-bold text-zinc-900">
                {showIdLogin ? '닫기' : 'ID로 로그인'}
              </span>
              <ChevronDown
                size={18}
                className={`text-zinc-500 transition-transform duration-300 ${showIdLogin ? 'rotate-180' : ''}`}
              />
            </button>

            {showIdLogin ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 shadow-sm sm:p-6"
              >
                <input
                  type="text"
                  value={loginHandle}
                  onChange={(event) => setLoginHandle(event.target.value)}
                  placeholder="아이디"
                  className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-black outline-none transition-colors focus:border-black"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder="비밀번호"
                    className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 pr-12 text-black outline-none transition-colors focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
                    aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginError ? <p className="text-sm font-semibold text-red-500">{loginError}</p> : null}
                <button
                  type="button"
                  onClick={handleLocalLogin}
                  disabled={loginLoading}
                  className="h-12 w-full rounded-full bg-black text-[15px] font-bold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loginLoading ? '로그인 중...' : '로그인'}
                </button>
              </motion.div>
            ) : null}
          </div>

          <div className="flex justify-center gap-6 lg:justify-start">
            <Link href="/find-id" className="text-sm font-semibold text-zinc-500 transition-colors hover:text-black">
              아이디 찾기
            </Link>
            <div className="h-4 w-px self-center bg-zinc-200" />
            <Link
              href="/auth/forgot-password"
              className="text-sm font-semibold text-zinc-500 transition-colors hover:text-black"
            >
              비밀번호 찾기
            </Link>
          </div>

          <div className="border-t border-zinc-100 pt-7 text-center lg:text-left">
            <p className="text-[15px] font-medium text-zinc-600">
              아직 계정이 없으신가요?
              <button
                type="button"
                onClick={() => setShowSignupModal(true)}
                className="ml-2 font-extrabold text-black underline-offset-4 hover:underline"
              >
                회원가입
              </button>
            </p>
          </div>
        </section>
      </div>

      {showSignupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={resetSignup}
              className="mb-6 flex h-10 w-10 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-black"
              aria-label="회원가입 닫기"
            >
              <X size={22} />
            </button>

            {signupStep === 1 ? (
              <>
                <h2 className="mb-8 text-3xl font-extrabold text-black">계정을 생성하세요.</h2>
                <div className="mb-5">
                  <div className="relative">
                    <input
                      type="text"
                      value={signupName}
                      onChange={(event) => setSignupName(event.target.value)}
                      placeholder="이름"
                      maxLength={50}
                      className="w-full rounded-xl border border-gray-300 px-4 py-4 pr-20 text-black outline-none focus:border-black"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {signupName.length} / 50
                    </span>
                  </div>
                </div>
                <div className="mb-8">
                  <input
                    type="email"
                    value={signupEmail}
                    onChange={(event) => setSignupEmail(event.target.value)}
                    placeholder="이메일"
                    className="w-full rounded-xl border border-gray-300 px-4 py-4 text-black outline-none focus:border-black"
                  />
                </div>
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
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={!isStep1Valid}
                  className={`mt-8 w-full rounded-full py-4 text-lg font-bold transition ${
                    !isStep1Valid ? 'cursor-not-allowed bg-gray-300 text-white' : 'bg-black text-white hover:opacity-90'
                  }`}
                >
                  다음
                </button>
              </>
            ) : null}

            {signupStep === 2 ? (
              <>
                <h2 className="mb-4 text-2xl font-extrabold text-black sm:text-3xl">
                  아이디와 비밀번호를 설정하세요.
                </h2>
                <p className="mb-10 text-base text-gray-600">
                  로그인에 사용할 아이디와 비밀번호를 입력해주세요.
                </p>
                <div className="mb-5">
                  <div className="relative">
                    <input
                      type="text"
                      value={signupId}
                      onChange={(event) => {
                        const value = event.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        if (value.length <= 20) setSignupId(value);
                      }}
                      placeholder="아이디 (영문, 숫자, _ 사용 가능)"
                      maxLength={20}
                      className="w-full rounded-xl border border-gray-300 px-4 py-4 pr-20 text-black outline-none focus:border-black"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                      {signupId.length} / 20
                    </span>
                  </div>
                </div>
                <div className="mb-2">
                  <input
                    type="password"
                    value={signupPassword}
                    onChange={(event) => setSignupPassword(event.target.value)}
                    placeholder="비밀번호 (최소 8자)"
                    className={`w-full rounded-xl border px-4 py-4 text-black outline-none ${
                      signupPassword.length > 0 && !isPasswordLongEnough
                        ? 'border-red-500'
                        : 'border-gray-300 focus:border-black'
                    }`}
                  />
                </div>
                {signupPassword.length > 0 && !isPasswordLongEnough ? (
                  <p className="mb-5 ml-2 text-sm text-red-500">비밀번호는 최소 8자 이상이어야 합니다.</p>
                ) : null}
                <div className="mb-2">
                  <input
                    type="password"
                    value={signupPasswordConfirm}
                    onChange={(event) => setSignupPasswordConfirm(event.target.value)}
                    placeholder="비밀번호 확인"
                    className={`w-full rounded-xl border px-4 py-4 text-black outline-none ${
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
                      signupPassword === signupPasswordConfirm ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {signupPassword === signupPasswordConfirm
                      ? '비밀번호가 일치합니다.'
                      : '비밀번호가 일치하지 않습니다.'}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleCompleteSignup}
                  disabled={!isStep2Valid}
                  className={`mt-4 w-full rounded-full py-4 text-lg font-bold transition ${
                    !isStep2Valid ? 'cursor-not-allowed bg-gray-300 text-white' : 'bg-black text-white hover:opacity-90'
                  }`}
                >
                  가입 완료
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
