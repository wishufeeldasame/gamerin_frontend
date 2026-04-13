'use client';

import { Eye, EyeOff, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export default function LoginPage() {
  const router = useRouter();

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
    if (isStep1Valid) setSignupStep(2);
  };

  const handleCompleteSignupLegacy = () => {
    if (isStep2Valid) {
      alert('회원가입 완료');
      resetSignup();
    }
  };

  const resetSignupForm = () => {
    resetSignup();
  };

  const handleCompleteSignup = async () => {
    if (!isStep2Valid) return;
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          handle: signupId.trim(),
          nickname: signupName.trim(),
          password: signupPassword,
          passwordConfirm: signupPasswordConfirm,
          agreedToTerms: true,
          agreedToPrivacy: true,
        }),
      });

      if (!response.ok) {
        throw new Error('회원가입에 실패했습니다.');
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          handle: loginHandle.trim(),
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
      }

      router.push('/home');
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : '로그인에 실패했습니다.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE}/oauth2/authorization/google`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6 font-sans text-black">
      <div className="flex w-full max-w-5xl flex-col items-center justify-around gap-16 lg:flex-row">
        <div className="flex flex-col items-center">
          <div className="relative flex h-64 w-64 items-center justify-center lg:h-80 lg:w-80">
            <Image
              src="/logo.png"
              alt="GamerIN Logo"
              width={500}
              height={500}
              className="object-contain drop-shadow-xl"
              priority
            />
          </div>
        </div>

        <div className="w-full max-w-sm space-y-8">
          <h1 className="text-xl font-black tracking-tight text-black">
            지금 가입하세요.
          </h1>

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="group flex h-12 w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white transition-all hover:border-zinc-800 hover:bg-zinc-50"
            >
              <Image src="/google.png" alt="Google" width={20} height={20} />
              <span className="text-[15px] font-bold text-zinc-900">
                Google로 계속하기
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowIdLogin(!showIdLogin)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-white transition-all hover:border-zinc-800"
            >
              <span className="text-[15px] font-bold text-zinc-900">
                {showIdLogin ? '닫기' : 'ID로 로그인'}
              </span>
              <ChevronDown
                size={18}
                className={`text-zinc-500 transition-transform duration-300 ${
                  showIdLogin ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showIdLogin && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm"
              >
                <input
                  type="text"
                  value={loginHandle}
                  onChange={(e) => setLoginHandle(e.target.value)}
                  placeholder="아이디"
                  className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-black outline-none transition-colors focus:border-black"
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="비밀번호"
                    className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 pr-12 text-black outline-none transition-colors focus:border-black"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginError && (
                  <p className="text-sm text-red-500">{loginError}</p>
                )}
                <button
                  type="button"
                  onClick={handleLocalLogin}
                  disabled={loginLoading}
                  className="h-12 w-full rounded-full bg-black text-[15px] font-bold text-white transition-all hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  로그인
                </button>
              </motion.div>
            )}
          </div>

          <div className="flex justify-center gap-6">
            <Link
              href="/find-id"
              className="text-sm font-semibold text-zinc-500 transition-colors hover:text-black"
            >
              아이디 찾기
            </Link>
            <div className="h-4 w-[1px] self-center bg-zinc-200" />
            <Link
              href="/find-Password"
              className="text-sm font-semibold text-zinc-500 transition-colors hover:text-black"
            >
              비밀번호 찾기
            </Link>
          </div>

          <div className="border-t border-zinc-100 pt-8 text-center">
            <p className="text-[15px] font-medium text-zinc-600">
              아직 계정이 없으신가요?{' '}
              <button
                type="button"
                onClick={() => setShowSignupModal(true)}
                className="ml-1 font-extrabold text-black underline-offset-4 hover:underline"
              >
                회원가입
              </button>
            </p>
          </div>
        </div>
      </div>

      {showSignupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setShowSignupModal(false)}
              className="mb-6 text-2xl text-gray-700 hover:text-black"
            >
              ×
            </button>

            {signupStep === 1 && (
              <>
                <h1 className="mb-8 text-3xl font-extrabold text-black md:text-3xl">
                  계정을 생성하세요
                </h1>

                <div className="mb-5">
                  <div className="relative">
                    <input
                      type="text"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
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
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="이메일"
                    className="w-full rounded-xl border border-gray-300 px-4 py-4 text-black outline-none focus:border-black"
                  />
                </div>

                <div className="mb-3">
                  <h2 className="mb-2 text-lg font-bold text-black">생년월일</h2>
                  <p className="mb-5 text-sm leading-6 text-gray-500">
                    이 정보는 공개적으로 표시되지 않습니다. 계정 주제와 상관없이
                    나이 확인을 위해 사용됩니다.
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    <select
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                      className="rounded-xl border border-gray-300 px-4 py-4 text-black outline-none focus:border-black"
                    >
                      <option value="">월</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          {i + 1}월
                        </option>
                      ))}
                    </select>

                    <select
                      value={birthDay}
                      onChange={(e) => setBirthDay(e.target.value)}
                      className="rounded-xl border border-gray-300 px-4 py-4 text-black outline-none focus:border-black"
                    >
                      <option value="">일</option>
                      {Array.from({ length: 31 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          {i + 1}
                        </option>
                      ))}
                    </select>

                    <select
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                      className="rounded-xl border border-gray-300 px-4 py-4 text-black outline-none focus:border-black"
                    >
                      <option value="">년</option>
                      {Array.from({ length: 100 }, (_, i) => {
                        const year = new Date().getFullYear() - i;
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
                    !isStep1Valid
                      ? 'cursor-not-allowed bg-gray-300 text-white'
                      : 'bg-black text-white hover:opacity-90'
                  }`}
                >
                  다음
                </button>

                <div className="mt-8 border-t border-gray-200 pt-6 text-center text-sm text-gray-600">
                  이미 계정이 있으신가요?{' '}
                  <button
                    type="button"
                    onClick={resetSignupForm}
                    className="font-bold text-black hover:underline"
                  >
                    로그인
                  </button>
                </div>
              </>
            )}

            {signupStep === 2 && (
              <>
                <h1 className="mb-4 text-3xl font-extrabold text-black md:text-2xl">
                  아이디와 비밀번호를 설정하세요
                </h1>

                <p className="mb-10 text-base text-gray-600">
                  게머린에서 사용할 아이디와 비밀번호를 입력해주세요.
                </p>

                <div className="mb-5">
                  <div className="relative">
                    <input
                      type="text"
                      value={signupId}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        if (value.length <= 20) {
                          setSignupId(value);
                        }
                      }}
                      placeholder="아이디 (영문, 숫자, _ 만 사용 가능)"
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
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="비밀번호 (최소 8자)"
                    className={`w-full rounded-xl border px-4 py-4 text-black outline-none ${
                      signupPassword.length > 0 && !isPasswordLongEnough
                        ? 'border-red-500'
                        : 'border-gray-300 focus:border-black'
                    }`}
                  />
                </div>

                {signupPassword.length > 0 && !isPasswordLongEnough && (
                  <p className="mb-5 ml-2 text-sm text-red-500">
                    비밀번호는 최소 8자 이상이어야 합니다.
                  </p>
                )}

                <div className="mb-2">
                  <input
                    type="password"
                    value={signupPasswordConfirm}
                    onChange={(e) => setSignupPasswordConfirm(e.target.value)}
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

                {signupPasswordConfirm.length > 0 && (
                  <p
                    className={`mb-8 ml-2 text-sm ${
                      signupPassword === signupPasswordConfirm
                        ? 'text-green-600'
                        : 'text-red-500'
                    }`}
                  >
                    {signupPassword === signupPasswordConfirm
                      ? '비밀번호가 일치합니다.'
                      : '비밀번호가 일치하지 않습니다.'}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCompleteSignup}
                  disabled={!isStep2Valid}
                  className={`mt-4 w-full rounded-full py-4 text-lg font-bold transition ${
                    !isStep2Valid
                      ? 'cursor-not-allowed bg-gray-300 text-white'
                      : 'bg-black text-white hover:opacity-90'
                  }`}
                >
                  가입 완료
                </button>

                <div className="mt-8 border-t border-gray-200 pt-6 text-center text-sm text-gray-600">
                  이미 계정이 있으신가요?{' '}
                  <button
                    type="button"
                    onClick={resetSignupForm}
                    className="font-bold text-black hover:underline"
                  >
                    로그인
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
