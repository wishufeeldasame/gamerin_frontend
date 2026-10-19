import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, MODERATION_REJECTED_MESSAGE } from '@/lib/api-client';
import { removeAccessToken } from '@/lib/auth-store';
import type { ChatMessage, Conversation } from '@/lib/message-store';
import MessagesPage from '../page';

const api = vi.hoisted(() => ({
  createConversation: vi.fn(),
  deleteConversationMessage: vi.fn(),
  fetchMessageAttachmentBlob: vi.fn(),
  fetchConversationList: vi.fn(),
  fetchConversationMessages: vi.fn(),
  leaveConversation: vi.fn(),
  markConversationRead: vi.fn(),
  openMessageEventSource: vi.fn(),
  parseMessageRealtimeEvent: (raw: string) => JSON.parse(raw),
  searchMessageRecipients: vi.fn(),
  sendConversationMessage: vi.fn(),
}));

vi.mock('@/lib/message-api', () => api);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams('conversationId=conv-1'),
}));

const auth = vi.hoisted(() => ({ user: { id: 'me', nickname: '나' }, isAuthReady: true }));

vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('@/lib/notification-sync', () => ({
  invalidateNotifications: vi.fn(),
}));

type Listener = (event: { data: string }) => void;

const conversation: Conversation = {
  id: 'conv-1',
  recipient: { id: 'user-2', name: '상대', handle: 'other', role: '', online: false },
  messages: [],
  unreadCount: 0,
  updatedAt: '2026-10-05T12:00:00.000Z',
};

let streamListeners: Record<string, Listener>;
let objectUrlCount = 0;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function serverMessage(id: string, text: string, createdAt: string, clientMessageId: string | null = null): ChatMessage {
  return {
    id,
    senderId: 'me',
    text,
    createdAt,
    read: false,
    deliveryStatus: 'sent',
    attachments: [],
    sharedPost: null,
    clientMessageId,
  };
}

// 화면이 n번째 전송 요청에 붙인 clientMessageId. 서버 사본은 이 값을 돌려준다.
function sentClientMessageId(call = 0): string {
  return api.sendConversationMessage.mock.calls[call][0].clientMessageId;
}

async function renderPage() {
  const view = render(<MessagesPage />);
  const input = await screen.findByPlaceholderText('상대님에게 메시지 보내기');
  return { ...view, input };
}

function send(input: HTMLElement, text: string) {
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: '메시지 전송' }));
}

