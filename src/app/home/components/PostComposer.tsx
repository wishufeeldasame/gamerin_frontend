'use client';

import { ImagePlus, Sparkles, Video } from "lucide-react";
import { useAuth } from "@/app/context/AuthContext"; // [추가] 인증 컨텍스트 임포트
import { useState } from "react";

export function PostComposer() {
  const { user } = useAuth(); // [추가] 로그인 유저 정보 가져오기
  const [content, setContent] = useState(''); // [추가] 입력 내용 상태 관리

  return (
    <section className="overflow-hidden rounded-[32px] border border-zinc-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex gap-4">
        {/* 아바타: 'ME' 대신 실제 유저의 첫 글자 노출 */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-sm font-black text-white shadow-inner">
          {user ? user.nickname.substring(0, 1).toUpperCase() : 'G'}
        </div>

        <div className="min-w-0 flex-1">
          {/* 입력 영역: Placeholder에 유저 닉네임 연동 */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={user ? `${user.nickname}님, 공유하고 싶은 게임 순간이 있나요?` : "로그인 후 게임 순간을 공유해보세요!"}
            className="min-h-[100px] w-full resize-none border-none bg-transparent text-[16px] font-medium text-black outline-none placeholder:text-zinc-400"
          />

          {/* 하단 툴바 영역 */}
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-50 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {/* 이미지 추가 */}
              <button 
                title="이미지 추가"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 transition-all hover:bg-black hover:text-white"
              >
                <ImagePlus size={20} />
              </button>
              
              {/* 비디오/하이라이트 추가 */}
              <button 
                title="하이라이트 추가"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 text-zinc-500 transition-all hover:bg-black hover:text-white"
              >
                <Video size={20} />
              </button>

              {/* AI 전적 분석 */}
              <button 
                title="AI 전적 분석"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-50 text-purple-500 transition-all hover:bg-purple-600 hover:text-white group"
              >
                <Sparkles size={20} className="group-hover:animate-pulse" />
              </button>
            </div>

            {/* 게시 버튼: 내용이 없거나 로그인하지 않으면 비활성화 처리 */}
            <button 
              disabled={!content.trim() || !user}
              className={`rounded-2xl px-8 py-3 text-sm font-black text-white transition-all shadow-lg shadow-zinc-200 ${
                content.trim() && user 
                ? "bg-black hover:scale-[1.02] active:scale-[0.98]" 
                : "bg-zinc-200 cursor-not-allowed shadow-none"
              }`}
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}