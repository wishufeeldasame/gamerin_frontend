import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import type { Conversation } from '@/lib/message-store';
import { formatAbsoluteTime } from '@/lib/time-format';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  messages: vi.fn(),
  recipients: vi.fn(),
  stream: vi.fn(),
  user: { id: 'viewer', handle: 'viewer' },
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, isAuthReady: true }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/message-api', () => ({
  fetchConversationList: mocks.list,
  fetchConversationMessages: mocks.messages,
  searchMessageRecipients: mocks.recipients,
  openMessageEventSource: mocks.stream,
  markConversationRead: vi.fn(),
  createConversation: vi.fn(),
  deleteConversationMessage: vi.fn(),
  fetchMessageAttachmentBlob: vi.fn(),
  leaveConversation: vi.fn(),
  parseMessageRealtimeEvent: vi.fn(),
  sendConversationMessage: vi.fn(),
}));

import MessagesPage from '../page';

const conversation: Conversation = {
  id: 'conversation-1',
  recipient: { id: 'recipient-1', name: '대화상대', handle: '@MixedCase', role: 'USER', online: false },
  messages: [],
  unreadCount: 0,
  updatedAt: '2026-10-06T15:05:00+09:00',
};

function createEventSource() {
  return { addEventListener: vi.fn(), close: vi.fn() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('메시지 화면 표시와 기존 검색', () => {
  beforeEach(() => {
    mocks.user = { id: 'viewer', handle: 'viewer' };
    vi.useRealTimers();
    mocks.list.mockResolvedValue([conversation]);
    mocks.messages.mockResolvedValue({ items: [], nextCursor: null, hasNext: false });
    mocks.recipients.mockResolvedValue([conversation.recipient]);
    mocks.stream.mockResolvedValue(createEventSource());
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('목록과 오프라인 헤더에 USER 대신 기존 핸들을 그대로 표시한다', async () => {
    render(<MessagesPage />);
    const card = await screen.findByRole('button', { name: /대화상대/ });
    expect(within(card).getByText('@MixedCase')).not.toHaveClass('uppercase');
    expect(screen.queryByText('USER')).not.toBeInTheDocument();
    const time = card.querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-10-06T06:05:00.000Z');
    expect(time).toHaveAttribute('title', formatAbsoluteTime(new Date(conversation.updatedAt)));
    fireEvent.click(card);
    await waitFor(() => expect(screen.getAllByText('@MixedCase')).toHaveLength(2));
    expect(screen.queryByText('USER')).not.toBeInTheDocument();
    expect(screen.queryByText('접속 중')).not.toBeInTheDocument();
  });

  it('목록 검색에서 화면에 보이지 않는 role은 제외한다', async () => {
    render(<MessagesPage />);
    await screen.findByRole('button', { name: /대화상대/ });
    const search = screen.getByPlaceholderText('대화 또는 사용자 검색');

    for (const query of ['USER', 'user', '  UsEr  ']) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.queryByRole('button', { name: /대화상대/ })).not.toBeInTheDocument();
    }

    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('button', { name: /대화상대/ })).toBeInTheDocument();
  });

  it('이름과 핸들 검색, 대소문자 무시와 검색어 공백 처리를 유지한다', async () => {
    render(<MessagesPage />);
    await screen.findByRole('button', { name: /대화상대/ });
    const search = screen.getByPlaceholderText('대화 또는 사용자 검색');

    fireEvent.change(search, { target: { value: 'not-matching' } });
    expect(screen.queryByRole('button', { name: /대화상대/ })).not.toBeInTheDocument();

    for (const query of ['대화상대', 'mixedcase', '  MIXEDCASE  ', '   ']) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByRole('button', { name: /대화상대/ })).toBeInTheDocument();
    }
  });

  it.each([
    {
      target: '이름',
      matchingConversation: {
        ...conversation,
        recipient: { ...conversation.recipient, name: 'USER팀' },
      },
    },
    {
      target: '핸들',
      matchingConversation: {
        ...conversation,
        recipient: { ...conversation.recipient, handle: '@user123' },
      },
    },
    {
      target: '마지막 메시지',
      matchingConversation: {
        ...conversation,
        messages: [{
          id: 'message-1', senderId: 'recipient-1', text: 'USER 설정 확인했어요',
          createdAt: conversation.updatedAt, read: true, deliveryStatus: 'sent' as const,
          attachments: [], sharedPost: null,
        }],
      },
    },
  ])('$target에 실제 USER가 있으면 검색된다', async ({ matchingConversation }) => {
    mocks.list.mockResolvedValue([matchingConversation]);
    render(<MessagesPage />);
    const card = await screen.findByRole('button', { name: new RegExp(matchingConversation.recipient.name) });
    const search = screen.getByPlaceholderText('대화 또는 사용자 검색');

    for (const query of ['USER', 'user', '  UsEr  ']) {
      fireEvent.change(search, { target: { value: query } });
      expect(card).toBeInTheDocument();
    }
  });

  it('새 대화 선택에서도 핸들만 표시하고 role은 숨긴다', async () => {
    render(<MessagesPage />);
    await screen.findByRole('button', { name: /대화상대/ });
    fireEvent.click(screen.getByRole('button', { name: '새 대화 시작' }));
    fireEvent.change(screen.getByPlaceholderText('이름 또는 핸들 검색'), { target: { value: 'Mixed' } });
    await waitFor(() => expect(mocks.recipients).toHaveBeenCalledWith('Mixed', 12));
    await waitFor(() => expect(screen.getAllByText('@MixedCase')).toHaveLength(2));
    expect(screen.queryByText('USER')).not.toBeInTheDocument();
  });

  it('원래 없는 @를 붙이거나 핸들의 대소문자를 바꾸지 않는다', async () => {
    mocks.list.mockResolvedValue([{ ...conversation, recipient: { ...conversation.recipient, handle: 'plainHandle' } }]);
    render(<MessagesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /대화상대/ }));
    await waitFor(() => expect(screen.getAllByText('plainHandle')).toHaveLength(2));
    expect(screen.queryByText('@plainHandle')).not.toBeInTheDocument();
  });

  it('온라인 헤더는 접속 중으로 표시한다', async () => {
    mocks.list.mockResolvedValue([{ ...conversation, recipient: { ...conversation.recipient, online: true } }]);
    render(<MessagesPage />);
    fireEvent.click(await screen.findByRole('button', { name: /대화상대/ }));
    expect(await screen.findByText('접속 중')).toBeInTheDocument();
    expect(screen.queryByText('Online now')).not.toBeInTheDocument();
  });
});

