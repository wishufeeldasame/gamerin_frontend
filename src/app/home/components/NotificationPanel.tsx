'use client';

import { Heart, MessageCircle, UserPlus, X, Bell } from 'lucide-react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NotificationPanelProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

type NotificationType = 'like' | 'comment' | 'follow';

type Notification = {
  id: string;
  type: NotificationType;
  user: string;
  action: string;
  time: string;
  read: boolean;
  targetHref: string;
};

const initialNotifications: Notification[] = [
  {
    id: 'like-sarah',
    type: 'like',
    user: 'Sarah Chen',
    action: '님이 게시물을 좋아합니다',
    time: '5분 전',
    read: false,
    targetHref: '/home',
  },
  {
    id: 'comment-mike',
    type: 'comment',
    user: 'Mike Rodriguez',
    action: '님이 댓글을 남겼습니다',
    time: '1시간 전',
    read: false,
    targetHref: '/home',
  },
  {
    id: 'follow-emma',
    type: 'follow',
    user: 'Emma Watson',
    action: '님이 팔로우하기 시작했습니다',
    time: '2시간 전',
    read: true,
    targetHref: '/home/profile',
  },
  {
    id: 'message-jin',
    type: 'comment',
    user: 'Jin Park',
    action: '님이 메시지를 보냈습니다',
    time: '3시간 전',
    read: true,
    targetHref: '/home/messages',
  },
];

function getNotificationIcon(type: NotificationType) {
  if (type === 'like') return <Heart size={16} className="fill-red-500 text-red-500" />;
  if (type === 'comment') return <MessageCircle size={16} className="text-black" />;
  return <UserPlus size={16} className="text-blue-500" />;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('');
}

export function NotificationPanel({ onClose, onUnreadCountChange }: NotificationPanelProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  useEffect(() => {
    onUnreadCountChange?.(unreadCount);
  }, [onUnreadCountChange, unreadCount]);

  const markAsRead = (notificationId: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    onClose();
    router.push(notification.targetHref);
  };

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
            <div>
              <h2 className="font-black text-black text-lg tracking-tighter uppercase italic">알림</h2>
              <p className="text-[11px] font-bold text-zinc-400">
                읽지 않은 알림 {unreadCount}개
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-all text-zinc-400">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[450px] overflow-y-auto scrollbar-hide">
          {notifications.map((notif) => (
            <button
              key={notif.id}
              type="button"
              onClick={() => handleNotificationClick(notif)}
              className={`p-5 hover:bg-zinc-50 cursor-pointer transition-all border-b border-zinc-50 flex items-start gap-4 ${
                !notif.read ? 'bg-zinc-50/50' : ''
              } w-full text-left`}
            >
              <div className="relative">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white text-xs font-black shadow-lg">
                  {getInitials(notif.user)}
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
                {getNotificationIcon(notif.type)}
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 bg-zinc-50 text-center">
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="text-xs font-black text-black hover:underline uppercase tracking-widest disabled:text-zinc-300 disabled:hover:no-underline"
          >
            모두 읽음 처리
          </button>
        </div>
      </motion.div>
    </>
  );
}