describe('MessagesPage 낙관적 전송', () => {
  beforeEach(() => {
    objectUrlCount = 0;
    streamListeners = {};
    Object.values(api).forEach((fn) => {
      if (vi.isMockFunction(fn)) fn.mockReset();
    });
    api.fetchConversationList.mockResolvedValue([conversation]);
    api.fetchConversationMessages.mockResolvedValue({ items: [], nextCursor: null, hasNext: false });
    api.openMessageEventSource.mockResolvedValue({
      addEventListener: (type: string, listener: Listener) => {
        streamListeners[type] = listener;
      },
      close: vi.fn(),
    });
    Element.prototype.scrollIntoView = vi.fn();
    URL.createObjectURL = vi.fn(() => `blob:dm-${++objectUrlCount}`);
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('보내는 즉시 임시 메시지를 보여주고 연속 전송은 순서대로 하나씩 보낸다', async () => {
    const first = deferred<ChatMessage>();
    const second = deferred<ChatMessage>();
    api.sendConversationMessage.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { input } = await renderPage();

    send(input, '첫째');
    expect(input).toHaveValue('');
    expect(screen.getByText('첫째')).toBeInTheDocument();
    expect(screen.getByText('전송 중...')).toBeInTheDocument();

    send(input, '둘째');
    expect(screen.getByText('둘째')).toBeInTheDocument();
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(1));
    expect(api.sendConversationMessage).toHaveBeenLastCalledWith(expect.objectContaining({ content: '첫째' }));

    await act(async () => first.resolve(serverMessage('m-1', '첫째', '2026-10-05T12:01:00.000Z')));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(2));
    expect(api.sendConversationMessage).toHaveBeenLastCalledWith(expect.objectContaining({ content: '둘째' }));

    await act(async () => second.resolve(serverMessage('m-2', '둘째', '2026-10-05T12:01:01.000Z')));
    expect(screen.queryByText('전송 중...')).not.toBeInTheDocument();
    expect(screen.getAllByText('첫째')).toHaveLength(1);
    expect(screen.getAllByText('둘째')).toHaveLength(1);
  });

  it('SSE로 같은 메시지가 응답보다 먼저 와도 한 번만 표시한다', async () => {
    const request = deferred<ChatMessage>();
    api.sendConversationMessage.mockReturnValueOnce(request.promise);
    const { input } = await renderPage();
    await waitFor(() => expect(streamListeners['message-created']).toBeDefined());

    send(input, '안녕');
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(1));

    const delivered = serverMessage('m-1', '안녕', '2026-10-05T12:01:00.000Z', sentClientMessageId());
    act(() => {
      streamListeners['message-created']({
        data: JSON.stringify({ type: 'message-created', conversationId: 'conv-1', message: delivered, messageId: 'm-1' }),
      });
    });
    expect(screen.getAllByText('안녕')).toHaveLength(1);
    expect(screen.queryByText('전송 중...')).not.toBeInTheDocument();

    await act(async () => request.resolve(delivered));
    expect(screen.getAllByText('안녕')).toHaveLength(1);
  });

  it('검열 거부는 정책 위반 문구와 재시도를 남기고 재시도는 같은 내용과 clientMessageId로 다시 보낸다', async () => {
    api.sendConversationMessage
      .mockRejectedValueOnce(new ApiError('Content violates moderation policy: harassment', 422))
      .mockResolvedValueOnce(serverMessage('m-1', '다시', '2026-10-05T12:01:00.000Z'));
    const { input } = await renderPage();

    send(input, '다시');

    expect(await screen.findByText(`전송 실패 · ${MODERATION_REJECTED_MESSAGE}`)).toBeInTheDocument();
    expect(screen.getByText('다시')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '재시도' }));

    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(2));
    expect(api.sendConversationMessage).toHaveBeenLastCalledWith(expect.objectContaining({ content: '다시' }));
    expect(sentClientMessageId(0)).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(sentClientMessageId(1)).toBe(sentClientMessageId(0));
    await waitFor(() => expect(screen.queryByRole('button', { name: '재시도' })).not.toBeInTheDocument());
    expect(screen.getAllByText('다시')).toHaveLength(1);
  });

  it('실패한 메시지를 삭제하면 목록에서 빼고 첨부 미리보기 URL을 해제한다', async () => {
    api.sendConversationMessage.mockRejectedValueOnce(new ApiError('서버 오류', 500));
    const { container } = await renderPage();
    const imageInput = container.querySelector('input[type="file"][multiple]') as HTMLInputElement;

    fireEvent.change(imageInput, { target: { files: [new File(['a'], 'shot.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: '메시지 전송' }));

    expect(await screen.findByText('전송 실패 · 서버 오류')).toBeInTheDocument();
    expect(screen.getByAltText('shot.png')).toHaveAttribute('src', 'blob:dm-1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(screen.queryByAltText('shot.png')).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dm-1');
  });

  it('성공하면 첨부 미리보기 URL을 해제하고 전송 중에 언마운트해도 해제한다', async () => {
    const request = deferred<ChatMessage>();
    api.sendConversationMessage.mockResolvedValueOnce(serverMessage('m-1', '', '2026-10-05T12:01:00.000Z'));
    api.sendConversationMessage.mockReturnValueOnce(request.promise);
    const { container, unmount } = await renderPage();
    const imageInput = container.querySelector('input[type="file"][multiple]') as HTMLInputElement;

    fireEvent.change(imageInput, { target: { files: [new File(['a'], 'a.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: '메시지 전송' }));
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dm-1'));

    fireEvent.change(imageInput, { target: { files: [new File(['b'], 'b.png', { type: 'image/png' })] } });
    fireEvent.click(screen.getByRole('button', { name: '메시지 전송' }));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(2));

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:dm-2');
  });

  it('로그아웃·사용자 전환으로 인증 세대가 바뀌면 대기 중인 메시지를 보내지 않는다', async () => {
    const first = deferred<ChatMessage>();
    api.sendConversationMessage.mockReturnValueOnce(first.promise);
    const { input } = await renderPage();

    send(input, '첫째');
    send(input, '둘째');
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(1));

    removeAccessToken();
    await act(async () => first.reject(new DOMException('사용자가 변경되어 요청이 취소되었습니다.', 'AbortError')));

    expect(api.sendConversationMessage).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('둘째')).not.toBeInTheDocument();
  });

  it('실패한 임시 메시지가 남아 있어도 새 수신 메시지가 오면 맨 아래로 스크롤한다', async () => {
    api.sendConversationMessage.mockRejectedValueOnce(new ApiError('서버 오류', 500));
    const { input } = await renderPage();
    await waitFor(() => expect(streamListeners['message-created']).toBeDefined());

    send(input, '실패');
    await screen.findByText('전송 실패 · 서버 오류');
    const scrollCalls = vi.mocked(Element.prototype.scrollIntoView).mock.calls.length;

    const incoming = { ...serverMessage('m-9', '상대 메시지', '2026-10-05T12:02:00.000Z'), senderId: 'user-2' };
    act(() => {
      streamListeners['message-created']({
        data: JSON.stringify({ type: 'message-created', conversationId: 'conv-1', message: incoming, messageId: 'm-9' }),
      });
    });

    expect(await screen.findByText('상대 메시지')).toBeInTheDocument();
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.calls.length).toBeGreaterThan(scrollCalls);
  });

  it('SSE로 전달이 확인된 뒤 응답만 실패하면 실패 말풍선을 띄우지 않는다', async () => {
    const request = deferred<ChatMessage>();
    api.sendConversationMessage.mockReturnValueOnce(request.promise);
    const { input } = await renderPage();
    await waitFor(() => expect(streamListeners['message-created']).toBeDefined());

    send(input, '전달됨');
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(1));

    const delivered = serverMessage('m-1', '전달됨', '2026-10-05T12:01:00.000Z', sentClientMessageId());
    act(() => {
      streamListeners['message-created']({
        data: JSON.stringify({ type: 'message-created', conversationId: 'conv-1', message: delivered, messageId: 'm-1' }),
      });
    });
    await act(async () => request.reject(new ApiError('메시지 요청을 처리하지 못했습니다.', 0, 'unavailable')));

    expect(screen.queryByRole('button', { name: '재시도' })).not.toBeInTheDocument();
    expect(screen.getAllByText('전달됨')).toHaveLength(1);
  });

  it('응답이 먼저 실패하고 SSE로 서버 사본이 늦게 오면 실패 말풍선을 정리한다', async () => {
    api.sendConversationMessage.mockRejectedValueOnce(new ApiError('메시지 요청을 처리하지 못했습니다.', 0, 'unavailable'));
    const { input } = await renderPage();
    await waitFor(() => expect(streamListeners['message-created']).toBeDefined());

    send(input, '늦게 전달');
    expect(await screen.findByRole('button', { name: '재시도' })).toBeInTheDocument();

    const delivered = serverMessage('m-1', '늦게 전달', '2026-10-05T12:01:00.000Z', sentClientMessageId());
    act(() => {
      streamListeners['message-created']({
        data: JSON.stringify({ type: 'message-created', conversationId: 'conv-1', message: delivered, messageId: 'm-1' }),
      });
    });

    expect(screen.queryByRole('button', { name: '재시도' })).not.toBeInTheDocument();
    expect(screen.getAllByText('늦게 전달')).toHaveLength(1);

    // 서버 메시지가 삭제돼도 정리된 실패 말풍선이 되살아나지 않는다.
    act(() => {
      streamListeners['message-deleted']({
        data: JSON.stringify({ type: 'message-deleted', conversationId: 'conv-1', message: null, messageId: 'm-1' }),
      });
    });
    expect(screen.queryByText('늦게 전달')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '재시도' })).not.toBeInTheDocument();
  });

  it('실패 뒤 같은 내용을 새로 보내 성공해도 이전 실패 항목은 남긴다', async () => {
    api.sendConversationMessage
      .mockRejectedValueOnce(new ApiError('서버 오류', 500))
      .mockResolvedValueOnce(serverMessage('m-2', '같은 내용', '2026-10-05T12:02:00.000Z'));
    const { input } = await renderPage();

    send(input, '같은 내용');
    expect(await screen.findByRole('button', { name: '재시도' })).toBeInTheDocument();

    send(input, '같은 내용');
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText('전송 중...')).not.toBeInTheDocument());

    expect(screen.getByRole('button', { name: '재시도' })).toBeInTheDocument();
    expect(screen.getAllByText('같은 내용')).toHaveLength(2);
    expect(sentClientMessageId(1)).not.toBe(sentClientMessageId(0));
  });

  it('재시도 중 원래 요청의 SSE가 늦게 오고 서버가 같은 메시지를 돌려주면 한 번만 표시한다', async () => {
    const retry = deferred<ChatMessage>();
    api.sendConversationMessage.mockRejectedValueOnce(new ApiError('메시지 요청을 처리하지 못했습니다.', 0, 'unavailable')).mockReturnValueOnce(retry.promise);
    const { input } = await renderPage();
    await waitFor(() => expect(streamListeners['message-created']).toBeDefined());

    send(input, '두 번 저장');
    fireEvent.click(await screen.findByRole('button', { name: '재시도' }));
    await waitFor(() => expect(api.sendConversationMessage).toHaveBeenCalledTimes(2));

    expect(sentClientMessageId(1)).toBe(sentClientMessageId(0));
    const original = serverMessage('m-1', '두 번 저장', '2026-10-05T12:01:00.000Z', sentClientMessageId());
    act(() => {
      streamListeners['message-created']({
        data: JSON.stringify({ type: 'message-created', conversationId: 'conv-1', message: original, messageId: 'm-1' }),
      });
    });
    await act(async () => retry.resolve(original));

    expect(screen.getAllByText('두 번 저장')).toHaveLength(1);
    expect(screen.queryByText('전송 중...')).not.toBeInTheDocument();
  });

  it('저장 여부를 모르는 실패 항목도 다른 탭에서 보낸 같은 내용의 메시지로는 숨기지 않는다', async () => {
    api.sendConversationMessage.mockRejectedValueOnce(new ApiError('메시지 요청을 처리하지 못했습니다.', 0, 'unavailable'));
    const { input } = await renderPage();
    await waitFor(() => expect(streamListeners['message-created']).toBeDefined());

    send(input, '다른 탭과 같은 내용');
    expect(await screen.findByRole('button', { name: '재시도' })).toBeInTheDocument();

    const otherTab = serverMessage('m-7', '다른 탭과 같은 내용', '2026-10-05T12:01:00.000Z', crypto.randomUUID());
    act(() => {
      streamListeners['message-created']({
        data: JSON.stringify({ type: 'message-created', conversationId: 'conv-1', message: otherTab, messageId: 'm-7' }),
      });
    });

    expect(screen.getByRole('button', { name: '재시도' })).toBeInTheDocument();
    expect(screen.getAllByText('다른 탭과 같은 내용')).toHaveLength(2);
  });
});
