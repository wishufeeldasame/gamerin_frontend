'use client';

import { Heart, MessageCircle, UserPlus, X, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

interface NotificationPanelProps {
  onClose: () => void;
}

const notifications = [
  { type: 'like', user: 'Sarah Chen', action: '님이 당신의 포스트를 좋아합니다', time: '5분 전', read: false },
  { type: 'comment', user: 'Mike Rodriguez', action: '님이 댓글을 남겼습니다', time: '1시간 전', read: false },
  { type: 'follow', user: 'Emma Watson', action: '님이 당신을 팔로우하기 시작했습니다', time: '2시간 전', read: true },
];

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  return (
    <>
      {/* 백드롭 클릭 시 닫힘 */}
      <div className="fixed inset-0 z-[60]" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="fixed top-20 right-6 w-[380px] bg-white border border-zinc-100 rounded-[32px] shadow-2xl z-[70] overflow-hidden"
      >
        <div className="p-6 border-b border-zinc-50 flex items-center justify-between bg-white sticky top-0">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-black" />
            <h2 className="font-black text-black text-lg tracking-tighter uppercase italic">Notifications</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-all text-zinc-400">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[450px] overflow-y-auto scrollbar-hide">
          {notifications.map((notif, index) => (
            <div
              key={index}
              className={`p-5 hover:bg-zinc-50 cursor-pointer transition-all border-b border-zinc-50 flex items-start gap-4 ${
                !notif.read ? 'bg-zinc-50/50' : ''
              }`}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white text-xs font-black shadow-lg">
                  {notif.user.split(' ').map(n => n[0]).join('')}
                </div>
                {!notif.read && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full" />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-800 leading-snug">
                  <span className="font-black text-black">{notif.user}</span>
                  <span className="font-medium text-zinc-500"> {notif.action}</span>
                </p>
                <p className="text-[11px] font-bold text-zinc-400 mt-1 uppercase tracking-tighter">{notif.time}</p>
              </div>

              <div className="flex-shrink-0 self-center">
                {notif.type === 'like' && <Heart size={16} className="text-red-500 fill-red-500" />}
                {notif.type === 'comment' && <MessageCircle size={16} className="text-black fill-black" />}
                {notif.type === 'follow' && <UserPlus size={16} className="text-blue-500" />}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-zinc-50 text-center">
          <button className="text-xs font-black text-black hover:underline uppercase tracking-widest">
            View All Activity
          </button>
        </div>
      </motion.div>
    </>
  );
}