describe('메시지 화면 실시간 연결과 폴링 복구', () => {
  beforeEach(() => {
    mocks.user = { id: 'viewer', handle: 'viewer' };
    mocks.list.mockResolvedValue([conversation]);
    mocks.messages.mockResolvedValue({ items: [], nextCursor: null, hasNext: false });
    mocks.recipients.mockResolvedValue([conversation.recipient]);
    mocks.stream.mockResolvedValue(createEventSource());
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    new ApiError('authentication required', 401),
    new ApiError('account blocked', 403, 'blocked'),
  ])('인증 오류(%s)에서는 SSE 재연결 없이 안내한다', async (error) => {
    vi.useFakeTimers();
    mocks.stream.mockRejectedValue(error);

    render(<MessagesPage />);

    await flushAsyncWork();
    expect(screen.getByText(error.message)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(mocks.stream).toHaveBeenCalledTimes(1);
  });

  it.each([
    new ApiError('forbidden', 403, 'http'),
    new ApiError('server error', 500, 'http'),
    new ApiError('too many requests', 429, 'http'),
    new ApiError('network unavailable', 0, 'unavailable'),
    new Error('unexpected failure'),
  ])('재시도 가능한 SSE 오류(%s)는 2초 뒤 다시 연결한다', async (error) => {
    vi.useFakeTimers();
    mocks.stream.mockRejectedValueOnce(error).mockResolvedValueOnce(createEventSource());

    render(<MessagesPage />);

    await flushAsyncWork();
    expect(mocks.stream).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(mocks.stream).toHaveBeenCalledTimes(2);
  });

  it('5초 폴링 실패 뒤에도 같은 대화를 재조회하고 성공 시 오류를 지운다', async () => {
    vi.useFakeTimers();
    mocks.messages
      .mockResolvedValueOnce({ items: [], nextCursor: null, hasNext: false })
      .mockRejectedValueOnce(new Error('polling failed'))
      .mockResolvedValueOnce({
        items: [{
          id: 'recovered-message',
          senderId: 'recipient-1',
          text: 'polling recovered',
          createdAt: conversation.updatedAt,
          read: true,
          deliveryStatus: 'sent' as const,
          attachments: [],
          sharedPost: null,
        }],
        nextCursor: null,
        hasNext: false,
      });

    render(<MessagesPage />);
    await flushAsyncWork();
    fireEvent.click(screen.getByRole('button', { name: /대화상대/ }));
    await flushAsyncWork();
    expect(mocks.messages).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText('polling failed')).toBeInTheDocument();
    expect(mocks.messages).toHaveBeenLastCalledWith('conversation-1', undefined, 30);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(screen.getByText('polling recovered')).toBeInTheDocument();
    expect(screen.queryByText('polling failed')).not.toBeInTheDocument();
    expect(mocks.messages).toHaveBeenCalledTimes(3);
  });

  it('같은 내용의 5초 폴링 응답으로는 맨 아래로 다시 스크롤하지 않는다', async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
    mocks.messages.mockResolvedValue({
      items: [{
        id: 'message-1',
        senderId: 'recipient-1',
        text: 'same message',
        createdAt: conversation.updatedAt,
        read: true,
        deliveryStatus: 'sent' as const,
        attachments: [],
        sharedPost: null,
      }],
      nextCursor: null,
      hasNext: false,
    });
    const endScrollCount = () =>
      scrollIntoView.mock.calls.filter(([options]) => options?.block === 'end').length;

    render(<MessagesPage />);
    await flushAsyncWork();
    fireEvent.click(screen.getByRole('button', { name: /대화상대/ }));
    await flushAsyncWork();
    expect(screen.getByText('same message')).toBeInTheDocument();
    const initialCount = endScrollCount();
    expect(initialCount).toBeGreaterThan(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(mocks.messages.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(endScrollCount()).toBe(initialCount);
  });

  it('사용자 전환 후 늦게 완료된 이전 SSE 연결은 닫는다', async () => {
    const pendingStream = deferred<ReturnType<typeof createEventSource>>();
    const staleEventSource = createEventSource();
    mocks.stream.mockReturnValueOnce(pendingStream.promise).mockResolvedValueOnce(createEventSource());

    const { rerender } = render(<MessagesPage />);
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(1));

    mocks.user = { id: 'next-viewer', handle: 'next-viewer' };
    rerender(<MessagesPage />);
    await waitFor(() => expect(mocks.stream).toHaveBeenCalledTimes(2));

    pendingStream.resolve(staleEventSource);
    await waitFor(() => expect(staleEventSource.close).toHaveBeenCalledTimes(1));
  });
});
