'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Lock, Eye, EyeOff, ChevronLeft, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  // 유효성 검사: 8자 이상 및 일치 여부
  const isPasswordValid = newPassword.length >= 8;
  const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordValid && isMatch) {
      setIsSuccess(true);
    }
  };

  // 성공 시 로그인 페이지로 이동
  if (isSuccess) {
    return (
      <div className="flex min-h-screen bg-white items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto shadow-xl">
            <CheckCircle2 size={40} className="text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-black tracking-tighter">비밀번호 변경 완료</h1>
            <p className="text-zinc-500 font-medium">새로운 비밀번호로 다시 로그인해 주세요.</p>
          </div>
          <button 
            onClick={() => router.push('/login')}
            className="w-full h-14 bg-black text-white rounded-full font-black text-[16px] hover:bg-zinc-800 transition-all"
          >
            로그인하러 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      
      {/* 1. 왼쪽: GamerIN 로고 영역 (일체감 유지) */}
      <div className="hidden md:flex flex-[0_0_45%] items-center justify-center p-12 bg-gray-50/50 border-r border-gray-100">
        <div className="relative w-80 h-80 flex items-center justify-center">
          <Image 
            src="/logo.png" 
            alt="GamerIN Logo" 
            width={600}
            height={600}
            className="object-contain drop-shadow-2xl"
            priority
          />
        </div>
      </div>

      {/* 2. 오른쪽: 비밀번호 재설정 폼 영역 */}
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-16 xl:p-24 relative">
        
        <Link href="/find-Password" className="absolute top-10 left-10 flex items-center gap-2.5 text-zinc-600 hover:text-black transition-colors font-semibold group">
          <div className="p-1.5 rounded-full border border-zinc-200 group-hover:border-black transition-colors">
            <ChevronLeft size={18} />
          </div>
          <span className="text-[15px]">이전으로 돌아가기</span>
        </Link>
        
        <div className="w-full max-w-[420px] mx-auto space-y-12 pt-16 md:pt-0">
          
          <div className="space-y-4">
            <h1 className="text-4xl font-black text-black tracking-tighter">
              비밀번호 재설정
            </h1>
            <p className="text-[16px] text-zinc-600 leading-relaxed font-medium">
              새로운 비밀번호를 입력해 주세요.<br />
              타인이 추측하기 어려운 비밀번호가 안전합니다.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 새 비밀번호 입력 */}
            <div className="space-y-1">
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Lock size={20} />
                </div>
                <input
                  type={showPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호 (최소 8자)"
                  className={`w-full h-14 rounded-2xl border bg-white px-14 text-black font-semibold outline-none transition-all placeholder:text-zinc-400 ${
                    newPassword && !isPasswordValid ? 'border-red-500' : 'border-zinc-200 focus:border-black'
                  }`}
                />
                <button 
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black"
                >
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* 비밀번호 확인 입력 */}
            <div className="space-y-1">
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 확인"
                className={`w-full h-14 rounded-2xl border bg-white px-14 text-black font-semibold outline-none transition-all placeholder:text-zinc-400 ${
                  confirmPassword && !isMatch ? 'border-red-500' : 'border-zinc-200 focus:border-black'
                }`}
              />
              {confirmPassword.length > 0 && (
                <p className={`text-xs font-bold ml-2 pt-1 ${isMatch ? "text-green-600" : "text-red-500"}`}>
                  {isMatch ? "✓ 비밀번호가 일치합니다." : "✗ 비밀번호가 일치하지 않습니다."}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!isPasswordValid || !isMatch}
              className="w-full h-14 bg-black text-white rounded-full font-black text-[16px] hover:bg-zinc-800 transition-all active:scale-[0.98] disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed mt-4"
            >
              비밀번호 변경하기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
