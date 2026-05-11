import { PostRecord } from '@/lib/feed-api';

export type MessageRecipient = {
  id: string;
  name: string;
  handle: string;
  role: string;
  online: boolean;
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
  deliveryStatus?: 'sending' | 'sent' | 'failed';
  attachments?: ChatAttachment[];
  sharedPost?: SharedPostPreview;
};

export type Conversation = {
  id: string;
  recipient: MessageRecipient;
  messages: ChatMessage[];
  unreadCount: number;
  updatedAt: string;
};

export const MESSAGE_RECIPIENTS: MessageRecipient[] = [
  { id: 'sarah', name: 'Sarah Chen', handle: '@sarahfps', role: 'Valorant Pro', online: true },
  { id: 'jin', name: 'Jin Park', handle: '@jinplays', role: 'FPS Coach', online: false },
  { id: 'luna', name: 'Luna Choi', handle: '@lunaraid', role: 'MMO Guild Lead', online: true },
  { id: 'theo', name: 'Theo Han', handle: '@theostream', role: 'Creator', online: false },
  { id: 'mike', name: 'Mike Rodriguez', handle: '@mikerg', role: 'Scrim Mate', online: false },
];

const STORAGE_PREFIX = 'gamerin_messages';

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStorageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}_${userId || 'guest'}`;
}

function createSeedConversations(): Conversation[] {
  const now = new Date();
  const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  return [
    {
      id: 'sarah',
      recipient: MESSAGE_RECIPIENTS[0],
      unreadCount: 1,
      updatedAt: minutesAgo(2),
      messages: [
        {
          id: createId(),
          senderId: 'sarah',
          text: '어제 랭크전 클립 봤어요. 다음에는 듀오로 같이 가요.',
          createdAt: minutesAgo(12),
          read: true,
          deliveryStatus: 'sent',
        },
        {
          id: createId(),
          senderId: 'me',
          text: '좋아요. 오늘 저녁에 접속하면 바로 초대할게요.',
          createdAt: minutesAgo(8),
          read: true,
          deliveryStatus: 'sent',
        },
        {
          id: createId(),
          senderId: 'sarah',
          text: '콜. 맵은 어센트부터 연습해봐요.',
          createdAt: minutesAgo(2),
          read: false,
          deliveryStatus: 'sent',
        },
      ],
    },
    {
      id: 'jin',
      recipient: MESSAGE_RECIPIENTS[1],
      unreadCount: 0,
      updatedAt: minutesAgo(70),
      messages: [
        {
          id: createId(),
          senderId: 'jin',
          text: '피드백 필요한 영상 있으면 공유해주세요.',
          createdAt: minutesAgo(70),
          read: true,
          deliveryStatus: 'sent',
        },
      ],
    },
  ];
}

function normalizeConversation(conversation: Conversation): Conversation {
  const recipient =
    MESSAGE_RECIPIENTS.find((item) => item.id === conversation.recipient.id) ?? conversation.recipient;

  return {
    ...conversation,
    recipient,
    messages: conversation.messages ?? [],
    unreadCount: conversation.unreadCount ?? 0,
    updatedAt: conversation.updatedAt ?? conversation.messages.at(-1)?.createdAt ?? new Date().toISOString(),
  };
}

export function loadConversations(userId?: string | null): Conversation[] {
  if (typeof window === 'undefined') {
    return createSeedConversations();
  }

  const raw = window.localStorage.getItem(getStorageKey(userId));
  if (!raw) {
    const seed = createSeedConversations();
    saveConversations(userId, seed);
    return seed;
  }

  try {
    const parsed = JSON.parse(raw) as Conversation[];
    return parsed.map(normalizeConversation).sort(sortByUpdatedAt);
  } catch {
    const seed = createSeedConversations();
    saveConversations(userId, seed);
    return seed;
  }
}

export function saveConversations(userId: string | null | undefined, conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(conversations.sort(sortByUpdatedAt)));
}

export function upsertConversation(
  conversations: Conversation[],
  recipient: MessageRecipient
): Conversation[] {
  if (conversations.some((conversation) => conversation.id === recipient.id)) {
    return conversations;
  }

  return [
    {
      id: recipient.id,
      recipient,
      messages: [],
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
    },
    ...conversations,
  ];
}

export function markConversationRead(conversations: Conversation[], conversationId: string) {
  return conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    return {
      ...conversation,
      unreadCount: 0,
      messages: conversation.messages.map((message) => ({ ...message, read: true })),
    };
  });
}

export function appendTextMessage(
  conversations: Conversation[],
  conversationId: string,
  text: string,
  attachments: ChatAttachment[] = []
): Conversation[] {
  const createdAt = new Date().toISOString();

  return conversations
    .map((conversation) => {
      if (conversation.id !== conversationId) return conversation;

      return {
        ...conversation,
        updatedAt: createdAt,
        messages: [
          ...conversation.messages,
          {
            id: createId(),
            senderId: 'me' as const,
            text,
            createdAt,
            read: true,
            deliveryStatus: 'sent' as const,
            attachments,
          },
        ],
      };
    })
    .sort(sortByUpdatedAt);
}

export function sharePostToRecipients(
  userId: string | null | undefined,
  post: PostRecord,
  recipients: MessageRecipient[],
  note: string
) {
  const createdAt = new Date().toISOString();
  const current = loadConversations(userId);

  const next = recipients.reduce<Conversation[]>((acc, recipient) => {
    const withConversation = upsertConversation(acc, recipient);

    return withConversation
      .map((conversation) => {
        if (conversation.id !== recipient.id) return conversation;

        return {
          ...conversation,
          updatedAt: createdAt,
          messages: [
            ...conversation.messages,
            {
              id: createId(),
              senderId: 'me' as const,
              text: note,
              createdAt,
              read: true,
              deliveryStatus: 'sent' as const,
              sharedPost: {
                postId: post.postId,
                author: post.author,
                authorHandle: post.authorHandle,
                content: post.content || '미디어 게시물',
                createdAt: post.createdAt,
              },
            },
          ],
        };
      })
      .sort(sortByUpdatedAt);
  }, current);

  saveConversations(userId, next);
}

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

function sortByUpdatedAt(left: Conversation, right: Conversation) {
  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}
