'use client';

import { AlertCircle, X, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function ErrorToast({ message, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="fixed bottom-10 right-10 bg-white border-2 border-red-500/10 p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-w-sm z-[150] flex items-center gap-4"
    >
      <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 flex-shrink-0 shadow-sm">
        <AlertCircle size={24} />
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-black text-black uppercase tracking-tighter mb-0.5 leading-none">System Error</p>
        <p className="text-xs font-bold text-zinc-500 leading-tight">{message}</p>
      </div>
      <button onClick={onClose} className="text-zinc-300 hover:text-black transition-all">
        <X size={18} />
      </button>
    </motion.div>
  );
}

export function SuccessToast({ message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <motion.div 
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="fixed bottom-10 right-10 bg-white border-2 border-green-500/10 p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-w-sm z-[150] flex items-center gap-4"
    >
      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600 flex-shrink-0 shadow-sm">
        <CheckCircle2 size={24} />
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-black text-black uppercase tracking-tighter mb-0.5 leading-none">Success</p>
        <p className="text-xs font-bold text-zinc-500 leading-tight">{message}</p>
      </div>
      <button onClick={onClose} className="text-zinc-300 hover:text-black transition-all">
        <X size={18} />
      </button>
    </motion.div>
  );
}
