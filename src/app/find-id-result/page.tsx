'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { AuthPageShell } from '@/app/auth/_components/AuthPageShell';
import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from "next/navigation";

function FindIdResultPageContent() {
  const searchParams = useSearchParams();
  const maskedHandle = searchParams.get("maskedHandle") ?? "";
  
// 1. URL 파라미터에서 createdAt 가져오기
  const createdAt = searchParams.get("createdAt");

  // 👉 [수정된 부분] 날짜가 유효한지 먼저 검사 (방어막)
  const parsedCreatedAt = createdAt ? Date.parse(createdAt) : NaN;

  // 2. 날짜 포맷팅 함수 (유효한 날짜일 때만 변환, 아니면 "정보 없음")
  const formattedDate =
    createdAt && !Number.isNaN(parsedCreatedAt)
      ? new Date(parsedCreatedAt).toLocaleDateString('ko-KR').replace(/\. /g, '.').slice(0, -1)
      : "정보 없음";

  return (
    <AuthPageShell
      title="아이디를 찾았습니다"
      description="회원님의 정보와 일치하는 아이디입니다."
      icon={<CheckCircle2 size={28} />}
      back={{ href: '/?login=1', label: '로그인 창으로 돌아가기' }}
    >
      {/* 1. 왼쪽: GamerIN 로고 전용 영역 */}
      {/* 2. 오른쪽: 결과 표시 영역 */}
      {/* 결과 카드 */}
      <div className="space-y-2 rounded-card border border-line bg-subtle p-6">
        <p className="text-caption text-fg-secondary">아이디</p>
        <p className="break-all text-title text-fg-primary">
          {maskedHandle || "조회 결과 없음"}
        </p>
        
        {/* 3. 하드코딩된 날짜 대신 변수(formattedDate) 사용 */}
        <p className="pt-2 text-label text-fg-secondary">
          가입일: {formattedDate}
        </p>
      </div>

      <Link
        href="/?login=1"
        className="btn-primary h-12 w-full"
      >
        로그인하러 가기
      </Link>

      <div className="border-t border-line pt-6 text-center text-body">
        <span className="text-fg-secondary">비밀번호도 잊으셨나요?</span>
        <Link href="/auth/forgot-password" className="ml-2 text-label text-fg-brand underline-offset-4 hover:underline">
          비밀번호 찾기
        </Link>
      </div>
    </AuthPageShell>
  );
}

function FindIdResultPageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-5 text-fg-secondary">
      <p role="status" className="text-body">
        조회 결과를 불러오는 중...
      </p>
    </div>
  );
}

export default function FindIdResultPage() {
  return (
    <Suspense fallback={<FindIdResultPageFallback />}>
      <FindIdResultPageContent />
    </Suspense>
  );
}
