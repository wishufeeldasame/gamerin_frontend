'use client';

import Image from 'next/image';
import { ArrowLeft, Heart, MessageCircle, Share2, MoreHorizontal, Send } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface PostDetailProps {
  author: string;
  initials: string;
  timeAgo: string;
  game: string;
  content: string;
  imageUrl?: string | null;
  likes: number;
  comments: number;
  shares: number;
  onBack: () => void;
}

export function PostDetail({ author, initials, timeAgo, game, content, imageUrl, likes, comments, shares, onBack }: PostDetailProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [commentText, setCommentText] = useState('');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto pb-20">
      <button onClick={onBack} className="group flex items-center gap-2 text-zinc-400 hover:text-black mb-8 font-black text-sm uppercase tracking-widest transition-all">
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to Feed</span>
      </button>

      <article className="bg-white border border-zinc-100 rounded-[40px] overflow-hidden shadow-sm">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-black rounded-[20px] flex items-center justify-center text-white font-black text-lg shadow-xl">
                {initials}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-black tracking-tighter">{author}</h2>
                  <span className="px-2 py-0.5 bg-zinc-100 text-[10px] font-black rounded-lg uppercase text-zinc-500">{game}</span>
                </div>
                <p className="text-xs font-bold text-zinc-400">{timeAgo}</p>
              </div>
            </div>
            <button className="p-3 hover:bg-zinc-50 rounded-2xl transition-all text-zinc-300 hover:text-black">
              <MoreHorizontal size={24} />
            </button>
          </div>

          <p className="text-lg font-medium text-zinc-800 leading-relaxed mb-8">{content}</p>
          
          {imageUrl && (
            <div className="rounded-[32px] overflow-hidden border border-zinc-50 mb-8 shadow-inner">
              <Image
                src={imageUrl}
                alt={game}
                width={1200}
                height={800}
                sizes="(max-width: 768px) 100vw, 800px"
                className="h-auto max-h-[500px] w-full object-cover"
              />
            </div>
          )}

          <div className="flex items-center justify-between py-6 border-y border-zinc-50">
            <div className="flex items-center gap-8">
              <button onClick={() => setIsLiked(!isLiked)} className={`flex items-center gap-2 font-black text-sm transition-all ${isLiked ? 'text-red-500' : 'text-zinc-400 hover:text-black'}`}>
                <Heart size={22} className={isLiked ? 'fill-red-500' : ''} />
                <span>{likes + (isLiked ? 1 : 0)}</span>
              </button>
              <div className="flex items-center gap-2 font-black text-sm text-zinc-400">
                <MessageCircle size={22} />
                <span>{comments}</span>
              </div>
              <div className="flex items-center gap-2 font-black text-sm text-zinc-400">
                <Share2 size={22} />
                <span>{shares}</span>
              </div>
            </div>
            <button className="text-zinc-400 hover:text-black transition-all"><Send size={22} /></button>
          </div>

          {/* 댓글 입력 영역 */}
          <div className="mt-10 space-y-8">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 font-black text-xs flex-shrink-0">ME</div>
              <div className="flex-1 relative">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="당신의 생각을 공유하세요..."
                  className="w-full bg-zinc-50 border-none rounded-2xl px-5 py-4 text-[15px] text-black font-medium focus:ring-2 focus:ring-black transition-all resize-none"
                  rows={3}
                />
                <button className="absolute bottom-4 right-4 p-2 bg-black text-white rounded-xl hover:scale-105 active:scale-95 transition-all">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    </motion.div>
  );
}
