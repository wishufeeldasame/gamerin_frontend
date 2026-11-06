'use client';

import { Skeleton } from 'skullet/react';

// skullet이 측정해 스켈레톤으로 그리는 자리 표시용 레이아웃(실제 데이터 아님).
// 실제 화면의 카드와 높이가 크게 어긋나지 않도록 각 화면의 레이아웃을 따른다.
const block = 'bg-zinc-200 dark:bg-zinc-800';

export function PostListSkeleton({ count = 2, label = '게시물을 불러오는 중' }: { count?: number; label?: string }) {
  return (
    <Skeleton loading label={label}>
      <div className="space-y-3">
        {Array.from({ length: count }, (_, index) => (
          <article key={index} className="rounded-card border border-line-card bg-surface p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full ${block}`} />
              <div>
                <p className="text-sm font-black">사용자 닉네임</p>
                <p className="text-xs">@handle · 방금 전</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6">게시물 본문이 들어갈 자리입니다. 게시물 본문이 들어갈 자리입니다. 게시물 본문이 들어갈 자리입니다.</p>
          </article>
        ))}
      </div>
    </Skeleton>
  );
}

export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <Skeleton loading label="대화 목록을 불러오는 중">
      <div className="space-y-1">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-3 py-3">
            <div className={`h-11 w-11 shrink-0 rounded-xl ${block}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black">대화 상대 이름</p>
              <p className="text-xs">마지막 메시지 미리보기가 들어갈 자리입니다.</p>
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function MessageThreadSkeleton() {
  return (
    <Skeleton loading label="메시지를 불러오는 중">
      <div className="space-y-6">
        {[false, true, false].map((mine, index) => (
          <div key={index} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <p className="max-w-[60%] rounded-2xl px-4 py-3 text-sm">메시지 내용이 들어갈 자리입니다.</p>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function ProgramListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Skeleton loading label="프로그램을 불러오는 중">
      <div className="grid gap-4">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="rounded-2xl border border-zinc-100 p-5 dark:border-zinc-800">
            <p className="mb-2 text-xs font-black">게임 이름</p>
            <h3 className="text-xl font-black">프로그램 제목이 들어갈 자리</h3>
            <p className="mt-2 text-sm leading-6">프로그램 소개가 들어갈 자리입니다. 프로그램 소개가 들어갈 자리입니다.</p>
            <p className="mt-3 text-xs font-black">멘토 이름 · 평점</p>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function ChargeProductsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <Skeleton loading label="충전 금액을 불러오는 중">
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:gap-3">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex min-h-16 flex-col justify-center rounded-xl border border-zinc-200 px-4 py-3 dark:border-neutral-700">
            <strong className="text-lg font-black">10,000원</strong>
            <span className="mt-0.5 text-xs font-bold">→ 10,000 M</span>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function UserRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <Skeleton loading label="사용자를 불러오는 중">
      <div className="space-y-2">
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-2 py-2">
            <div className={`h-11 w-11 shrink-0 rounded-xl ${block}`} />
            <div>
              <p className="text-sm font-black">사용자 닉네임</p>
              <p className="text-xs">@handle</p>
            </div>
          </div>
        ))}
      </div>
    </Skeleton>
  );
}

export function ProfileSkeleton() {
  return (
    <Skeleton loading label="프로필을 불러오는 중">
      <div className="px-4 pt-2 md:px-6 lg:pt-5 xl:max-w-[624px] xl:pr-0">
        <div className={`h-32 w-full rounded-xl md:h-56 md:rounded-card ${block}`} />
        <div className="-mt-9 md:-mt-11">
          <div className={`relative ml-3 size-[72px] rounded-full border-4 border-canvas md:ml-4 md:size-[88px] ${block}`} />
          <h1 className="mt-4 text-title">사용자 닉네임</h1>
          <p className="text-sm font-bold">@handle</p>
          <p className="mt-3 text-sm leading-6">자기소개가 들어갈 자리입니다. 자기소개가 들어갈 자리입니다.</p>
          <p className="mt-4 text-sm font-black">0 팔로워 0 팔로잉 0 게시물</p>
        </div>
        <div className="mt-8">
          <PostListSkeletonBody />
        </div>
      </div>
    </Skeleton>
  );
}

// ProfileSkeleton처럼 이미 Skeleton 안에 있을 때 쓰는 본문(중첩 Skeleton 방지)
function PostListSkeletonBody() {
  return (
    <article className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-full ${block}`} />
        <p className="text-sm font-black">사용자 닉네임</p>
      </div>
      <p className="mt-3 text-sm leading-6">게시물 본문이 들어갈 자리입니다. 게시물 본문이 들어갈 자리입니다.</p>
    </article>
  );
}
