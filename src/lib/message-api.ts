import {
  ChatAttachment,
  Conversation,
  MessageRecipient,
  appendTextMessage,
  loadConversations,
  markConversationRead,
  saveConversations,
  sharePostToRecipients,
  upsertConversation,
} from '@/lib/message-store';
import { PostRecord } from '@/lib/feed-api';

const MESSAGE_SEND_DELAY_MS = 450;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchConversations(userId?: string | null) {
  return loadConversations(userId);
}

export async function startConversation(
  userId: string | null | undefined,
  conversations: Conversation[],
  recipient: MessageRecipient
) {
  const next = upsertConversation(conversations, recipient);
  saveConversations(userId, next);
  return next;
}

export async function readConversation(
  userId: string | null | undefined,
  conversations: Conversation[],
  conversationId: string
) {
  const next = markConversationRead(conversations, conversationId);
  saveConversations(userId, next);
  return next;
}

export async function sendMessage(
  userId: string | null | undefined,
  conversations: Conversation[],
  conversationId: string,
  text: string,
  attachments: ChatAttachment[] = []
) {
  await wait(MESSAGE_SEND_DELAY_MS);

  if (text.trim().toLowerCase() === '/fail') {
    throw new Error('메시지 전송에 실패했습니다.');
  }

  const next = appendTextMessage(conversations, conversationId, text, attachments);
  saveConversations(userId, next);
  return next;
}

export async function retryMessage(
  userId: string | null | undefined,
  conversations: Conversation[],
  conversationId: string,
  messageId: string
) {
  const failedMessage = conversations
    .find((conversation) => conversation.id === conversationId)
    ?.messages.find((message) => message.id === messageId);

  if (!failedMessage) {
    throw new Error('다시 보낼 메시지를 찾을 수 없습니다.');
  }

  const cleaned = conversations.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    return {
      ...conversation,
      messages: conversation.messages.filter((message) => message.id !== messageId),
    };
  });

  return sendMessage(userId, cleaned, conversationId, failedMessage.text);
}

export async function sharePostMessage(
  userId: string | null | undefined,
  post: PostRecord,
  recipients: MessageRecipient[],
  note: string
) {
  sharePostToRecipients(userId, post, recipients, note);
  return fetchConversations(userId);
}
