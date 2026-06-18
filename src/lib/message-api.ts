import { clearStoredAuth, ensureAccessToken, refreshAccessToken } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/api-base';
import { PostRecord } from '@/lib/feed-api';
import {
  ChatAttachment,
  ChatMessage,
  Conversation,
  MessageCursorPage,
  MessageRecipient,
  SharedPostPreview,
  sortConversationsByUpdatedAt,
} from '@/lib/message-store';

const API_BASE = getApiBaseUrl();
const MESSAGE_BASE = `${API_BASE}/api/v1/messages`;

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  message?: string;
};

type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string>;
};

function createMessageAuthError() {
  return new Error('Authentication is required or the token has expired.');
}

type ConversationPayload = {
  id: string;
  recipient: MessageRecipient;
  messages: MessagePayload[];
  unreadCount: number;
  updatedAt: string;
};

type MessagePayload = {
  id: string;
  senderId: 'me' | string;
  text: string;
  createdAt: string;
  read: boolean;
  deliveryStatus: 'sent';
  attachments: AttachmentPayload[];
  sharedPost: SharedPostPayload | null;
};

type AttachmentPayload = {
  id: string;
  type: 'image' | 'video';
  name: string;
  url: string;
};

type SharedPostPayload = {
  postId: string;
  author: string;
  authorHandle: string;
  content: string;
  createdAt: string;
};

type MessageCursorPayload = {
  items: MessagePayload[];
  nextCursor: string | null;
  hasNext: boolean;
};

export type MessageRealtimeEvent = {
  type: 'message-created' | 'message-deleted';
  conversationId: string;
  message: ChatMessage | null;
  messageId: string;
};

