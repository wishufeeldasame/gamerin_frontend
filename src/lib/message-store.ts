'use client';

import { formatRelativeTimeLabel } from '@/lib/time-format';

export type MessageRecipient = {
  id: string;
  name: string;
  handle: string;
  role: string;
  online: boolean;
  profileImageUrl?: string | null;
  membershipBadge?: boolean;
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

export type PendingChatAttachment = {
  id: string;
  type: 'image' | 'video';
  name: string;
  file: File;
  previewUrl: string;
};

// 서버 응답 전까지 보낸 사람 화면에만 보이는 임시 메시지. queued는 직렬 전송 대기, sending은 요청 중이다.
export type PendingChatMessage = {
  id: string;
  text: string;
  attachments: PendingChatAttachment[];
  status: 'queued' | 'sending' | 'failed';
  errorMessage: string | null;
  // 이 시각 이후에 생긴 내 메시지만 이 임시 메시지의 서버 사본으로 본다. null이면 기준을 몰라 숨기지 않는다.
  afterCreatedAt: string | null;
  // 제출 당시 인증 세대. 로그아웃·사용자 전환 뒤에는 다른 계정으로 보내지 않는다.
  authGeneration: number;
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

function toTime(createdAt: string | null) {
  return createdAt ? new Date(createdAt).getTime() : Number.NEGATIVE_INFINITY;
}

// 보낸 사람에게도 SSE·폴링으로 같은 메시지가 전송 응답보다 먼저 올 수 있다.
// 요청을 보낸(요청 중이거나 실패한) 임시 메시지와 본문·첨부(종류·파일명)가 같은 내 메시지가 기준 시각 이후에 있으면
// 서버 사본이 도착한 것으로 보고 임시 메시지를 숨긴다. 응답만 실패하고 서버에는 저장된 경우도 여기서 정리된다.
// 동일성을 확신할 수 없으면 숨기지 않는다(잠깐 중복이 보이는 쪽이 보내는 중인 메시지가 사라지는 쪽보다 낫다).
export function hideDeliveredPendingMessages(pending: PendingChatMessage[], messages: ChatMessage[]) {
  const claimedIds = new Set<string>();

  return pending.filter((item) => {
    if (item.status === 'queued' || !item.afterCreatedAt) return true;

    const after = toTime(item.afterCreatedAt);
    const delivered = messages.find(
      (message) =>
        !claimedIds.has(message.id) &&
        message.senderId === 'me' &&
        toTime(message.createdAt) > after &&
        (message.text ?? '') === item.text &&
        message.attachments.length === item.attachments.length &&
        message.attachments.every(
          (attachment, index) =>
            attachment.type === item.attachments[index]?.type && attachment.name === item.attachments[index]?.name
        )
    );
    if (!delivered) return true;

    claimedIds.add(delivered.id);
    return false;
  });
}

export function latestCreatedAt(...values: (string | null | undefined)[]) {
  return values.reduce<string | null>(
    (latest, value) => (value && toTime(value) > toTime(latest) ? value : latest),
    null
  );
}
