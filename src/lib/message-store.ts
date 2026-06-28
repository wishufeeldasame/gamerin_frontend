'use client';

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

export function formatConversationTime(createdAt: string) {
  const diffSeconds = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000);

  if (diffSeconds < 60) return '방금';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}분 전`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;

  return new Date(createdAt).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
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
