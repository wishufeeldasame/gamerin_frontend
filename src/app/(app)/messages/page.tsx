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
  RotateCw,
  Search,
  Send,
  SquarePen,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { type CSSProperties, ChangeEvent, FormEvent, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getPostHref } from '@/lib/feed-api';
import { isAuthError, toUploadErrorMessage } from '@/lib/api-client';
import { getAuthGeneration, isCurrentAuthGeneration } from '@/lib/auth-store';
import {
  createConversation,
  deleteConversationMessage,
  fetchMessageAttachmentBlob,
  fetchConversationList,
  fetchConversationMessages,
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
  PendingChatAttachment,
  PendingChatMessage,
  createClientId,
  formatChatTime,
  formatMessageDate,
  getInitials,
  hideDeliveredPendingMessages,
  mergeMessages,
  shouldShowMessageDateSeparator,
} from '@/lib/message-store';
import { useUnloadWarning } from '@/hooks/useUnloadWarning';
import { invalidateNotifications } from '@/lib/notification-sync';
import { convertImagesForUpload } from '@/lib/profile-image-compression';
import MessageDateSeparator from './MessageDateSeparator';
import { RelativeTime } from '@/app/home/components/RelativeTime';
import { MembershipBadge } from '@/app/home/components/MembershipBadge';
import { RepresentativeTierBadge } from '@/app/home/components/RepresentativeTierBadge';
import { ConversationListSkeleton, MessageThreadSkeleton } from '@/app/home/components/LoadingSkeletons';

const MESSAGE_PAGE_SIZE = 30;

const MAX_MESSAGE_LENGTH = 2000;
// 대화 목록 API는 전체를 한 번에 주므로 화면에는 나눠 그리고 끝에 닿으면 더 그린다.
const CONVERSATION_RENDER_STEP = 20;
const MAX_MESSAGE_STREAM_RECONNECT_ATTEMPTS = 5;


type DraftAttachment = PendingChatAttachment;

type ExpandedImage = {
  url: string;
  name: string;
};

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
          <mark key={`${part}-${index}`} className="rounded bg-brand px-0.5 text-fg-on-brand">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        )
      )}
    </>
  );
}

