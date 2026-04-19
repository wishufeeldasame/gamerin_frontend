'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from "next/navigation";

export default function FindIdResultPage() {
  const searchParams = useSearchParams();
  const maskedHandle = searchParams.get("maskedHandle") ?? "";
  
  // 1. URL 파라미터에서 createdAt 가져오기
  const createdAt = searchParams.get("createdAt");

  // 2. 날짜 포맷팅 함수 (예: 2026-03-15T12:00:00Z -> 2026.03.15)
  const formattedDate = createdAt 
    ? new Date(createdAt).toLocaleDateString('ko-KR').replace(/\. /g, '.').slice(0, -1)
    : "정보 없음";

  return (
    <div className="flex min-h-screen bg-white font-sans text-black">
      
      {/* 1. 왼쪽: GamerIN 로고 전용 영역 */}
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

      {/* 2. 오른쪽: 결과 표시 영역 */}
      <div className="flex-1 flex flex-col justify-center p-8 lg:p-16 xl:p-24 relative">
        
        <Link href="/login" className="absolute top-10 left-10 flex items-center gap-2.5 text-zinc-600 hover:text-black transition-colors font-semibold group">
          <div className="p-1.5 rounded-full border border-zinc-200 group-hover:border-black transition-colors">
            <ChevronLeft size={18} />
          </div>
          <span className="text-[15px]">로그인 페이지로 돌아가기</span>
        </Link>
        
        <div className="w-full max-w-[420px] mx-auto space-y-10 pt-16 md:pt-0">
          
          <div className="space-y-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle2 size={32} className="text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-black tracking-tighter">
                아이디를 찾았습니다
              </h1>
              <p className="text-[16px] text-zinc-600 font-medium">
                회원님의 정보와 일치하는 아이디입니다.
              </p>
            </div>
          </div>

          {/* 결과 카드 */}
          <div className="p-8 border border-zinc-200 rounded-3xl bg-zinc-50 space-y-2">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">User ID</p>
            <p className="text-3xl font-black text-black tracking-tight">
              {maskedHandle || "조회 결과 없음"}
            </p>
            
            {/* 3. 하드코딩된 날짜 대신 변수(formattedDate) 사용 */}
            <p className="text-sm text-zinc-500 pt-2 font-medium">
              가입일: {formattedDate}
            </p>
          </div>

          <Link
            href="/login"
            className="flex items-center justify-center w-full h-14 bg-black text-white rounded-full font-black text-[16px] hover:bg-zinc-800 transition-all active:scale-[0.98] no-underline"
          >
            로그인하러 가기
          </Link>

          <div className="pt-6 border-t border-zinc-100 text-center text-[15px]">
            <span className="text-zinc-500 font-medium">비밀번호도 모르시겠나요?</span>
            <Link href="/find-Password" className="ml-2 font-black text-black hover:underline underline-offset-4">
              비밀번호 찾기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}