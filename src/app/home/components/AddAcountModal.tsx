'use client';

import { X, Link as LinkIcon, PlusCircle, Globe } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddAccountModalProps {
  onClose: () => void;
  onAdd: (platform: string, url: string) => void;
}

export function AddAccountModal({ onClose, onAdd }: AddAccountModalProps) {
  const [platform, setPlatform] = useState('');
  const [url, setUrl] = useState('');

  const handleAdd = () => {
    if (platform.trim() && url.trim()) {
      onAdd(platform, url);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* 배경 오버레이 */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        />

        {/* 모달 컨텐츠 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-md overflow-hidden rounded-[40px] shadow-2xl"
        >
          {/* 상단 헤더 디자인 */}
          <div className="bg-zinc-50 px-8 py-8 border-b border-zinc-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shadow-lg">
                <LinkIcon size={24} />
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-zinc-200 flex items-center justify-center transition-all text-zinc-400 hover:text-black"
              >
                <X size={24} />
              </button>
            </div>
            <h3 className="text-2xl font-black text-black tracking-tighter">계정 연동</h3>
            <p className="text-sm font-bold text-zinc-400">당신의 게이밍 소셜 채널을 연결하세요.</p>
          </div>

          <div className="p-8 space-y-6">
            {/* 플랫폼 입력 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest ml-1">
                <PlusCircle size={14} />
                플랫폼 이름
              </label>
              <input
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-5 py-4 bg-zinc-50 border-2 border-transparent rounded-2xl text-black text-sm font-bold placeholder-zinc-300 focus:outline-none focus:border-black focus:bg-white transition-all"
                placeholder="예: YouTube, Twitch, Discord"
              />
            </div>

            {/* URL 입력 */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-black font-black text-xs uppercase tracking-widest ml-1">
                <Globe size={14} />
                계정 주소 (URL)
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-5 py-4 bg-zinc-50 border-2 border-transparent rounded-2xl text-black text-sm font-bold placeholder-zinc-300 focus:outline-none focus:border-black focus:bg-white transition-all"
                placeholder="예: youtube.com/@username"
              />
            </div>

            {/* 버튼 영역 */}
            <div className="flex gap-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 bg-zinc-100 text-zinc-500 font-black rounded-2xl hover:bg-zinc-200 hover:text-black transition-all"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={!platform.trim() || !url.trim()}
                className="flex-1 py-4 bg-black text-white font-black rounded-2xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                연동하기
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}