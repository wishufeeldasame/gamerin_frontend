'use client';

import {
  ArrowLeft,
  CheckCheck,
  CircleAlert,
  Ellipsis,
  ImagePlus,
  Inbox,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  createConversation,
  deleteConversationMessage,
  fetchConversationList,
  fetchConversationMessages,
  isMessageAuthError,
  leaveConversation,
  markConversationRead,
  openMessageEventSource,
  parseMessageRealtimeEvent,
  searchMessageRecipients,
  sendConversationMessage,
} from '@/lib/message-api';
import {
  ChatAttachment,
  ChatMessage,
  Conversation,
  MessageRecipient,
  formatChatTime,
  formatConversationTime,
  getInitials,
  mergeMessages,
} from '@/lib/message-store';

const MESSAGE_PAGE_SIZE = 30;

type DraftAttachment = {
  id: string;
  type: 'image' | 'video';
  name: string;
  file: File;
  previewUrl: string;
};

type ExpandedImage = {
  url: string;
  name: string;
};

function createAttachmentId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getLastPreview(conversation: Conversation) {
  const lastMessage = conversation.messages.at(-1);
  if (!lastMessage) return '아직 대화가 없습니다.';

  if (lastMessage.sharedPost) {
    return lastMessage.text ? `${lastMessage.text} · 게시글 공유` : '게시글을 공유했습니다.';
  }

  if (lastMessage.attachments.length > 0) {
    const label = lastMessage.attachments[0].type === 'video' ? '동영상' : '사진';
    return lastMessage.text ? `${lastMessage.text} · ${label}` : `${label}을 보냈습니다.`;
  }

  return lastMessage.text || '메시지를 보냈습니다.';
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  const normalized = query.trim();
  if (!normalized) return <>{text}</>;

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === normalized.toLowerCase() ? (
          <mark key={`${part}-${index}`} className="rounded bg-[#f5b93d]/40 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function ConversationCard({
  conversation,
  active,
  query,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  query: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[28px] p-4 text-left transition-all active:scale-[0.99] ${
        active
          ? 'bg-black text-white shadow-xl'
          : 'border border-transparent text-black hover:border-zinc-100 hover:bg-zinc-50'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
              active ? 'bg-zinc-800 text-white' : 'bg-black text-white'
            }`}
          >
            {getInitials(conversation.recipient.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black">
              <HighlightedText text={conversation.recipient.name} query={query} />
            </p>
            <p
              className={`truncate text-[11px] font-bold uppercase tracking-widest ${
                active ? 'text-white/55' : 'text-zinc-400'
              }`}
            >
              <HighlightedText text={conversation.recipient.role} query={query} />
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span className={`text-[10px] font-black ${active ? 'text-white/45' : 'text-zinc-300'}`}>
            {formatConversationTime(conversation.updatedAt)}
          </span>
          {conversation.unreadCount > 0 ? (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#f5b93d] px-1.5 text-[10px] font-black text-black">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
      <p className={`truncate pl-1 text-sm font-medium ${active ? 'text-white/70' : 'text-zinc-500'}`}>
        <HighlightedText text={getLastPreview(conversation)} query={query} />
      </p>
    </button>
  );
}

function NewChatPicker({
  onStart,
  onClose,
}: {
  onStart: (recipient: MessageRecipient) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [recipients, setRecipients] = useState<MessageRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        const next = await searchMessageRecipients(query, 12);
        if (!cancelled) {
          setRecipients(next);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : '사용자 검색에 실패했습니다.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <p className="text-xs font-black uppercase tracking-widest text-zinc-400">새 대화</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 transition hover:bg-white hover:text-black"
          aria-label="새 대화 닫기"
        >
          <X size={16} />
        </button>
      </div>

      <label className="relative mb-3 block">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 핸들 검색"
          className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-4 text-sm font-bold text-black outline-none transition focus:border-black"
        />
      </label>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-sm font-bold text-zinc-400">
          <Loader2 size={16} className="mr-2 animate-spin" />
          검색 중...
        </div>
      ) : errorMessage ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {errorMessage}
        </div>
      ) : recipients.length > 0 ? (
        <div className="space-y-1">
          {recipients.map((recipient) => (
            <button
              key={recipient.id}
              type="button"
              onClick={() => onStart(recipient)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left transition hover:bg-zinc-100"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-xs font-black text-white">
                {getInitials(recipient.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-black">{recipient.name}</span>
                <span className="block truncate text-xs font-bold text-zinc-400">
                  {recipient.handle} · {recipient.role}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="px-2 py-3 text-sm font-bold text-zinc-400">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}

function SharedPostCard({
  message,
  onOpenPost,
}: {
  message: ChatMessage;
  onOpenPost: (postId: string) => void;
}) {
  if (!message.sharedPost) return null;

  return (
    <button
      type="button"
      onClick={() => onOpenPost(message.sharedPost!.postId)}
      className="mt-3 block w-full overflow-hidden rounded-2xl border border-white/20 bg-white text-left text-black shadow-sm transition hover:border-black"
    >
      <div className="border-b border-zinc-100 px-4 py-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">공유 게시글</p>
        <p className="mt-1 text-sm font-black text-black">{message.sharedPost.author}</p>
        <p className="text-xs font-bold text-zinc-400">@{message.sharedPost.authorHandle}</p>
      </div>
      <p className="line-clamp-3 px-4 py-3 text-sm font-medium leading-6 text-zinc-700">
        {message.sharedPost.content}
      </p>
    </button>
  );
}

function ImageLightbox({
  image,
  onClose,
}: {
  image: ExpandedImage | null;
  onClose: () => void;
}) {
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="이미지 닫기"
      >
        <X size={20} />
      </button>
      <div className="max-h-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.name}
          className="max-h-[88vh] w-auto max-w-full rounded-[28px] object-contain shadow-2xl"
        />
        <p className="mt-3 text-center text-sm font-bold text-white/80">{image.name}</p>
      </div>
    </div>
  );
}

function AttachmentGrid({
  attachments,
  onOpenImage,
}: {
  attachments: ChatAttachment[];
  onOpenImage: (attachment: ChatAttachment) => void;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="overflow-hidden rounded-2xl bg-black/5">
          {attachment.type === 'video' ? (
            <video controls src={attachment.url} className="max-h-80 w-full bg-black object-cover" />
          ) : (
            <button
              type="button"
              onClick={() => onOpenImage(attachment)}
              className="block w-full cursor-zoom-in"
              aria-label={`${attachment.name} 확대 보기`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={attachment.url} alt={attachment.name} className="max-h-80 w-full object-cover" />
            </button>
          )}
          <p className="truncate bg-white/80 px-3 py-2 text-xs font-bold text-zinc-500">{attachment.name}</p>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({
  chatMessage,
  mine,
  recipientName,
  isActionOpen,
  actionLoading,
  onToggleAction,
  onDelete,
  onOpenPost,
  onOpenImage,
}: {
  chatMessage: ChatMessage;
  mine: boolean;
  recipientName: string;
  isActionOpen: boolean;
  actionLoading: boolean;
  onToggleAction: () => void;
  onDelete: () => void;
  onOpenPost: (postId: string) => void;
  onOpenImage: (attachment: ChatAttachment) => void;
}) {
  return (
    <div className={`flex items-end gap-3 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-[10px] font-black text-black">
          {getInitials(recipientName)}
        </div>
      ) : null}

      <div className={`max-w-[76%] ${mine ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative flex items-end gap-3 ${mine ? 'justify-end' : 'justify-start'}`}
          data-message-action-root="true"
        >
          {mine && isActionOpen ? (
            <div className="absolute bottom-1 right-full mr-3 flex h-10 items-center overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
              <button
                type="button"
                onClick={onDelete}
                disabled={actionLoading}
                className="flex h-full items-center justify-center px-4 text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="메시지 삭제"
              >
                <Trash2 size={16} className="-translate-x-[1px] shrink-0" />
              </button>
            </div>
          ) : null}

          <div
            className={`rounded-[28px] px-6 py-4 text-[15px] font-medium leading-relaxed shadow-sm ${
              mine
                ? 'rounded-br-none bg-black text-white'
                : 'rounded-bl-none border border-zinc-100 bg-white text-zinc-800'
            }`}
          >
            {chatMessage.text ? <p>{chatMessage.text}</p> : null}
            <AttachmentGrid attachments={chatMessage.attachments} onOpenImage={onOpenImage} />
            <SharedPostCard message={chatMessage} onOpenPost={onOpenPost} />
          </div>

          {mine ? (
            <button
              type="button"
              onClick={onToggleAction}
              className="mb-1 rounded-full p-2 text-zinc-300 transition hover:bg-white hover:text-zinc-500"
              aria-label="메시지 액션"
            >
              <Ellipsis size={16} />
            </button>
          ) : null}
        </div>

        <div
          className={`mt-2 flex items-center gap-1 text-[10px] font-black uppercase text-zinc-300 ${
            mine ? 'justify-end' : 'justify-start'
          }`}
        >
          {mine ? <CheckCheck size={13} /> : null}
          <span>
            {mine
              ? `${chatMessage.read ? '읽음' : '보냄'} ${formatChatTime(chatMessage.createdAt)}`
              : formatChatTime(chatMessage.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, logout, isAuthReady } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const activeConversationIdRef = useRef('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [nextCursorByConversation, setNextCursorByConversation] = useState<Record<string, string | null>>({});
  const [hasNextByConversation, setHasNextByConversation] = useState<Record<string, boolean>>({});
  const [activeConversationId, setActiveConversationId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null);
  const [pageError, setPageError] = useState('');
  const [composerError, setComposerError] = useState('');
  const [isAuthError, setIsAuthError] = useState(false);
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const requestedConversationId = searchParams.get('conversationId') ?? '';
  const requestedRecipientHandle = searchParams.get('recipient') ?? '';
  const requestedRecipientRef = useRef('');

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeMessages = activeConversationId ? messagesByConversation[activeConversationId] ?? [] : [];
  const hasNextMessages = activeConversationId ? (hasNextByConversation[activeConversationId] ?? false) : false;

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  const revokeAttachmentUrls = useCallback((targets: DraftAttachment[]) => {
    for (const target of targets) {
      URL.revokeObjectURL(target.previewUrl);
    }
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((current) => {
      revokeAttachmentUrls(current);
      return [];
    });

    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  }, [revokeAttachmentUrls]);

  useEffect(() => () => revokeAttachmentUrls(attachments), [attachments, revokeAttachmentUrls]);

  useEffect(() => {
    if (!attachmentMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (attachmentMenuRef.current?.contains(target)) {
        return;
      }

      setAttachmentMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [attachmentMenuOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      if (headerMenuRef.current?.contains(target)) return;
      if (target.closest('[data-message-action-root="true"]')) return;

      setHeaderMenuOpen(false);
      setMessageActionId(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const replaceConversation = useCallback((target: Conversation) => {
    setConversations((current) => {
      const next = current.some((conversation) => conversation.id === target.id)
        ? current.map((conversation) => (conversation.id === target.id ? target : conversation))
        : [target, ...current];

      return next.sort(
        (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
    });
  }, []);

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoadingConversations(true);
      }

      const data = await fetchConversationList();
      setConversations(data);
      setPageError('');
      setIsAuthError(false);
      setActiveConversationId((current) => {
        if (current && data.some((conversation) => conversation.id === current)) {
          return current;
        }

        return data[0]?.id ?? '';
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '대화 목록을 불러오지 못했습니다.');
      setIsAuthError(isMessageAuthError(error));
    } finally {
      if (!options?.silent) {
        setLoadingConversations(false);
      }
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, options?: { cursor?: string | null; silent?: boolean }) => {
    if (!conversationId) return;

    try {
      if (options?.cursor) {
        setLoadingOlderMessages(true);
      } else if (!options?.silent) {
        setLoadingMessages(true);
      }

      const page = await fetchConversationMessages(conversationId, options?.cursor, MESSAGE_PAGE_SIZE);

      setMessagesByConversation((current) => ({
        ...current,
        [conversationId]: mergeMessages(current[conversationId] ?? [], page.items),
      }));
      setNextCursorByConversation((current) => ({
        ...current,
        [conversationId]: page.nextCursor,
      }));
      setHasNextByConversation((current) => ({
        ...current,
        [conversationId]: page.hasNext,
      }));
      setPageError('');
      setIsAuthError(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.');
      setIsAuthError(isMessageAuthError(error));
    } finally {
      if (options?.cursor) {
        setLoadingOlderMessages(false);
      } else if (!options?.silent) {
        setLoadingMessages(false);
      }
    }
  }, []);

  const updateConversationPreviewWithMessage = useCallback((conversationId: string, nextMessage: ChatMessage) => {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                updatedAt: nextMessage.createdAt,
                unreadCount: 0,
                messages: [...conversation.messages.filter((item) => item.id !== nextMessage.id), nextMessage],
              }
            : conversation
        )
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    );
  }, []);

  const removeMessageFromConversation = useCallback((conversationId: string, messageId: string) => {
    setMessagesByConversation((current) => ({
      ...current,
      [conversationId]: (current[conversationId] ?? []).filter((item) => item.id !== messageId),
    }));

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.filter((item) => item.id !== messageId),
            }
          : conversation
      )
    );
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    void loadConversations();
  }, [isAuthReady, loadConversations, user]);

  useEffect(() => {
    if (!activeConversationId) return;
    void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return;

    const timer = window.setInterval(() => {
      void loadMessages(activeConversationId, { silent: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeConversationId, loadMessages]);

  useEffect(() => {
    if (!activeConversation || activeConversation.unreadCount === 0) return;

    const markRead = async () => {
      try {
        await markConversationRead(activeConversation.id);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeConversation.id ? { ...conversation, unreadCount: 0 } : conversation
          )
        );
      } catch (error) {
        if (isMessageAuthError(error)) {
          setIsAuthError(true);
        }
      }
    };

    void markRead();
  }, [activeConversation]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    let eventSource: EventSource | null = null;
    let cancelled = false;

    const connect = async () => {
      try {
        eventSource = await openMessageEventSource();

        eventSource.addEventListener('message-created', (event) => {
          const realtimeEvent = parseMessageRealtimeEvent((event as MessageEvent).data);
          const realtimeMessage = realtimeEvent.message;
          if (realtimeMessage && activeConversationIdRef.current === realtimeEvent.conversationId) {
            setMessagesByConversation((current) => ({
              ...current,
              [realtimeEvent.conversationId]: mergeMessages(
                current[realtimeEvent.conversationId] ?? [],
                [realtimeMessage]
              ),
            }));
          }
          void loadConversations({ silent: true });
        });

        eventSource.addEventListener('message-deleted', (event) => {
          const realtimeEvent = parseMessageRealtimeEvent((event as MessageEvent).data);
          removeMessageFromConversation(realtimeEvent.conversationId, realtimeEvent.messageId);
          void loadConversations({ silent: true });
        });

        eventSource.onerror = () => {
          if (!cancelled) {
            setPageError('실시간 메시지 연결이 일시적으로 끊겼습니다. 잠시 후 자동으로 다시 연결됩니다.');
          }
        };
      } catch (error) {
        if (!cancelled) {
          setPageError(error instanceof Error ? error.message : '실시간 메시지 연결에 실패했습니다.');
          setIsAuthError(isMessageAuthError(error));
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      eventSource?.close();
    };
  }, [
    isAuthReady,
    loadConversations,
    removeMessageFromConversation,
    user,
  ]);

  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;

    return conversations.filter((conversation) =>
      [
        conversation.recipient.name,
        conversation.recipient.handle,
        conversation.recipient.role,
        getLastPreview(conversation),
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [conversations, query]);

  const handleSelectConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    setMobileView('chat');
    setComposerError('');
    setHeaderMenuOpen(false);
    setMessageActionId(null);
    clearAttachments();
    setAttachmentMenuOpen(false);
  };

  const handleStartConversation = async (recipient: MessageRecipient) => {
    try {
      const conversation = await createConversation({ recipientId: recipient.id });
      replaceConversation(conversation);
      setMessagesByConversation((current) => ({
        ...current,
        [conversation.id]: conversation.messages,
      }));
      setNextCursorByConversation((current) => ({
        ...current,
        [conversation.id]: null,
      }));
      setHasNextByConversation((current) => ({
        ...current,
        [conversation.id]: false,
      }));
      setActiveConversationId(conversation.id);
      router.replace(`/messages?conversationId=${encodeURIComponent(conversation.id)}`);
      setShowNewChat(false);
      setMobileView('chat');
      setPageError('');
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '대화를 시작하지 못했습니다.');
      setIsAuthError(isMessageAuthError(error));
    }
  };

  useEffect(() => {
    if (!requestedConversationId) return;
    if (!conversations.some((conversation) => conversation.id === requestedConversationId)) return;

    setActiveConversationId(requestedConversationId);
    setMobileView('chat');
  }, [conversations, requestedConversationId]);

  useEffect(() => {
    if (!isAuthReady || !user || loadingConversations || !requestedRecipientHandle) return;
    if (requestedRecipientRef.current === requestedRecipientHandle) return;

    requestedRecipientRef.current = requestedRecipientHandle;

    const existingConversation = conversations.find(
      (conversation) => conversation.recipient.handle === requestedRecipientHandle
    );

    if (existingConversation) {
      setActiveConversationId(existingConversation.id);
      setMobileView('chat');
      router.replace(`/messages?conversationId=${encodeURIComponent(existingConversation.id)}`);
      return;
    }

    const startConversationFromHandle = async () => {
      try {
        const conversation = await createConversation({ recipientHandle: requestedRecipientHandle });
        replaceConversation(conversation);
        setMessagesByConversation((current) => ({
          ...current,
          [conversation.id]: conversation.messages,
        }));
        setNextCursorByConversation((current) => ({
          ...current,
          [conversation.id]: null,
        }));
        setHasNextByConversation((current) => ({
          ...current,
          [conversation.id]: false,
        }));
        setActiveConversationId(conversation.id);
        setMobileView('chat');
        setPageError('');
        router.replace(`/messages?conversationId=${encodeURIComponent(conversation.id)}`);
      } catch (error) {
        requestedRecipientRef.current = '';
        setPageError(error instanceof Error ? error.message : '대화를 시작하지 못했습니다.');
        setIsAuthError(isMessageAuthError(error));
      }
    };

    void startConversationFromHandle();
  }, [
    conversations,
    isAuthReady,
    loadingConversations,
    replaceConversation,
    requestedRecipientHandle,
    router,
    user,
  ]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeConversation || sending) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0) return;

    try {
      setSending(true);
      setComposerError('');

      const sentMessage = await sendConversationMessage({
        conversationId: activeConversation.id,
        content: trimmedMessage,
        attachments: attachments.map((attachment) => attachment.file),
      });

      setMessagesByConversation((current) => ({
        ...current,
        [activeConversation.id]: mergeMessages(current[activeConversation.id] ?? [], [sentMessage]),
      }));
      updateConversationPreviewWithMessage(activeConversation.id, sentMessage);
      setMessage('');
      clearAttachments();
      setAttachmentMenuOpen(false);
      void loadConversations({ silent: true });
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : '메시지 전송에 실패했습니다.');
      setIsAuthError(isMessageAuthError(error));
    } finally {
      setSending(false);
    }
  };

  const handleLoadOlderMessages = async () => {
    if (!activeConversationId || !hasNextMessages || loadingOlderMessages) return;

    await loadMessages(activeConversationId, {
      cursor: nextCursorByConversation[activeConversationId] ?? null,
    });
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeConversation || messageActionLoading) return;

    try {
      setMessageActionLoading(true);
      setComposerError('');

      await deleteConversationMessage({
        conversationId: activeConversation.id,
        messageId,
      });

      removeMessageFromConversation(activeConversation.id, messageId);
      setMessageActionId(null);
      setMessageActionLoading(false);

      void loadConversations({ silent: true });
      void loadMessages(activeConversation.id, { silent: true });
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : '메시지 삭제에 실패했습니다.');
      setIsAuthError(isMessageAuthError(error));
      setMessageActionLoading(false);
    }
  };

  const handleLeaveActiveConversation = async () => {
    if (!activeConversation || messageActionLoading) return;

    try {
      setMessageActionLoading(true);
      setPageError('');

      const removedConversationId = activeConversation.id;
      await leaveConversation(removedConversationId);

      const remainingConversations = conversations.filter((conversation) => conversation.id !== removedConversationId);
      setConversations(remainingConversations);
      setMessagesByConversation((current) => {
        const next = { ...current };
        delete next[removedConversationId];
        return next;
      });
      setNextCursorByConversation((current) => {
        const next = { ...current };
        delete next[removedConversationId];
        return next;
      });
      setHasNextByConversation((current) => {
        const next = { ...current };
        delete next[removedConversationId];
        return next;
      });
      setActiveConversationId(remainingConversations[0]?.id ?? '');
      setMobileView('list');
      setHeaderMenuOpen(false);
      setMessageActionId(null);
      setMessageActionLoading(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '대화방 나가기에 실패했습니다.');
      setIsAuthError(isMessageAuthError(error));
      setMessageActionLoading(false);
    }
  };

  const pushDraftAttachments = (files: File[], type: 'image' | 'video') => {
    setComposerError('');

    if (type === 'image') {
      if (attachments.some((attachment) => attachment.type === 'video')) {
        setComposerError('이미지와 동영상은 같은 메시지에 함께 보낼 수 없습니다.');
        return;
      }

      if (files.length > 4) {
        setComposerError('이미지는 최대 4개까지 보낼 수 있습니다.');
        return;
      }

      if (files.some((file) => file.size > 20 * 1024 * 1024)) {
        setComposerError('이미지 파일은 최대 20MB까지 업로드할 수 있습니다.');
        return;
      }

      clearAttachments();
      setAttachments(
        files.slice(0, 4).map((file) => ({
          id: createAttachmentId(),
          type: 'image',
          name: file.name,
          file,
          previewUrl: URL.createObjectURL(file),
        }))
      );
      return;
    }

    const video = files[0];
    if (!video) return;

    if (attachments.some((attachment) => attachment.type === 'image')) {
      setComposerError('이미지와 동영상은 같은 메시지에 함께 보낼 수 없습니다.');
      return;
    }

    if (video.size > 100 * 1024 * 1024) {
      setComposerError('동영상 파일은 최대 100MB까지 업로드할 수 있습니다.');
      return;
    }

    clearAttachments();
    setAttachments([
      {
        id: createAttachmentId(),
        type: 'video',
        name: video.name,
        file: video,
        previewUrl: URL.createObjectURL(video),
      },
    ]);
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    pushDraftAttachments(files, 'image');
    setAttachmentMenuOpen(false);
  };

  const handleVideoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    pushDraftAttachments(files, 'video');
    setAttachmentMenuOpen(false);
  };

  const handleOpenPost = (postId: string) => {
    router.push(`/posts/${encodeURIComponent(postId)}`);
  };

  const handleOpenImage = useCallback((attachment: { url: string; name: string }) => {
    setExpandedImage({
      url: attachment.url,
      name: attachment.name,
    });
  }, []);

  useEffect(() => {
    if (!expandedImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpandedImage(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedImage]);

  if (!isAuthReady) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
          <Loader2 size={18} className="animate-spin" />
          메시지 화면을 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
      <section
        className={`w-full flex-col border-r border-zinc-100 bg-white md:flex md:w-[380px] ${
          mobileView === 'chat' ? 'hidden' : 'flex'
        }`}
      >
        <div className="p-6 pb-4">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-black">메시지</h1>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-400">
                {conversations.length} conversations
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewChat((current) => !current)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-white shadow-lg transition hover:scale-105"
              aria-label="새 대화 시작"
            >
              <Plus size={20} />
            </button>
          </div>

          <label className="group relative block">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-black"
              size={18}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="대화 또는 사용자 검색"
              className="h-12 w-full rounded-2xl bg-zinc-50 pl-12 pr-4 text-sm font-bold text-black outline-none transition focus:ring-2 focus:ring-black"
            />
          </label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {showNewChat ? (
            <NewChatPicker onStart={handleStartConversation} onClose={() => setShowNewChat(false)} />
          ) : null}

          {pageError ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {pageError}
            </div>
          ) : null}

          {loadingConversations ? (
            <div className="flex items-center justify-center py-10 text-sm font-bold text-zinc-400">
              <Loader2 size={16} className="mr-2 animate-spin" />
              대화 목록을 불러오는 중...
            </div>
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                active={conversation.id === activeConversationId}
                query={query}
                onSelect={() => handleSelectConversation(conversation.id)}
              />
            ))
          ) : (
            <div className="rounded-[28px] border border-dashed border-zinc-200 p-6 text-center">
              <Inbox className="mx-auto mb-3 text-zinc-300" size={28} />
              <p className="text-sm font-black text-zinc-500">시작된 대화가 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <section
        className={`flex-1 flex-col bg-[radial-gradient(circle_at_top,_rgba(245,185,61,0.12),_transparent_26%),linear-gradient(180deg,_rgba(250,250,250,0.92),_rgba(244,244,245,0.55))] md:flex ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversation ? (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/88 px-8 py-5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="rounded-2xl p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-black md:hidden"
                  aria-label="대화 목록으로 돌아가기"
                >
                  <ArrowLeft size={22} />
                </button>
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-sm font-black text-white shadow-lg">
                    {getInitials(activeConversation.recipient.name)}
                  </div>
                  {activeConversation.recipient.online ? (
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-4 border-white bg-green-500" />
                  ) : null}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black leading-none tracking-tight text-black">
                      {activeConversation.recipient.name}
                    </p>
                    <ShieldCheck size={16} className="text-blue-500" />
                  </div>
                  <p
                    className={`mt-1 text-[11px] font-black uppercase tracking-widest ${
                      activeConversation.recipient.online ? 'text-green-600' : 'text-zinc-400'
                    }`}
                  >
                    {activeConversation.recipient.online ? 'Online now' : activeConversation.recipient.role}
                  </p>
                </div>
              </div>

              <div ref={headerMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen((current) => !current)}
                  className="rounded-2xl p-3 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
                  aria-label="대화방 옵션"
                >
                  <Ellipsis size={24} />
                </button>
                {headerMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-3 w-52 rounded-[24px] border border-zinc-100 bg-white p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => void handleLeaveActiveConversation()}
                      disabled={messageActionLoading}
                      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      대화방 나가기
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
              {hasNextMessages ? (
                <div className="mb-6 flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadOlderMessages}
                    disabled={loadingOlderMessages}
                    className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-black text-zinc-600 transition hover:border-black hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loadingOlderMessages ? '이전 메시지 불러오는 중...' : '이전 메시지 더보기'}
                  </button>
                </div>
              ) : null}

              {loadingMessages && activeMessages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex items-center gap-3 text-sm font-bold text-zinc-500">
                    <Loader2 size={18} className="animate-spin" />
                    메시지를 불러오는 중...
                  </div>
                </div>
              ) : activeMessages.length > 0 ? (
                <div className="space-y-6">
                  {activeMessages.map((chatMessage) => (
                    <MessageBubble
                      key={chatMessage.id}
                      chatMessage={chatMessage}
                      mine={chatMessage.senderId === 'me'}
                      recipientName={activeConversation.recipient.name}
                      isActionOpen={messageActionId === chatMessage.id}
                      actionLoading={messageActionLoading}
                      onToggleAction={() =>
                        setMessageActionId((current) => (current === chatMessage.id ? null : chatMessage.id))
                      }
                      onDelete={() => void handleDeleteMessage(chatMessage.id)}
                      onOpenPost={handleOpenPost}
                      onOpenImage={handleOpenImage}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="mx-auto mb-4 text-zinc-300" size={42} />
                    <p className="text-lg font-black text-black">대화를 시작해보세요.</p>
                    <p className="mt-2 text-sm font-bold text-zinc-400">
                      아직 메시지가 없습니다. 첫 메시지를 보내보세요.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-zinc-100 bg-white p-6">
              {isAuthError ? (
                <div className="mx-auto mb-3 flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">
                  <span className="flex min-w-0 items-center gap-2">
                    <CircleAlert size={16} className="shrink-0" />
                    <span className="truncate">인증이 만료되었거나 다시 로그인이 필요합니다.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="rounded-xl bg-black px-3 py-2 text-xs font-black text-white"
                  >
                    다시 로그인
                  </button>
                </div>
              ) : null}

              {composerError ? (
                <div className="mx-auto mb-3 flex max-w-4xl items-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  <CircleAlert size={16} className="shrink-0" />
                  <span>{composerError}</span>
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="mx-auto mb-3 flex max-w-4xl flex-wrap gap-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative">
                      <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 shadow-sm">
                        {attachment.type === 'image' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenImage({ url: attachment.previewUrl, name: attachment.name })}
                            className="block h-20 w-20 cursor-zoom-in"
                            aria-label={`${attachment.name} 확대 보기`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={attachment.previewUrl}
                              alt={attachment.name}
                              className="h-20 w-20 object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-20 w-20 items-center justify-center bg-zinc-900 text-white">
                            <Video size={22} />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((current) => {
                            const target = current.find((item) => item.id === attachment.id);
                            if (target) {
                              URL.revokeObjectURL(target.previewUrl);
                            }

                            return current.filter((item) => item.id !== attachment.id);
                          })
                        }
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900/92 text-white shadow-lg ring-2 ring-white/90 transition hover:bg-black"
                        aria-label="첨부 제거"
                      >
                        <Trash2 size={14} className="-translate-x-[1px] shrink-0" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                ref={attachmentMenuRef}
                className="relative mx-auto flex max-w-4xl items-center gap-3 rounded-[28px] bg-zinc-50 p-2 shadow-inner transition focus-within:bg-white focus-within:ring-2 focus-within:ring-black"
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/*,.jpg,.jpeg,.png,.gif,.webp"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*,.mp4,.mov,.webm,.m4v"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
                <button
                  type="button"
                  onClick={() => setAttachmentMenuOpen((current) => !current)}
                  className="rounded-2xl p-4 text-zinc-400 transition hover:bg-zinc-200"
                  aria-label="첨부 메뉴"
                >
                  <Plus size={20} />
                </button>
                {attachmentMenuOpen ? (
                  <div className="absolute bottom-full left-0 z-20 mb-3 rounded-[24px] border border-zinc-100 bg-white p-2 shadow-2xl">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex w-44 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 hover:text-black"
                    >
                      <ImagePlus size={18} />
                      사진 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="flex w-44 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-zinc-700 transition hover:bg-zinc-50 hover:text-black"
                    >
                      <Video size={18} />
                      동영상 추가
                    </button>
                    <button
                      type="button"
                      onClick={clearAttachments}
                      className="flex w-44 items-center gap-3 rounded-2xl px-4 py-3 text-sm font-black text-zinc-400 transition hover:bg-zinc-50 hover:text-black"
                    >
                      <X size={18} />
                      첨부 지우기
                    </button>
                  </div>
                ) : null}
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={`${activeConversation.recipient.name}님에게 메시지 보내기`}
                  disabled={sending}
                  className="flex-1 bg-transparent px-2 text-[15px] font-bold text-black outline-none placeholder:text-zinc-400"
                />
                <button
                  type="submit"
                  disabled={(!message.trim() && attachments.length === 0) || sending}
                  className="flex min-h-12 min-w-12 items-center justify-center rounded-2xl bg-black p-4 text-white shadow-lg transition hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 disabled:hover:scale-100"
                  aria-label="메시지 전송"
                >
                  {sending ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Inbox className="mx-auto mb-4 text-zinc-300" size={48} />
              <p className="text-lg font-black text-black">대화를 선택해주세요.</p>
            </div>
          </div>
        )}
      </section>
      <ImageLightbox image={expandedImage} onClose={() => setExpandedImage(null)} />
    </div>
  );
}
