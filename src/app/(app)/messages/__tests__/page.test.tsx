import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  isMessageAuthError: () => false,
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

describe('메시지 화면 표시와 기존 검색', () => {
  beforeEach(() => {
    mocks.list.mockResolvedValue([conversation]);
    mocks.messages.mockResolvedValue({ items: [], nextCursor: null, hasNext: false });
    mocks.recipients.mockResolvedValue([conversation.recipient]);
    mocks.stream.mockResolvedValue({ addEventListener: vi.fn(), close: vi.fn() });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
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
