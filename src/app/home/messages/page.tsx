'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCheck,
  ImagePlus,
  Inbox,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Video,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import {
  fetchConversations,
  readConversation,
  sendMessage,
  startConversation,
} from '@/lib/message-api';
import {
  Conversation,
  ChatAttachment,
  MESSAGE_RECIPIENTS,
  MessageRecipient,
  formatChatTime,
  formatConversationTime,
  getInitials,
} from '@/lib/message-store';

function getLastPreview(conversation: Conversation) {
  const lastMessage = conversation.messages.at(-1);
  if (!lastMessage) return '아직 대화가 없습니다.';

  if (lastMessage.sharedPost) {
    return lastMessage.text ? `${lastMessage.text} · 게시물 공유` : '게시물을 공유했습니다.';
  }

  if (lastMessage.attachments?.length) {
    const label = lastMessage.attachments[0].type === 'video' ? '동영상' : '사진';
    return lastMessage.text ? `${lastMessage.text} · ${label}` : `${label}을 보냈습니다.`;
  }

  return lastMessage.text;
}

function createAttachmentId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
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
            <p className={`truncate text-[11px] font-bold uppercase tracking-widest ${
              active ? 'text-white/55' : 'text-zinc-400'
            }`}>
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
  existingIds,
  onStart,
  onClose,
}: {
  existingIds: string[];
  onStart: (recipient: MessageRecipient) => void;
  onClose: () => void;
}) {
  const availableRecipients = MESSAGE_RECIPIENTS.filter((recipient) => !existingIds.includes(recipient.id));

  return (
    <div className="rounded-[28px] border border-zinc-100 bg-zinc-50 p-3">
      <div className="mb-2 flex items-center justify-between px-2">
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
      {availableRecipients.length > 0 ? (
        <div className="space-y-1">
          {availableRecipients.map((recipient) => (
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
        <p className="px-2 py-3 text-sm font-bold text-zinc-400">시작할 수 있는 새 대화가 없습니다.</p>
      )}
    </div>
  );
}

function SharedPostCard({
  message,
  onOpenPost,
}: {
  message: Conversation['messages'][number];
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
        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">공유 게시물</p>
        <p className="mt-1 text-sm font-black text-black">{message.sharedPost.author}</p>
        <p className="text-xs font-bold text-zinc-400">@{message.sharedPost.authorHandle}</p>
      </div>
      <p className="line-clamp-3 px-4 py-3 text-sm font-medium leading-6 text-zinc-700">
        {message.sharedPost.content}
      </p>
    </button>
  );
}

function AttachmentGrid({ attachments }: { attachments: ChatAttachment[] }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2">
      {attachments.map((attachment) => (
        <div key={attachment.id} className="overflow-hidden rounded-2xl bg-black/5">
          {attachment.type === 'video' ? (
            <video controls src={attachment.url} className="max-h-80 w-full bg-black object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={attachment.url} alt={attachment.name} className="max-h-80 w-full object-cover" />
          )}
          <p className="truncate bg-white/80 px-3 py-2 text-xs font-bold text-zinc-500">{attachment.name}</p>
        </div>
      ))}
    </div>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState('');
  const [lastFailedAttachments, setLastFailedAttachments] = useState<ChatAttachment[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [sending, setSending] = useState(false);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    const load = async () => {
      const loaded = await fetchConversations(user?.id);
      setConversations(loaded);
      setActiveConversationId((current) => current || loaded[0]?.id || '');
    };

    void load();
  }, [user?.id]);

  useEffect(() => {
    if (!activeConversationId || conversations.length === 0) return;

    const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId);
    if (!activeConversation || activeConversation.unreadCount === 0) return;

    const markRead = async () => {
      const next = await readConversation(user?.id, conversations, activeConversationId);
      setConversations(next);
    };

    void markRead();
  }, [activeConversationId, conversations, user?.id]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;

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
    setLastFailedMessage('');
    setLastFailedAttachments([]);
    setAttachments([]);
    setAttachmentMenuOpen(false);
  };

  const handleStartConversation = async (recipient: MessageRecipient) => {
    const next = await startConversation(user?.id, conversations, recipient);
    setConversations(next);
    setActiveConversationId(recipient.id);
    setShowNewChat(false);
    setMobileView('chat');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedMessage = message.trim();
    if ((!trimmedMessage && attachments.length === 0) || !activeConversation || sending) return;

    try {
      setSending(true);
      setLastFailedMessage('');
      setLastFailedAttachments([]);
      const next = await sendMessage(user?.id, conversations, activeConversation.id, trimmedMessage, attachments);
      setConversations(next);
      setMessage('');
      setAttachments([]);
      setAttachmentMenuOpen(false);
    } catch {
      setLastFailedMessage(trimmedMessage);
      setLastFailedAttachments(attachments);
    } finally {
      setSending(false);
    }
  };

  const handleRetry = async () => {
    if (!activeConversation || (!lastFailedMessage && lastFailedAttachments.length === 0) || sending) return;

    try {
      setSending(true);
      const next = await sendMessage(
        user?.id,
        conversations,
        activeConversation.id,
        lastFailedMessage,
        lastFailedAttachments
      );
      setConversations(next);
      setLastFailedMessage('');
      setLastFailedAttachments([]);
      setMessage('');
    } catch {
      setMessage(lastFailedMessage);
      setAttachments(lastFailedAttachments);
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 4);
    const nextAttachments = await Promise.all(
      files.map(async (file) => ({
        id: createAttachmentId(),
        type: 'image' as const,
        name: file.name,
        url: await readFileAsDataUrl(file),
      }))
    );

    setAttachments(nextAttachments);
    setAttachmentMenuOpen(false);
  };

  const handleVideoSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAttachments([
      {
        id: createAttachmentId(),
        type: 'video',
        name: file.name,
        url: await readFileAsDataUrl(file),
      },
    ]);
    setAttachmentMenuOpen(false);
  };

  const clearAttachments = () => {
    setAttachments([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleOpenPost = (postId: string) => {
    router.push(`/home?postId=${encodeURIComponent(postId)}`);
  };

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
              placeholder="대화 또는 게이머 검색"
              className="h-12 w-full rounded-2xl bg-zinc-50 pl-12 pr-4 text-sm font-bold text-black outline-none transition focus:ring-2 focus:ring-black"
            />
          </label>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
          {showNewChat ? (
            <NewChatPicker
              existingIds={conversations.map((conversation) => conversation.id)}
              onStart={handleStartConversation}
              onClose={() => setShowNewChat(false)}
            />
          ) : null}

          {filteredConversations.length > 0 ? (
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
              <p className="text-sm font-black text-zinc-500">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </section>

      <section
        className={`flex-1 flex-col bg-zinc-50/40 md:flex ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeConversation ? (
          <>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/90 px-8 py-5 backdrop-blur-md">
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
                  <p className={`mt-1 text-[11px] font-black uppercase tracking-widest ${
                    activeConversation.recipient.online ? 'text-green-600' : 'text-zinc-400'
                  }`}>
                    {activeConversation.recipient.online ? 'Online now' : activeConversation.recipient.role}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-2xl p-3 text-zinc-400 transition hover:bg-zinc-100 hover:text-black"
                aria-label="대화 옵션"
              >
                <MoreHorizontal size={24} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-8">
              {activeConversation.messages.length > 0 ? (
                activeConversation.messages.map((chatMessage) => {
                  const mine = chatMessage.senderId === 'me';

                  return (
                    <div
                      key={chatMessage.id}
                      className={`flex items-end gap-3 ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      {!mine ? (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-200 text-[10px] font-black text-black">
                          {getInitials(activeConversation.recipient.name)}
                        </div>
                      ) : null}

                      <div className={`max-w-[72%] ${mine ? 'items-end' : 'items-start'}`}>
                        <div
                          className={`rounded-[28px] px-6 py-4 text-[15px] font-medium leading-relaxed shadow-sm ${
                            mine
                              ? 'rounded-br-none bg-black text-white'
                              : 'rounded-bl-none border border-zinc-100 bg-white text-zinc-800'
                          }`}
                        >
                          {chatMessage.text ? <p>{chatMessage.text}</p> : null}
                          <AttachmentGrid attachments={chatMessage.attachments ?? []} />
                          <SharedPostCard message={chatMessage} onOpenPost={handleOpenPost} />
                        </div>
                        <div className={`mt-2 flex items-center gap-1 text-[10px] font-black uppercase text-zinc-300 ${
                          mine ? 'justify-end' : 'justify-start'
                        }`}>
                          {mine ? <CheckCheck size={13} /> : null}
                          <span>
                            {chatMessage.deliveryStatus === 'failed'
                              ? 'Failed'
                              : `${mine ? 'Read' : ''} ${formatChatTime(chatMessage.createdAt)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="mx-auto mb-4 text-zinc-300" size={42} />
                    <p className="text-lg font-black text-black">새 대화를 시작해보세요.</p>
                    <p className="mt-2 text-sm font-bold text-zinc-400">
                      프론트 임시 저장으로 메시지를 주고받는 흐름을 확인할 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="border-t border-zinc-100 bg-white p-6">
              {lastFailedMessage || lastFailedAttachments.length > 0 ? (
                <div className="mx-auto mb-3 flex max-w-4xl items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  <span className="flex min-w-0 items-center gap-2">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="truncate">메시지 전송에 실패했습니다.</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={sending}
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:text-red-300"
                  >
                    <RotateCcw size={14} />
                    재전송
                  </button>
                </div>
              ) : null}
              {attachments.length > 0 ? (
                <div className="mx-auto mb-3 flex max-w-4xl flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="group flex max-w-52 items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 px-3 py-2"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500">
                        {attachment.type === 'video' ? <Video size={16} /> : <ImagePlus size={16} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-black text-zinc-600">
                        {attachment.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAttachments((current) => current.filter((item) => item.id !== attachment.id))
                        }
                        className="rounded-lg p-1 text-zinc-400 transition hover:bg-white hover:text-black"
                        aria-label="첨부 삭제"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="relative mx-auto flex max-w-4xl items-center gap-3 rounded-[28px] bg-zinc-50 p-2 shadow-inner transition focus-within:bg-white focus-within:ring-2 focus-within:ring-black">
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
                <button
                  type="button"
                  onClick={() => setAttachmentMenuOpen((current) => !current)}
                  className="rounded-2xl p-4 text-zinc-400 transition hover:bg-zinc-200"
                  aria-label="첨부"
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
                  placeholder={`${activeConversation.recipient.name}에게 메시지 보내기`}
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
              <p className="text-lg font-black text-black">대화를 선택하세요.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
