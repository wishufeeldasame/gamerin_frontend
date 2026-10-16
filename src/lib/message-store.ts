'use client';

import { formatRelativeTimeLabel } from '@/lib/time-format';

export type MessageRecipient = {
  id: string;
  name: string;
  handle: string;
  role: string;
  online: boolean;
  profileImageUrl?: string | null;
};

export type SharedPostPreview = {
  postId: string;
  author: string;
  authorHandle: string;
  content: string;
  createdAt: string;
};

export type ChatAttachment = {
  id: string;
  type: 'image' | 'video';
  name: string;
  url: string;
};

export type ChatMessage = {
  id: string;
  senderId: 'me' | string;
  text: string;
  createdAt: string;
  read: boolean;
  deliveryStatus: 'sent';
  attachments: ChatAttachment[];
  sharedPost: SharedPostPreview | null;
};

export type Conversation = {
  id: string;
  recipient: MessageRecipient;
  messages: ChatMessage[];
  unreadCount: number;
  updatedAt: string;
};

export type MessageCursorPage = {
  items: ChatMessage[];
  nextCursor: string | null;
  hasNext: boolean;
};

export function getInitials(name: string, fallback = 'G') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatChatTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isSameLocalDate(left: string | Date, right: string | Date) {
  const leftDate = typeof left === 'string' ? new Date(left) : left;
  const rightDate = typeof right === 'string' ? new Date(right) : right;

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function formatMessageDate(createdAt: string, now = new Date()) {
  const messageDate = new Date(createdAt);

  if (isSameLocalDate(messageDate, now)) {
    return '오늘';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDate(messageDate, yesterday)) {
    return '어제';
  }

  if (messageDate.getFullYear() === now.getFullYear()) {
    return `${messageDate.getMonth() + 1}월 ${messageDate.getDate()}일`;
  }

  return `${messageDate.getFullYear()}년 ${messageDate.getMonth() + 1}월 ${messageDate.getDate()}일`;
}

export function shouldShowMessageDateSeparator(messages: ChatMessage[], index: number) {
  const previousMessage = messages[index - 1];
  const currentMessage = messages[index];

  return Boolean(
    previousMessage &&
      currentMessage &&
      !isSameLocalDate(previousMessage.createdAt, currentMessage.createdAt)
  );
}

export function formatConversationTime(createdAt: string) {
  return formatRelativeTimeLabel(createdAt);
}

export function sortConversationsByUpdatedAt(conversations: Conversation[]) {
  return [...conversations].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
  );
}

export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]) {
  const merged = new Map<string, ChatMessage>();

  for (const message of existing) {
    merged.set(message.id, message);
  }

  for (const message of incoming) {
    merged.set(message.id, message);
  }

  return [...merged.values()].sort((left, right) => {
    const createdDiff = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdDiff !== 0) return createdDiff;
    return left.id.localeCompare(right.id);
  });
}
