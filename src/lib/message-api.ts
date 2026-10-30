import { assertCurrentAuthGeneration, getAuthGeneration } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/api-base';
import { isApiOriginUrl, toAbsoluteAssetUrl } from '@/lib/asset-url';
import {
  ApiError,
  AUTH_REQUIRED_MESSAGE,
  type ApiClientConfig,
  type ApiRequestOptions,
  apiRequest,
  apiRequestBlob,
  forceRefreshAccessToken,
} from '@/lib/api-client';
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

const MESSAGE_BASE = '/api/v1/messages';

const MESSAGE_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) =>
    new ApiError(
      message ?? (reason === 'unauthenticated' || reason === 'blocked' || status === 401
        ? AUTH_REQUIRED_MESSAGE
        : '메시지 요청을 처리하지 못했습니다.'),
      status,
      reason,
    ),
};

const MESSAGE_ATTACHMENT_CLIENT: ApiClientConfig = {
  toError: ({ reason, status, message }) =>
    new ApiError(
      message ?? (reason === 'unauthenticated' || reason === 'blocked' || status === 401
        ? AUTH_REQUIRED_MESSAGE
        : '메시지 첨부 파일을 불러오지 못했습니다.'),
      status,
      reason,
    ),
};

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
  clientMessageId?: string | null;
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

function toAttachment(payload: AttachmentPayload): ChatAttachment {
  return {
    id: payload.id,
    type: payload.type,
    name: payload.name,
    url: toAbsoluteAssetUrl(payload.url) ?? payload.url,
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
    clientMessageId: payload.clientMessageId ?? null,
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

function messageRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequest<T>(`${MESSAGE_BASE}${path}`, MESSAGE_CLIENT, options);
}

export async function fetchMessageAttachmentBlob(url: string) {
  const attachmentUrl = toAbsoluteAssetUrl(url);
  if (!attachmentUrl) {
    throw new ApiError('메시지 첨부 파일을 불러오지 못했습니다.', 0, 'unavailable');
  }

  if (isApiOriginUrl(attachmentUrl)) {
    return apiRequestBlob(attachmentUrl, MESSAGE_ATTACHMENT_CLIENT);
  }

  // API origin이 아닌 주소에는 토큰과 쿠키를 보내지 않고, 실패해도 세션을 갱신·종료하지 않는다.
  const generation = getAuthGeneration();
  const response = await fetch(attachmentUrl, { credentials: 'omit' }).catch(() => null);
  assertCurrentAuthGeneration(generation);
  if (!response?.ok) {
    throw new ApiError('메시지 첨부 파일을 불러오지 못했습니다.', 0, 'unavailable');
  }

  const blob = await response.blob();
  assertCurrentAuthGeneration(generation);
  return blob;
}

export async function fetchConversationList() {
  const data = await messageRequest<ConversationPayload[]>('/conversations');
  return sortConversationsByUpdatedAt(data.map(toConversation));
}

export async function openMessageEventSource(options: { forceRefresh?: boolean } = {}) {
  const generation = getAuthGeneration();

  if (options.forceRefresh) {
    await forceRefreshAccessToken(MESSAGE_CLIENT);
  }

  await messageRequest<{ expiresAt: string }>('/stream-token', {
    method: 'POST',
  });

  // 강제 refresh와 stream-token 발급 사이에 사용자가 바뀌었으면 이전 사용자의 연결을 시작하지 않는다.
  assertCurrentAuthGeneration(generation);
  return new EventSource(`${getApiBaseUrl()}${MESSAGE_BASE}/stream`, { withCredentials: true });
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
  // 재시도해도 같은 값을 보내면 서버가 처음 저장한 메시지를 돌려준다.
  clientMessageId?: string;
}) {
  const { conversationId, attachments = [], content = '', sharedPostId = null, clientMessageId } = payload;

  if (attachments.length > 0) {
    const formData = new FormData();

    if (content.trim()) {
      formData.append('content', content.trim());
    }

    if (clientMessageId) {
      formData.append('clientMessageId', clientMessageId);
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
      clientMessageId,
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
