'use client';

import { Heart, MessageCircle, Repeat2, Share2, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";

// 기존 타입 정의를 유지하여 데이터 호환성을 확보합니다.
type PostProps = {
  author: string;
  initials: string;
  timeAgo: string;
  game: string;
  content: string;
  imageUrl: string;
  likes: number;
  comments: number;
  shares: number;
};

export function Post({
  author,
  initials,
  timeAgo,
  game,
  content,
  imageUrl,
  likes,
  comments,
  shares,
}: PostProps) {
  return (
    <motion.article 
      whileHover={{ y: -4 }} // 살짝 떠오르는 효과로 클릭하고 싶게 만듭니다.
      className="overflow-hidden rounded-[32px] border border-zinc-100 bg-white shadow-sm hover:shadow-xl transition-all duration-300"
    >
      {/* 1. 상단 유저 정보 영역 */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* 아바타: 노란색 대신 블랙으로 변경하여 무게감 확보 */}
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-black text-sm font-black text-white shadow-inner">
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <h2 className="text-[16px] font-black text-black tracking-tight">{author}</h2>
                {/* 게임 태그: 더 작고 볼드하게 */}
                <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                  {game}
                </span>
              </div>
              <span className="text-[11px] font-bold text-zinc-400">{timeAgo}</span>
            </div>
          </div>
          
          <button className="text-zinc-300 hover:text-black transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>

        {/* 2. 본문 텍스트: 행간을 조절하여 가독성 업그레이드 */}
        <p className="text-[15px] leading-7 text-zinc-800 font-medium px-1">
          {content}
        </p>
      </div>

      {/* 3. 이미지 영역: 꽉 채우지 않고 여백을 주어 고급스럽게 연출 */}
      {imageUrl && (
        <div className="px-5 pb-4">
          <div className="relative rounded-[24px] overflow-hidden border border-zinc-50 shadow-inner">
            <img
              src={imageUrl}
              alt={`${game} post by ${author}`}
              className="w-full object-cover max-h-[420px] hover:scale-105 transition-transform duration-700"
            />
          </div>
        </div>
      )}

      {/* 4. 하단 반응형 바: 아이콘 색감을 차분하게 빼고 텍스트를 볼드하게 */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-50 bg-white text-zinc-400">
        <div className="flex items-center gap-6">
          <button className="flex items-center gap-2 hover:text-red-500 transition-colors group">
            <Heart size={20} className="group-hover:fill-red-500 transition-all" />
            <span className="text-sm font-black text-zinc-800">{likes}</span>
          </button>
          
          <button className="flex items-center gap-2 hover:text-black transition-colors">
            <MessageCircle size={20} />
            <span className="text-sm font-black text-zinc-800">{comments}</span>
          </button>

          <button className="flex items-center gap-2 hover:text-black transition-colors">
            <Repeat2 size={20} />
            <span className="text-sm font-black text-zinc-800">{shares}</span>
          </button>
        </div>

        <button className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-black">
          <Share2 size={20} />
        </button>
      </div>
    </motion.article>
  );
}