function normalizeUrl(url: string) {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${API_BASE}${url.startsWith('/') ? url : `/${url}`}`;
}

function toAttachment(payload: AttachmentPayload): ChatAttachment {
  return {
    id: payload.id,
    type: payload.type,
    name: payload.name,
    url: normalizeUrl(payload.url),
  };
}

function toSharedPost(payload: SharedPostPayload | null): SharedPostPreview | null {
  if (!payload) return null;

  return {
    postId: payload.postId,
    author: payload.author,
    authorHandle: payload.authorHandle,
    content: payload.content,
    createdAt: payload.createdAt,
  };
}

function toMessage(payload: MessagePayload): ChatMessage {
  return {
    id: payload.id,
    senderId: payload.senderId,
    text: payload.text,
    createdAt: payload.createdAt,
    read: payload.read,
    deliveryStatus: payload.deliveryStatus,
    attachments: (payload.attachments ?? []).map(toAttachment),
    sharedPost: toSharedPost(payload.sharedPost),
  };
}

function toConversation(payload: ConversationPayload): Conversation {
  return {
    id: payload.id,
    recipient: payload.recipient,
    messages: (payload.messages ?? []).map(toMessage),
    unreadCount: payload.unreadCount ?? 0,
    updatedAt: payload.updatedAt,
  };
}

async function messageRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const send = async (accessToken: string) => {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);

    if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${MESSAGE_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { message?: string } | null;
    return { response, payload };
  };

  let accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw createMessageAuthError();
  }

  let result = await send(accessToken);

  if (result.response.status === 401) {
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw createMessageAuthError();
    }

    result = await send(accessToken);
  }

  if (!result.response.ok) {
    if (result.response.status === 401) {
      clearStoredAuth();
      throw createMessageAuthError();
    }

    throw new Error(result.payload?.message ?? 'Message request failed.');
  }

  return (result.payload as ApiEnvelope<T>).data;
}

export async function fetchMessageAttachmentBlob(url: string) {
  const send = async (accessToken: string) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      credentials: 'include',
    });

  let accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw createMessageAuthError();
  }

  let response = await send(accessToken);

  if (response.status === 401) {
    accessToken = await refreshAccessToken();
    if (!accessToken) {
      throw createMessageAuthError();
    }
    response = await send(accessToken);
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuth();
      throw createMessageAuthError();
    }
    throw new Error('Message attachment request failed.');
  }

  return response.blob();
}

export function isMessageAuthError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('로그인이 필요') ||
    message.includes('인증') ||
    message.includes('토큰') ||
    message.includes('authentication') ||
    message.includes('token')
  );
}

export async function fetchConversationList() {
  const data = await messageRequest<ConversationPayload[]>('/conversations');
  return sortConversationsByUpdatedAt(data.map(toConversation));
}

export async function openMessageEventSource() {
  const accessToken = await ensureAccessToken();
  if (!accessToken) {
    throw createMessageAuthError();
  }

  const url = new URL(`${MESSAGE_BASE}/stream`);
  url.searchParams.set('accessToken', accessToken);
  return new EventSource(url.toString(), { withCredentials: true });
}

export function parseMessageRealtimeEvent(rawData: string): MessageRealtimeEvent {
  const payload = JSON.parse(rawData) as {
    type: MessageRealtimeEvent['type'];
    conversationId: string;
    message: MessagePayload | null;
    messageId: string;
  };

  return {
    type: payload.type,
    conversationId: payload.conversationId,
    message: payload.message ? toMessage(payload.message) : null,
    messageId: payload.messageId,
  };
}

export async function searchMessageRecipients(keyword?: string, size = 10) {
  const params = new URLSearchParams();

  if (keyword?.trim()) {
    params.set('keyword', keyword.trim());
  }

  params.set('size', String(size));

  const data = await messageRequest<MessageRecipient[]>(`/recipients?${params.toString()}`);
  return data;
}

export async function createConversation(payload: { recipientId?: string; recipientHandle?: string }) {
  const data = await messageRequest<ConversationPayload>('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      recipientId: payload.recipientId ?? null,
      recipientHandle: payload.recipientHandle ?? null,
    }),
  });

  return toConversation(data);
}

export async function fetchConversationMessages(conversationId: string, cursor?: string | null, size = 30) {
  const params = new URLSearchParams({
    size: String(size),
  });

  if (cursor) {
    params.set('cursor', cursor);
  }

  const data = await messageRequest<MessageCursorPayload>(
    `/conversations/${conversationId}/messages?${params.toString()}`
  );

  const page: MessageCursorPage = {
    items: data.items.map(toMessage),
    nextCursor: data.nextCursor,
    hasNext: data.hasNext,
  };

  return page;
}

export async function markConversationRead(conversationId: string) {
  await messageRequest<null>(`/conversations/${conversationId}/read`, {
    method: 'PATCH',
  });
}

export async function sendConversationMessage(payload: {
  conversationId: string;
  content?: string;
  sharedPostId?: string | null;
  attachments?: File[];
}) {
  const { conversationId, attachments = [], content = '', sharedPostId = null } = payload;

  if (attachments.length > 0) {
    const formData = new FormData();

    if (content.trim()) {
      formData.append('content', content.trim());
    }

    for (const attachment of attachments) {
      formData.append('attachments', attachment);
    }

    const data = await messageRequest<MessagePayload>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: formData,
    });

    return toMessage(data);
  }

  const data = await messageRequest<MessagePayload>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content: content.trim(),
      sharedPostId,
    }),
  });

  return toMessage(data);
}

export async function sharePostMessage(payload: {
  post: PostRecord;
  recipientIds?: string[];
  recipientHandles?: string[];
  content?: string;
}) {
  const data = await messageRequest<ConversationPayload[]>('/share-post', {
    method: 'POST',
    body: JSON.stringify({
      postId: payload.post.postId,
      recipientIds: payload.recipientIds?.length ? payload.recipientIds : undefined,
      recipientHandles: payload.recipientHandles?.length ? payload.recipientHandles : undefined,
      content: payload.content?.trim() || '',
    }),
  });

  return sortConversationsByUpdatedAt(data.map(toConversation));
}

export async function deleteConversationMessage(payload: {
  conversationId: string;
  messageId: string;
}) {
  await messageRequest<null>(`/conversations/${payload.conversationId}/messages/${payload.messageId}`, {
    method: 'DELETE',
  });
}

export async function leaveConversation(conversationId: string) {
  await messageRequest<null>(`/conversations/${conversationId}`, {
    method: 'DELETE',
  });
}
