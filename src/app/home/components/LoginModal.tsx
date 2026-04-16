'use client';

import { X, LockKeyhole, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginModalProps {
  onClose: () => void;
  action: string;
}

export function LoginModal({ onClose, action }: LoginModalProps) {
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* 배경 오버레이: 더 어둡고 블러 처리를 하여 모달에 집중하게 만듭니다. */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
        />

        {/* 모달 본체: Black & Bold 테마 적용 */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white w-full max-w-[400px] overflow-hidden rounded-[40px] shadow-2xl"
        >
          {/* 상단 장식 아이콘 영역 */}
          <div className="bg-black py-10 flex justify-center">
            <div className="w-20 h-20 bg-zinc-800 rounded-[28px] flex items-center justify-center text-white shadow-inner">
              <LockKeyhole size={36} strokeWidth={2.5} />
            </div>
          </div>

          <div className="p-8 pt-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-black text-black tracking-tighter mb-2">
                로그인이 필요합니다
              </h2>
              <p className="text-zinc-500 font-bold text-sm leading-relaxed">
                <span className="text-black font-black underline underline-offset-4 decoration-zinc-200">
                  {action}
                </span>{" "}
                기능은 게머린 회원만 이용할 수 있어요. <br />
                지금 로그인하고 모든 혜택을 누려보세요!
              </p>
            </div>

            <div className="space-y-3">
              <button
                className="w-full group flex items-center justify-center gap-2 py-4 bg-black text-white rounded-2xl font-black text-sm transition-all hover:bg-zinc-800 active:scale-[0.98] shadow-lg shadow-zinc-200"
              >
                <LogIn size={18} />
                로그인하러 가기
              </button>
              
              <button
                onClick={onClose}
                className="w-full py-4 bg-zinc-100 text-zinc-500 rounded-2xl font-black text-sm transition-all hover:bg-zinc-200 hover:text-black"
              >
                나중에 하기
              </button>
            </div>
          </div>

          {/* 닫기 버튼 */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-full transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}