function UserAvatar({
  name,
  imageUrl,
  className,
  sizes,
}: {
  name: string;
  imageUrl?: string | null;
  className: string;
  sizes: string;
}) {
  return (
    <div className={`relative flex shrink-0 items-center justify-center overflow-hidden ${className}`}>
      {imageUrl ? (
        <Image src={imageUrl} alt={name} fill unoptimized sizes={sizes} className="object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
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
      aria-current={active ? 'true' : undefined}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-fg-brand ${
        active
          ? 'bg-subtle'
          : 'hover:bg-subtle'
      }`}
    >
      <UserAvatar
        name={conversation.recipient.name}
        imageUrl={conversation.recipient.profileImageUrl}
        sizes="44px"
        className="h-11 w-11 rounded-full bg-subtle text-label text-fg-secondary"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-body font-medium text-fg-primary">
            <span className="truncate"><HighlightedText text={conversation.recipient.name} query={query} /></span>
            <MembershipBadge active={conversation.recipient.membershipBadge} /><RepresentativeTierBadge tier={conversation.recipient.representativeTier} />
            <span className="truncate text-caption text-fg-tertiary">
              <HighlightedText text={conversation.recipient.handle} query={query} />
            </span>
          </p>
          <span className="shrink-0 text-caption text-fg-tertiary">
            <RelativeTime createdAt={conversation.updatedAt} />
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={`truncate text-body ${conversation.unreadCount > 0 ? 'font-medium text-fg-primary' : 'text-fg-secondary'}`}>
            <HighlightedText text={getLastPreview(conversation)} query={query} />
          </p>
          {conversation.unreadCount > 0 ? (
            <span aria-label={`읽지 않은 메시지 ${conversation.unreadCount}개`} className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-caption text-fg-on-brand">
              {conversation.unreadCount}
            </span>
          ) : null}
        </div>
      </div>
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
    <div className="m-3 rounded-card bg-subtle p-3">
      <div className="mb-3 flex items-center justify-between px-2">
        <p className="text-label text-fg-secondary">새 대화</p>
        <button
          type="button"
          onClick={onClose}
          className="btn-icon"
          aria-label="새 대화 닫기"
        >
          <X size={16} />
        </button>
      </div>

      <label className="relative mb-3 block">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary" size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="이름 또는 핸들 검색"
          aria-label="이름 또는 핸들 검색"
          className="input-base pl-10"
        />
      </label>

      {loading ? (
        <div role="status" className="flex items-center justify-center py-6 text-label text-fg-tertiary">
          <Loader2 size={16} className="mr-2 animate-spin" />
          검색 중...
        </div>
      ) : errorMessage ? (
        <div role="alert" className="rounded-control bg-danger-subtle px-4 py-3 text-label text-fg-danger">
          {errorMessage}
        </div>
      ) : recipients.length > 0 ? (
        <div className="space-y-1">
          {recipients.map((recipient) => (
            <button
              key={recipient.id}
              type="button"
              onClick={() => onStart(recipient)}
              className="flex w-full items-center gap-3 rounded-control p-3 text-left transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-fg-brand"
            >
              <UserAvatar
                name={recipient.name}
                imageUrl={recipient.profileImageUrl}
                sizes="40px"
                className="h-10 w-10 rounded-full bg-surface text-caption text-fg-secondary"
              />
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1 text-body font-medium text-fg-primary">
                  <span className="truncate">{recipient.name}</span>
                  <MembershipBadge active={recipient.membershipBadge} /><RepresentativeTierBadge tier={recipient.representativeTier} />
                </span>
                <span className="block truncate text-caption text-fg-tertiary">
                  {recipient.handle}
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p role="status" className="px-2 py-3 text-body text-fg-tertiary">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}

function SharedPostCard({
  message,
  onOpenPost,
}: {
  message: ChatMessage;
  onOpenPost: (postNumber: number) => void;
}) {
  if (!message.sharedPost) return null;

  return (
    <button
      type="button"
      onClick={() => onOpenPost(message.sharedPost!.postNumber)}
      className="mt-2 block w-full overflow-hidden rounded-card border border-line bg-surface p-3 text-left text-fg-primary transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-fg-brand"
    >
      <div>
        <p className="text-caption text-fg-brand">공유 게시글</p>
        <p className="mt-1 text-label text-fg-primary">{message.sharedPost.author} · @{message.sharedPost.authorHandle}</p>
      </div>
      <p className="mt-1 line-clamp-3 text-body text-fg-secondary">
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
      className="dm-image-lightbox fixed left-0 right-0 z-[200] flex flex-col items-center gap-3 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={image.name}
    >
      <button
        type="button"
        onClick={onClose}
        className="z-10 flex h-11 w-11 shrink-0 self-end items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label="이미지 닫기"
      >
        <X size={20} />
      </button>
      <div className="min-h-0 w-full max-w-6xl flex-1" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.name}
          className="h-full w-full rounded-card object-contain"
        />
      </div>
      <p onClick={(event) => event.stopPropagation()} className="max-h-20 w-full shrink-0 overflow-auto break-all text-center text-label text-white/80">{image.name}</p>
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
        <div key={attachment.id} className="overflow-hidden rounded-card bg-subtle">
          <MessageAttachmentMedia attachment={attachment} onOpenImage={onOpenImage} />
          <p className="truncate px-3 py-2 text-caption text-fg-secondary">{attachment.name}</p>
        </div>
      ))}
    </div>
  );
}

function MessageAttachmentMedia({
  attachment,
  onOpenImage,
}: {
  attachment: ChatAttachment;
  onOpenImage: (attachment: ChatAttachment) => void;
}) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let nextObjectUrl: string | null = null;

    setObjectUrl(null);
    setFailed(false);

    fetchMessageAttachmentBlob(attachment.url)
      .then((blob) => {
        if (!active) return;
        nextObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(nextObjectUrl);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [attachment.url]);

  if (failed) {
    return (
      <div className="flex h-44 items-center justify-center bg-subtle px-4 text-center text-body text-fg-secondary">
        첨부를 불러올 수 없습니다.
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className="flex h-44 items-center justify-center bg-subtle text-fg-tertiary">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }

  if (attachment.type === 'video') {
    return <video controls playsInline preload="metadata" src={objectUrl} className="max-h-80 w-full bg-black object-contain" />;
  }

  return (
    <button
      type="button"
      onClick={() => onOpenImage({ ...attachment, url: objectUrl })}
      className="block w-full cursor-zoom-in"
      aria-label={`${attachment.name} 확대 보기`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={objectUrl} alt={attachment.name} className="max-h-80 w-full object-cover" />
    </button>
  );
}

function MessageBubble({
  chatMessage,
  mine,
  isActionOpen,
  actionLoading,
  onToggleAction,
  onDelete,
  onOpenPost,
  onOpenImage,
}: {
  chatMessage: ChatMessage;
  mine: boolean;
  isActionOpen: boolean;
  actionLoading: boolean;
  onToggleAction: () => void;
  onDelete: () => void;
  onOpenPost: (postNumber: number) => void;
  onOpenImage: (attachment: ChatAttachment) => void;
}) {
  // 모바일에는 호버가 없으니 내 메시지를 길게 누르면 메뉴를 연다.
  const longPressTimerRef = useRef<number | null>(null);
  const cancelLongPress = () => {
    if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };
  const startLongPress = (event: React.PointerEvent) => {
    if (!mine || event.pointerType !== 'touch') return;
    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      onToggleAction();
    }, 500);
  };

  return (
    <div className={`flex items-start gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`min-w-0 max-w-[85%] ${mine ? 'items-end' : 'items-start'}`}>
        <div
          className={`group relative flex items-end gap-1 ${mine ? 'justify-end' : 'justify-start'}`}
          data-message-action-root="true"
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerMove={cancelLongPress}
          onPointerCancel={cancelLongPress}
          onContextMenu={(event) => {
            if (mine && window.matchMedia('(pointer: coarse)').matches) event.preventDefault();
          }}
        >
          {mine && isActionOpen ? (
            <div className="absolute bottom-1 right-full mr-3 flex h-10 items-center overflow-hidden rounded-control border border-line bg-surface shadow-lg">
              <button
                type="button"
                onClick={onDelete}
                disabled={actionLoading}
                className="flex h-full items-center justify-center px-4 text-fg-danger transition hover:bg-danger-subtle disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="메시지 삭제"
              >
                <Trash2 size={16} className="-translate-x-[1px] shrink-0" />
              </button>
            </div>
          ) : null}

          <div
            className={`min-w-0 whitespace-pre-wrap break-words rounded-card px-3.5 py-2.5 text-body max-md:select-none max-md:[-webkit-touch-callout:none] ${
              mine
                ? 'bg-brand text-fg-on-brand'
                : 'bg-subtle text-fg-primary'
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
              className={`mb-1 rounded-full p-2 text-fg-tertiary transition hover:bg-surface hover:text-fg-secondary focus-visible:opacity-100 dark:hover:bg-surface-elevated ${isActionOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              aria-label="메시지 액션"
            >
              <Ellipsis size={16} />
            </button>
          ) : null}
        </div>

        <div
          className={`mt-1 flex items-center gap-1 text-caption text-fg-tertiary ${
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

function PendingMessageBubble({
  pendingMessage,
  onRetry,
  onDiscard,
  onOpenImage,
}: {
  pendingMessage: PendingChatMessage;
  onRetry: () => void;
  onDiscard: () => void;
  onOpenImage: (image: ExpandedImage) => void;
}) {
  const failed = pendingMessage.status === 'failed';
  const hasVideo = pendingMessage.attachments.some((attachment) => attachment.type === 'video');

  return (
    <div className="flex items-end justify-end gap-3" data-pending-message-id={pendingMessage.id}>
      <div className="flex min-w-0 max-w-[85%] flex-col items-end">
        <div
          className={`min-w-0 whitespace-pre-wrap break-words rounded-card bg-brand px-3.5 py-2.5 text-body text-fg-on-brand ${
            failed ? 'ring-1 ring-line-danger' : ''
          }`}
        >
          {pendingMessage.text ? <p>{pendingMessage.text}</p> : null}
          {pendingMessage.attachments.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {pendingMessage.attachments.map((attachment) => (
                <div key={attachment.id} className="overflow-hidden rounded-card bg-subtle">
                  {attachment.type === 'video' ? (
                    <video src={attachment.previewUrl} muted controls playsInline className="max-h-80 w-full bg-black object-contain" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenImage({ url: attachment.previewUrl, name: attachment.name })}
                      className="block w-full cursor-zoom-in"
                      aria-label={`${attachment.name} 확대 보기`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={attachment.previewUrl} alt={attachment.name} className="max-h-80 w-full object-cover" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {failed ? (
          <div role="alert" className="mt-2 flex flex-wrap items-center justify-end gap-2 text-caption text-fg-danger">
            <CircleAlert size={13} className="shrink-0" />
            <span>전송 실패 · {pendingMessage.errorMessage}</span>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-control bg-danger-subtle px-2.5 py-1 text-label text-fg-danger focus-visible:outline-2 focus-visible:outline-line-danger"
            >
              <RotateCw size={12} />
              재시도
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="inline-flex items-center gap-1 rounded-control bg-subtle px-2.5 py-1 text-label text-fg-secondary transition hover:text-fg-primary focus-visible:outline-2 focus-visible:outline-fg-brand"
            >
              <Trash2 size={12} />
              삭제
            </button>
          </div>
        ) : (
          <div role="status" className="mt-2 flex items-center gap-1 text-caption text-fg-tertiary">
            <Loader2 size={12} className="animate-spin" />
            <span>{hasVideo ? '동영상 업로드 중... 시간이 걸릴 수 있습니다' : '전송 중...'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StreamReplacedNotice({ className = '' }: { className?: string }) {
  return (
    <div
      role="status"
      className={`m-3 rounded-control bg-brand-subtle px-4 py-3 text-label text-fg-brand ${className}`}
    >
      다른 탭이나 기기에서 메시지 화면을 열어 실시간 연결이 종료되었습니다. 새로고침하면 다시 연결됩니다.
    </div>
  );
}

export default function MessagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthReady } = useAuth();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentMenuRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef(new Map<string, HTMLDivElement>());
  const handledMessageDeepLinkRef = useRef('');
  const activeConversationIdRef = useRef('');
  const attachmentsRef = useRef<DraftAttachment[]>([]);
  // 전송 대기열이 렌더 전에도 최신 임시 메시지를 읽도록 state와 함께 갱신한다.
  const pendingRef = useRef<Record<string, PendingChatMessage[]>>({});
  const sendQueueRef = useRef<Promise<void>>(Promise.resolve());
  const messagesRef = useRef<Record<string, ChatMessage[]>>({});

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [nextCursorByConversation, setNextCursorByConversation] = useState<Record<string, string | null>>({});
  const [hasNextByConversation, setHasNextByConversation] = useState<Record<string, boolean>>({});
  const [activeConversationId, setActiveConversationId] = useState('');
  const [query, setQuery] = useState('');
  const [conversationRenderCount, setConversationRenderCount] = useState(CONVERSATION_RENDER_STEP);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const conversationSentinelRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<DraftAttachment[]>([]);
  const [preparingImages, setPreparingImages] = useState(false);
  // 변환 중에 첨부를 비우거나 대화방을 바꾸면 늦게 끝난 변환 결과를 버린다.
  const imageSelectionSeqRef = useRef(0);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [pendingByConversation, setPendingByConversation] = useState<Record<string, PendingChatMessage[]>>({});
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [viewport, setViewport] = useState<{ height: number; top: number; keyboard: boolean } | null>(null);
  useEffect(() => {
    const visual = window.visualViewport;
    const layoutHeight = () => Math.max(document.documentElement.clientHeight, window.innerHeight, visual?.height ?? 0);
    let unfocusedHeight = layoutHeight();
    let width = window.innerWidth;
    const update = () => {
      const focused = Boolean(document.activeElement?.closest('[data-message-composer]'));
      const height = visual?.height ?? window.innerHeight;
      // 키보드가 열린 채 포커스가 이동해도 축소된 높이를 기준값으로 저장하지 않는다.
      if (width !== window.innerWidth || (!focused && unfocusedHeight - height <= 150)) unfocusedHeight = layoutHeight();
      width = window.innerWidth;
      const next = {
        height,
        top: visual?.offsetTop ?? 0,
        keyboard: focused && unfocusedHeight - height > 150,
      };
      setViewport(previous => previous?.height === next.height && previous.top === next.top && previous.keyboard === next.keyboard ? previous : next);
    };
    update();
    visual?.addEventListener('resize', update);
    visual?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    document.addEventListener('focusin', update);
    document.addEventListener('focusout', update);
    return () => {
      visual?.removeEventListener('resize', update);
      visual?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('focusout', update);
    };
  }, []);
  // 모바일에서 대화창을 열면 하단 탭바를 숨겨 대화 영역을 넓힌다(globals.css의 data-chat-open 규칙).
  // v2는 상단 바도 숨기고 대화 헤더의 뒤로 버튼으로 목록에 돌아간다(F15).
  useEffect(() => {
    if (mobileView !== 'chat') return;
    document.body.dataset.chatOpen = 'true';
    return () => {
      delete document.body.dataset.chatOpen;
    };
  }, [mobileView]);
  const [expandedImage, setExpandedImage] = useState<ExpandedImage | null>(null);
  const [pageError, setPageError] = useState('');
  const [streamReplaced, setStreamReplaced] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [messageActionId, setMessageActionId] = useState<string | null>(null);
  const messageScrollRef = useRef<HTMLDivElement | null>(null);
  const olderMessagesSentinelRef = useRef<HTMLDivElement | null>(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const requestedConversationId = searchParams.get('conversationId') ?? '';
  const requestedMessageId = searchParams.get('messageId') ?? '';
  const requestedRecipientHandle = searchParams.get('recipient') ?? '';
  const requestedRecipientRef = useRef('');

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
  const activeMessages = useMemo(
    () => (activeConversationId ? messagesByConversation[activeConversationId] ?? [] : []),
    [activeConversationId, messagesByConversation],
  );
  const activePendingMessages = useMemo(
    () => hideDeliveredPendingMessages(
      activeConversationId ? pendingByConversation[activeConversationId] ?? [] : [],
      activeMessages,
    ),
    [activeConversationId, activeMessages, pendingByConversation],
  );
  // 새 서버 메시지뿐 아니라 임시 메시지가 추가되거나 실패로 바뀌어 재시도 버튼이 생길 때도 맨 아래로 스크롤한다.
  const latestPendingMessage = activePendingMessages.at(-1);
  const latestServerMessageId = activeMessages.at(-1)?.id ?? '';
  const latestMessageId = latestPendingMessage
    ? `${latestServerMessageId}|${latestPendingMessage.id}:${latestPendingMessage.status}`
    : latestServerMessageId;
  useUnloadWarning(
    Object.values(pendingByConversation).some((items) => items.some((item) => item.status !== 'failed'))
  );
  const hasNextMessages = activeConversationId ? (hasNextByConversation[activeConversationId] ?? false) : false;

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    messagesRef.current = messagesByConversation;
  }, [messagesByConversation]);

  const requestedMessageIsLoaded =
    activeConversationId === requestedConversationId &&
    Boolean(requestedMessageId) &&
    activeMessages.some((message) => message.id === requestedMessageId);

  // 폴링 응답·이전 메시지 추가로는 스크롤하지 않도록 최신 메시지 ID 변경에만 반응한다.
  useLayoutEffect(() => {
    if (!activeConversationId || !latestMessageId) return;

    const requestedDeepLinkKey = `${requestedConversationId}:${requestedMessageId}`;
    if (
      handledMessageDeepLinkRef.current &&
      handledMessageDeepLinkRef.current !== requestedDeepLinkKey
    ) {
      setHighlightedMessageId(null);
    }

    if (requestedMessageIsLoaded) return;

    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [activeConversationId, latestMessageId, requestedConversationId, requestedMessageId, requestedMessageIsLoaded]);

  useLayoutEffect(() => {
    if (
      !requestedConversationId ||
      !requestedMessageId ||
      activeConversationId !== requestedConversationId
    ) {
      return;
    }

    const deepLinkKey = `${requestedConversationId}:${requestedMessageId}`;
    if (handledMessageDeepLinkRef.current === deepLinkKey) return;

    const messageElement = messageElementRefs.current.get(requestedMessageId);
    if (!messageElement) return;

    handledMessageDeepLinkRef.current = deepLinkKey;
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageId(requestedMessageId);
  }, [activeConversationId, activeMessages, requestedConversationId, requestedMessageId]);

  useEffect(() => {
    if (!highlightedMessageId) return;

    const timer = window.setTimeout(() => setHighlightedMessageId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId]);

  const revokeAttachmentUrls = useCallback((targets: DraftAttachment[]) => {
    for (const target of targets) {
      URL.revokeObjectURL(target.previewUrl);
    }
  }, []);

  const clearAttachments = useCallback(() => {
    imageSelectionSeqRef.current += 1;
    setPreparingImages(false);
    setAttachments((current) => {
      revokeAttachmentUrls(current);
      return [];
    });

    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  }, [revokeAttachmentUrls]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      revokeAttachmentUrls(attachmentsRef.current);
      revokeAttachmentUrls(Object.values(pendingRef.current).flat().flatMap((item) => item.attachments));
      // 대기열에 남은 메시지가 화면을 떠난 뒤 전송되지 않도록 비운다.
      pendingRef.current = {};
    };
  }, [revokeAttachmentUrls]);

  const updatePendingMessages = useCallback(
    (conversationId: string, updater: (items: PendingChatMessage[]) => PendingChatMessage[]) => {
      const next = { ...pendingRef.current, [conversationId]: updater(pendingRef.current[conversationId] ?? []) };
      if (next[conversationId].length === 0) delete next[conversationId];
      pendingRef.current = next;
      setPendingByConversation(next);
    },
    [],
  );

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
      setActiveConversationId((current) => {
        if (current && data.some((conversation) => conversation.id === current)) {
          return current;
        }

        return '';
      });
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '대화 목록을 불러오지 못했습니다.');
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
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.');
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
        invalidateNotifications('conversation-read');
      } catch {}
    };

    void markRead();
  }, [activeConversation]);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let cancelled = false;
    // 서버가 더 새 연결에 밀어냈다면 재연결하지 않는다(탭끼리 서로 밀어내는 루프 방지).
    let replaced = false;
    setStreamReplaced(false);

    function scheduleReconnect() {
      if (cancelled || replaced || reconnectTimer) return false;
      if (reconnectAttempt >= MAX_MESSAGE_STREAM_RECONNECT_ATTEMPTS) {
        setPageError('실시간 메시지 연결에 반복해서 실패했습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.');
        return false;
      }

      reconnectAttempt += 1;
      const retryDelay = Math.min(30000, reconnectAttempt * 2000);
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, retryDelay);
      return true;
    }

    const connect = async () => {
      try {
        const nextEventSource = await openMessageEventSource();

        if (cancelled) {
          nextEventSource.close();
          return;
        }

        eventSource = nextEventSource;

        nextEventSource.onopen = () => {
          reconnectAttempt = 0;
          setPageError('');
        };

        nextEventSource.addEventListener('message-created', (event) => {
          const realtimeEvent = parseMessageRealtimeEvent((event as MessageEvent).data);
          invalidateNotifications('message-created');
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

        nextEventSource.addEventListener('message-deleted', (event) => {
          const realtimeEvent = parseMessageRealtimeEvent((event as MessageEvent).data);
          removeMessageFromConversation(realtimeEvent.conversationId, realtimeEvent.messageId);
          void loadConversations({ silent: true });
        });

        nextEventSource.addEventListener('connection-replaced', () => {
          replaced = true;
          nextEventSource.close();
          if (eventSource === nextEventSource) {
            eventSource = null;
          }
          if (!cancelled) {
            setStreamReplaced(true);
          }
        });

        nextEventSource.onerror = () => {
          nextEventSource.close();
          if (eventSource === nextEventSource) {
            eventSource = null;
          }

          if (!cancelled && !replaced) {
            scheduleReconnect();
          }
        };
      } catch (error) {
        if (!cancelled) {
          const authError = isAuthError(error);
          if (authError) {
            setPageError(error instanceof Error ? error.message : '실시간 메시지 연결에 실패했습니다.');
          } else {
            scheduleReconnect();
          }
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      eventSource?.close();
    };
  }, [
    isAuthReady,
    loadConversations,
    removeMessageFromConversation,
    user,
  ]);

  // 새 대화만 열고 보내지 않은 빈 대화는 지금 보고 있을 때만 목록에 남긴다.
  // 전송 대기·실패 메시지가 있으면 재시도할 수 있도록 남긴다.
  const listedConversations = useMemo(
    () =>
      conversations.filter(
        (conversation) =>
          conversation.messages.length > 0 ||
          conversation.id === activeConversationId ||
          (pendingByConversation[conversation.id]?.length ?? 0) > 0,
      ),
    [activeConversationId, conversations, pendingByConversation],
  );
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return listedConversations;

    return listedConversations.filter((conversation) =>
      [
        conversation.recipient.name,
        conversation.recipient.handle,
        getLastPreview(conversation),
      ].some((value) => value.toLowerCase().includes(normalized))
    );
  }, [listedConversations, query]);
  const hasHiddenConversations = filteredConversations.length > conversationRenderCount;
  const visibleConversations = useMemo(() => {
    if (!hasHiddenConversations) {
      return filteredConversations;
    }

    const previewConversations = filteredConversations.slice(0, conversationRenderCount);
    const activeConversationInList = filteredConversations.find(
      (conversation) => conversation.id === activeConversationId
    );

    if (
      activeConversationInList === undefined ||
      previewConversations.some((conversation) => conversation.id === activeConversationInList.id)
    ) {
      return previewConversations;
    }

    return [...previewConversations, activeConversationInList];
  }, [activeConversationId, conversationRenderCount, filteredConversations, hasHiddenConversations]);

  useEffect(() => {
    const sentinel = conversationSentinelRef.current;
    if (!sentinel || !hasHiddenConversations) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setConversationRenderCount((count) => count + CONVERSATION_RENDER_STEP);
        }
      },
      { root: conversationListRef.current, rootMargin: '200px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasHiddenConversations, visibleConversations.length]);

  useEffect(() => {
    setConversationRenderCount(CONVERSATION_RENDER_STEP);
  }, [query]);

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
    }
  };

  useEffect(() => {
    if (!requestedConversationId) return;
    if (!conversations.some((conversation) => conversation.id === requestedConversationId)) return;

    setActiveConversationId(requestedConversationId);
    setMobileView('chat');
  }, [conversations, requestedConversationId]);

  useEffect(() => {
    if (
      !isAuthReady ||
      !user ||
      loadingConversations ||
      !requestedRecipientHandle
    ) {
      return;
    }
    if (requestedRecipientRef.current === requestedRecipientHandle) return;

    requestedRecipientRef.current = requestedRecipientHandle;

    const existingConversation = conversations.find(
      (conversation) => conversation.recipient.handle.replace(/^@/, '') === requestedRecipientHandle.replace(/^@/, '')
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

  // 응답이 실패한 뒤 SSE·폴링으로 서버 사본이 확인된 항목은 상태에서도 지워, 서버 메시지가 삭제돼도 다시 나타나지 않게 한다.
  // 요청 중인 항목은 성공 응답을 실제 ID로 병합해야 하므로 렌더에서만 숨기고 남긴다.
  useEffect(() => {
    for (const [conversationId, items] of Object.entries(pendingRef.current)) {
      const visible = hideDeliveredPendingMessages(items, messagesByConversation[conversationId] ?? []);
      const delivered = items.filter((item) => item.status === 'failed' && !visible.includes(item));
      if (delivered.length === 0) continue;

      revokeAttachmentUrls(delivered.flatMap((item) => item.attachments));
      updatePendingMessages(conversationId, (current) => current.filter((item) => !delivered.includes(item)));
    }
  }, [messagesByConversation, revokeAttachmentUrls, updatePendingMessages]);

  const discardPendingMessages = (conversationId: string, pendingId?: string) => {
    const targets = (pendingRef.current[conversationId] ?? []).filter((item) => !pendingId || item.id === pendingId);
    revokeAttachmentUrls(targets.flatMap((item) => item.attachments));
    updatePendingMessages(conversationId, (items) => items.filter((item) => !targets.includes(item)));
  };

  // 대기열로 한 번에 하나씩 보내 연속 전송해도 서버 저장 순서가 보낸 순서와 같도록 한다.
  const enqueuePendingMessage = (conversationId: string, pendingId: string) => {
    sendQueueRef.current = sendQueueRef.current.then(async () => {
      const target = pendingRef.current[conversationId]?.find((item) => item.id === pendingId);
      // 대화방을 나가거나 화면을 떠나 임시 메시지가 사라졌으면 보내지 않는다.
      if (!target || target.status !== 'queued') return;
      if (!isCurrentAuthGeneration(target.authGeneration)) {
        discardPendingMessages(conversationId, pendingId);
        return;
      }

      updatePendingMessages(conversationId, (items) =>
        items.map((item) => (item.id === pendingId ? { ...item, status: 'sending' } : item))
      );

      try {
        const sentMessage = await sendConversationMessage({
          conversationId,
          content: target.text,
          attachments: target.attachments.map((attachment) => attachment.file),
          clientMessageId: target.id,
        });

        if (!pendingRef.current[conversationId]?.some((item) => item.id === pendingId)) return;

        revokeAttachmentUrls(target.attachments);
        updatePendingMessages(conversationId, (items) => items.filter((item) => item.id !== pendingId));
        setMessagesByConversation((current) => ({
          ...current,
          [conversationId]: mergeMessages(current[conversationId] ?? [], [sentMessage]),
        }));
        updateConversationPreviewWithMessage(conversationId, sentMessage);
        void loadConversations({ silent: true });
      } catch (error) {
        // 서버 저장 뒤 응답만 실패했고 SSE·폴링으로 이미 전달이 확인됐다면 실패로 되돌리지 않고 정리한다.
        const sendingItem = pendingRef.current[conversationId]?.find((item) => item.id === pendingId);
        if (
          sendingItem &&
          hideDeliveredPendingMessages([sendingItem], messagesRef.current[conversationId] ?? []).length === 0
        ) {
          discardPendingMessages(conversationId, pendingId);
          return;
        }
        updatePendingMessages(conversationId, (items) =>
          items.map((item) =>
            item.id === pendingId
              ? { ...item, status: 'failed', errorMessage: toUploadErrorMessage(error, '메시지 전송에 실패했습니다.') }
              : item
          )
        );
      }
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeConversation) return;

    const trimmedMessage = message.trim();
    if (preparingImages) return;
    if (!trimmedMessage && attachments.length === 0) return;
    if (message.length > MAX_MESSAGE_LENGTH) return;

    const conversationId = activeConversation.id;
    const pendingMessage: PendingChatMessage = {
      id: createClientId(),
      text: trimmedMessage,
      // 미리보기 URL의 소유권을 임시 메시지로 넘기므로 아래에서 해제하지 않고 비운다.
      attachments,
      status: 'queued',
      errorMessage: null,
      authGeneration: getAuthGeneration(),
    };

    updatePendingMessages(conversationId, (items) => [...items, pendingMessage]);
    setComposerError('');
    setMessage('');
    setAttachments([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    setAttachmentMenuOpen(false);
    enqueuePendingMessage(conversationId, pendingMessage.id);
  };

  const handleRetryPendingMessage = (conversationId: string, pendingId: string) => {
    updatePendingMessages(conversationId, (items) =>
      items.map((item) => (item.id === pendingId ? { ...item, status: 'queued', errorMessage: null } : item))
    );
    enqueuePendingMessage(conversationId, pendingId);
  };

  const handleLoadOlderMessages = async () => {
    if (!activeConversationId || !hasNextMessages || loadingOlderMessages) return;

    await loadMessages(activeConversationId, {
      cursor: nextCursorByConversation[activeConversationId] ?? null,
    });
  };

  // 위로 스크롤해 맨 위에 닿으면 이전 메시지를 불러오고, 보던 위치를 그대로 유지한다.
  const loadOlderMessagesRef = useRef(handleLoadOlderMessages);
  loadOlderMessagesRef.current = handleLoadOlderMessages;
  useEffect(() => {
    const sentinel = olderMessagesSentinelRef.current;
    const container = messageScrollRef.current;
    if (!sentinel || !container || !hasNextMessages) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        const loadingConversationId = activeConversationIdRef.current;
        const previousHeight = container.scrollHeight;
        const previousTop = container.scrollTop;
        void loadOlderMessagesRef.current().then(() => {
          window.requestAnimationFrame(() => {
            // 불러오는 사이 다른 대화로 바뀌었으면 그 대화의 스크롤은 건드리지 않는다.
            if (activeConversationIdRef.current !== loadingConversationId) return;
            container.scrollTop = container.scrollHeight - previousHeight + previousTop;
          });
        });
      },
      { root: container, rootMargin: '120px 0px 0px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeConversationId, hasNextMessages]);

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
      discardPendingMessages(removedConversationId);
      setActiveConversationId('');
      setMobileView('list');
      setHeaderMenuOpen(false);
      setMessageActionId(null);
      setMessageActionLoading(false);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : '대화방 나가기에 실패했습니다.');
      setMessageActionLoading(false);
    }
  };

  const pushDraftAttachments = async (files: File[], type: 'image' | 'video') => {
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

      // 실패 후 같은 파일을 다시 골라도 change 이벤트가 나도록 비운다.
      if (imageInputRef.current) imageInputRef.current.value = '';
      const seq = ++imageSelectionSeqRef.current;
      setPreparingImages(true);
      try {
        // HEIC·회전·고해상도(48MP) 사진을 서버가 받는 JPEG로 맞춘 뒤 크기를 검사한다.
        const converted = await convertImagesForUpload(files.slice(0, 4));
        if (seq !== imageSelectionSeqRef.current) return;

        if (converted.some((file) => file.size > 20 * 1024 * 1024)) {
          setComposerError('이미지 파일은 최대 20MB까지 업로드할 수 있습니다.');
          return;
        }

        // 변환이 성공한 뒤에만 기존 첨부를 바꿔 실패해도 이전 첨부가 남게 한다.
        clearAttachments();
        setAttachments(
          converted.map((file) => ({
            id: createClientId(),
            type: 'image',
            name: file.name,
            file,
            previewUrl: URL.createObjectURL(file),
          }))
        );
      } catch (error) {
        if (seq !== imageSelectionSeqRef.current) return;
        setComposerError(error instanceof Error ? error.message : '이미지를 준비하지 못했습니다.');
      } finally {
        if (seq === imageSelectionSeqRef.current) setPreparingImages(false);
      }
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
        id: createClientId(),
        type: 'video',
        name: video.name,
        file: video,
        previewUrl: URL.createObjectURL(video),
      },
    ]);
  };

  const handleImageSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    void pushDraftAttachments(files, 'image');
    setAttachmentMenuOpen(false);
  };

  const handleVideoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    void pushDraftAttachments(files, 'video');
    setAttachmentMenuOpen(false);
  };

  const handleOpenPost = (postNumber: number) => {
    router.push(getPostHref(postNumber));
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
      <div className="flex h-[calc(100dvh-var(--app-header-height)-var(--tab-bar-height))] items-center justify-center bg-surface">
        <div className="flex items-center gap-3 text-body text-fg-secondary">
          <Loader2 size={18} className="animate-spin" />
          메시지 화면을 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div
      data-message-shell="true"
      data-mobile-chat={mobileView === 'chat' ? '' : undefined}
      data-keyboard-open={viewport?.keyboard ? '' : undefined}
      style={viewport ? { '--dm-viewport-height': `${viewport.height}px`, '--dm-viewport-top': `${viewport.top}px` } as CSSProperties : undefined}
      className="flex h-[calc(100dvh-var(--app-header-height)-var(--tab-bar-height))] overflow-hidden bg-canvas text-fg-primary md:bg-surface lg:my-5 lg:ml-6 lg:h-[calc(100dvh-40px)] lg:rounded-card lg:border lg:border-line-card [&_svg]:stroke-[1.67]">
      <section
        aria-label="대화 목록"
        className={`min-h-0 w-full shrink-0 flex-col md:flex md:w-[280px] md:border-r md:border-line xl:w-[340px] ${
          mobileView === 'chat' ? 'hidden' : 'flex'
        }`}
      >
        <div className="px-4 pb-2 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="text-title">메시지</h1>
              <div className="sr-only">
                <p>
                  대화 {listedConversations.length}개
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowNewChat((current) => !current)}
              className="btn-icon text-icon-primary"
              aria-label="새 대화 시작"
              aria-expanded={showNewChat}
            >
              <SquarePen size={20} />
            </button>
          </div>

          <label className="group relative block">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-tertiary transition-colors group-focus-within:text-fg-primary"
              size={18}
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="대화 또는 사용자 검색"
              aria-label="대화 또는 사용자 검색"
              className="input-base h-10 border-transparent pl-11"
            />
          </label>
        </div>

        <div ref={conversationListRef} className="min-h-0 flex-1 overflow-y-auto pb-4">
          {showNewChat ? (
            <NewChatPicker
              onStart={handleStartConversation}
              onClose={() => setShowNewChat(false)}
            />
          ) : null}

          {streamReplaced ? <StreamReplacedNotice /> : null}

          {pageError ? (
            <div role="alert" className="m-3 rounded-control bg-danger-subtle px-4 py-3 text-label text-fg-danger">
              {pageError}
            </div>
          ) : null}

          {loadingConversations ? (
            <ConversationListSkeleton />
          ) : filteredConversations.length > 0 ? (
            <>
              {visibleConversations.map((conversation) => (
                <ConversationCard
                  key={conversation.id}
                  conversation={conversation}
                  active={conversation.id === activeConversationId}
                  query={query}
                  onSelect={() => handleSelectConversation(conversation.id)}
                />
              ))}

              {hasHiddenConversations ? <div ref={conversationSentinelRef} aria-hidden="true" className="h-px" /> : null}
            </>
          ) : (
            <div role="status" className="p-6 text-center">
              <Inbox className="mx-auto mb-3 text-fg-tertiary" size={28} />
              <p className="text-body text-fg-secondary">{query.trim() ? '검색 결과가 없습니다.' : '시작된 대화가 없습니다.'}</p>
            </div>
          )}
        </div>
      </section>

      <section
        aria-label="메시지 대화"
        className={`min-h-0 min-w-0 flex-1 flex-col md:flex ${
          mobileView === 'list' ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* 모바일 채팅 화면에서는 대화 목록 영역이 숨겨지므로 안내를 여기에도 둔다. */}
        {streamReplaced ? <StreamReplacedNotice className="md:hidden" /> : null}
        {activeConversation ? (
          <>
            <div className="z-10 flex shrink-0 items-center justify-between border-b border-line px-3 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:px-5 md:pt-3">
              <div className="flex min-w-0 items-center gap-3 md:gap-4">
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="btn-icon -ml-2 text-icon-primary md:hidden"
                  aria-label="대화 목록으로 돌아가기"
                >
                  <ArrowLeft size={22} />
                </button>
                <div className="relative">
                  <UserAvatar
                    name={activeConversation.recipient.name}
                    imageUrl={activeConversation.recipient.profileImageUrl}
                    sizes="36px"
                    className="h-9 w-9 rounded-full bg-subtle text-caption text-fg-secondary"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-body font-medium text-fg-primary">
                      {activeConversation.recipient.name}
                    </p>
                    <MembershipBadge active={activeConversation.recipient.membershipBadge} />
                    <RepresentativeTierBadge tier={activeConversation.recipient.representativeTier} />
                  </div>
                  <p
                    className="mt-0.5 flex items-center gap-1.5 text-caption text-fg-tertiary"
                  >
                    {activeConversation.recipient.online ? <><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-fg-success" />접속 중</> : activeConversation.recipient.handle}
                  </p>
                </div>
              </div>

              <div ref={headerMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setHeaderMenuOpen((current) => !current)}
                  className="btn-icon"
                  aria-label="대화방 옵션"
                  aria-expanded={headerMenuOpen}
                >
                  <Ellipsis size={20} />
                </button>
                {headerMenuOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-control border border-line bg-surface p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => void handleLeaveActiveConversation()}
                      disabled={messageActionLoading}
                      className="flex w-full items-center gap-3 rounded-control px-4 py-3 text-left text-label text-fg-danger transition hover:bg-danger-subtle disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      대화방 나가기
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={messageScrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 md:p-5">
              {hasNextMessages ? <div ref={olderMessagesSentinelRef} aria-hidden="true" className="h-px" /> : null}
              {loadingOlderMessages ? (
                <div role="status" className="mb-4 flex items-center justify-center gap-2 text-caption text-fg-tertiary">
                  <Loader2 size={14} className="animate-spin" />
                  이전 메시지 불러오는 중
                </div>
              ) : null}

              {loadingMessages && activeMessages.length === 0 ? (
                <MessageThreadSkeleton />
              ) : activeMessages.length > 0 || activePendingMessages.length > 0 ? (
                <div className="mt-auto shrink-0 space-y-3">
                  {activeMessages.map((chatMessage, index) => {
                    return (
                      <Fragment key={chatMessage.id}>
                        {shouldShowMessageDateSeparator(activeMessages, index) ? (
                          <MessageDateSeparator label={formatMessageDate(chatMessage.createdAt)} />
                        ) : null}
                        <div
                          ref={(element) => {
                            if (element) {
                              messageElementRefs.current.set(chatMessage.id, element);
                            } else {
                              messageElementRefs.current.delete(chatMessage.id);
                            }
                          }}
                          data-message-id={chatMessage.id}
                          className={`rounded-card transition-[box-shadow,background-color] duration-500 ${
                            highlightedMessageId === chatMessage.id
                              ? 'bg-brand-subtle ring-2 ring-line-focus'
                              : ''
                          }`}
                        >
                          <MessageBubble
                            chatMessage={chatMessage}
                            mine={chatMessage.senderId === 'me'}
                            isActionOpen={messageActionId === chatMessage.id}
                            actionLoading={messageActionLoading}
                            onToggleAction={() =>
                              setMessageActionId((current) => (current === chatMessage.id ? null : chatMessage.id))
                            }
                            onDelete={() => void handleDeleteMessage(chatMessage.id)}
                            onOpenPost={handleOpenPost}
                            onOpenImage={handleOpenImage}
                          />
                        </div>
                      </Fragment>
                    );
                  })}
                  {activePendingMessages.map((pendingMessage) => (
                    <PendingMessageBubble
                      key={pendingMessage.id}
                      pendingMessage={pendingMessage}
                      onRetry={() => handleRetryPendingMessage(activeConversation.id, pendingMessage.id)}
                      onDiscard={() => discardPendingMessages(activeConversation.id, pendingMessage.id)}
                      onOpenImage={handleOpenImage}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="mx-auto mb-4 text-fg-tertiary" size={42} />
                    <p className="text-heading text-fg-primary">대화를 시작해보세요.</p>
                    <p className="mt-2 text-body text-fg-tertiary">
                      아직 메시지가 없습니다. 첫 메시지를 보내보세요.
                    </p>
                  </div>
                </div>
              )}
              <div ref={messageEndRef} />
            </div>

            <form data-message-composer="true" onSubmit={handleSubmit} className="shrink-0 border-t border-line p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-3">
              {composerError ? (
                <div role="alert" className="mb-3 flex items-center gap-2 rounded-control bg-danger-subtle px-4 py-3 text-label text-fg-danger">
                  <CircleAlert size={16} className="shrink-0" />
                  <span>{composerError}</span>
                </div>
              ) : null}

              {preparingImages ? (
                <div role="status" className="mb-3 rounded-control bg-subtle px-4 py-3 text-label text-fg-secondary">
                  이미지를 준비하고 있습니다...
                </div>
              ) : null}

              {attachments.length > 0 ? (
                <div className="mx-auto mb-3 flex max-w-4xl flex-wrap gap-3">
                  {attachments.map((attachment) => (
                    <div key={attachment.id} className="relative">
                      <div className="overflow-hidden rounded-control bg-subtle">
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
                          <div className="flex h-20 w-20 items-center justify-center bg-subtle text-icon-primary">
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
                        className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface text-icon-primary ring-1 ring-line transition hover:bg-subtle"
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
                className="relative flex items-center gap-2"
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
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
                  className="btn-secondary-square text-icon-secondary"
                  aria-label="첨부 메뉴"
                  aria-expanded={attachmentMenuOpen}
                >
                  <Plus size={20} />
                </button>
                {attachmentMenuOpen ? (
                  <div className="absolute bottom-full left-0 z-20 mb-3 rounded-control border border-line bg-surface p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex w-44 items-center gap-3 rounded-control px-4 py-3 text-label text-fg-secondary transition hover:bg-subtle hover:text-fg-primary"
                    >
                      <ImagePlus size={18} />
                      사진 추가
                    </button>
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      className="flex w-44 items-center gap-3 rounded-control px-4 py-3 text-label text-fg-secondary transition hover:bg-subtle hover:text-fg-primary"
                    >
                      <Video size={18} />
                      동영상 추가
                    </button>
                    <button
                      type="button"
                      onClick={clearAttachments}
                      className="flex w-44 items-center gap-3 rounded-control px-4 py-3 text-label text-fg-tertiary transition hover:bg-subtle hover:text-fg-primary"
                    >
                      <X size={18} />
                      첨부 지우기
                    </button>
                  </div>
                ) : null}
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={MAX_MESSAGE_LENGTH}
                  enterKeyHint="send"
                  placeholder="메시지 입력"
                  aria-label={`${activeConversation.recipient.name}님에게 메시지 보내기`}
                  className="input-base h-10 min-w-0 flex-1 border-transparent"
                />
                {/* 한도에 가까워질 때만 글자 수를 보여 입력칸을 넓게 쓴다. */}
                {message.length >= MAX_MESSAGE_LENGTH * 0.9 ? (
                  <span
                    className={`shrink-0 text-caption tabular-nums ${
                      message.length >= MAX_MESSAGE_LENGTH ? 'text-fg-danger' : 'text-fg-tertiary'
                    }`}
                  >
                    {message.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                ) : null}
                <button
                  type="submit"
                  disabled={preparingImages || (!message.trim() && attachments.length === 0)}
                  className="btn-primary w-10 px-0"
                  aria-label="메시지 전송"
                >
                  <Send size={20} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <Inbox className="mx-auto mb-4 text-fg-tertiary" size={48} />
              <p className="text-heading text-fg-primary">대화를 선택해 주세요.</p>
            </div>
          </div>
        )}
      </section>
      <ImageLightbox image={expandedImage} onClose={() => setExpandedImage(null)} />
    </div>
  );
}
