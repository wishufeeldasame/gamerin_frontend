'use client';

import { useState } from 'react';
import { PostComposer } from "./components/PostComposer";
import { Post } from "./components/Post";
import { RightSidebar } from "./components/RightSidebar";
import { motion } from "framer-motion";

const posts = [
  {
    author: "Alex Kim",
    initials: "AK",
    timeAgo: "2h ago",
    game: "Elden Ring",
    // 👉 수정: 외계어를 지우고 🔥(불꽃) 이모지로 변경
    content: "드디어 말레니아를 47번의 시도 끝에 잡았습니다! 이 보스전은 정말 미쳤네요. 승리했을 때의 쾌감은 무엇과도 바꿀 수 없습니다. 🔥",
    imageUrl: "https://images.unsplash.com/photo-1774060526585-19be7b4af255?q=80&w=1080",
    likes: 324,
    comments: 45,
    shares: 12,
  },
  {
    author: "Maria Santos",
    initials: "MS",
    timeAgo: "5h ago",
    game: "Cyberpunk 2077",
    // 👉 수정: 외계어를 지우고 ✨(반짝이) 이모지로 변경
    content: "레이 트레이싱 업데이트 이후 나이트 시티의 야경이 정말 환상적입니다. 그래픽의 끝판왕이네요! ✨",
    imageUrl: "https://images.unsplash.com/photo-1607796884038-3638822d5ee2?q=80&w=1080",
    likes: 892,
    comments: 67,
    shares: 34,
  },
  {
    author: "Chris Lee",
    initials: "CL",
    timeAgo: "8h ago",
    game: "League of Legends",
    // 👉 수정: 외계어를 지우고 💎(다이아) 이모지로 변경
    content: "드디어 다이아 달성! 브론즈부터 시작해서 정말 긴 여정이었습니다. 응원해주신 분들 모두 감사합니다. 💎",
    imageUrl: "https://images.unsplash.com/photo-1529981188441-8a2e6fe30103?q=80&w=1080",
    likes: 567,
    comments: 89,
    shares: 23,
  }
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('all');

  return (
    <div className="flex justify-center overflow-visible">
      {/* 1. 중앙 메인 피드 영역 (Layout.tsx의 children으로 들어감) */}
      <main className="flex-1 max-w-2xl border-x border-zinc-50 min-h-screen">
        
        {/* 상단 탭 필터링 */}
        <div className="sticky top-16 z-20 bg-white/80 backdrop-blur-md border-b border-zinc-100 flex">
          {['추천 피드', '팔로잉'].map((tab, idx) => (
            <button
              key={tab}
              onClick={() => setActiveTab(idx === 0 ? 'all' : 'following')}
              className={`flex-1 py-4 text-[15px] font-black transition-all relative ${
                (idx === 0 && activeTab === 'all') || (idx === 1 && activeTab === 'following')
                ? "text-black" : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {tab}
              {((idx === 0 && activeTab === 'all') || (idx === 1 && activeTab === 'following')) && (
                <motion.div 
                  layoutId="underline" 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-black rounded-full" 
                />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-6">
          {/* 게시글 작성창 */}
          <PostComposer />

          {/* 피드 목록 애니메이션 */}
          <div className="space-y-4">
            {posts.map((post, index) => (
              <motion.div
                key={`${post.author}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Post {...post} />
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* 2. 오른쪽 사이드바 (메인 홈 피드에서만 노출) */}
      <aside className="hidden xl:block w-80 h-[calc(100vh-4rem)] sticky top-16 p-6">
        <RightSidebar />
      </aside>
    </div>
  );
}