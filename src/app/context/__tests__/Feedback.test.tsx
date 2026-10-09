import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useLayoutEffect, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmProvider, useConfirm, type ConfirmOptions } from '../ConfirmContext';
import { ToastProvider, useToast } from '../ToastContext';
import { installDialogMock } from '@/test/feedback';

let toast: ReturnType<typeof useToast>;
let confirm: ReturnType<typeof useConfirm>;
let autoVisible = true;
const visibilityObservers: MockVisibilityObserver[] = [];
class MockVisibilityObserver implements IntersectionObserver {
  readonly root: Element | Document | null;
  readonly rootMargin = '0px';
  readonly thresholds = [1];
  private target: Element | null = null;
  constructor(private readonly callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.root = options?.root ?? null;
    visibilityObservers.push(this);
  }
  observe = vi.fn((target: Element) => {
    this.target = target;
    if (autoVisible) this.emit(1);
  });
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = () => [];
  emit(ratio: number) {
    if (!this.target) return;
    const rect = this.target.getBoundingClientRect();
    this.callback([{
      boundingClientRect: rect, intersectionRect: rect, intersectionRatio: ratio,
      isIntersecting: ratio > 0, rootBounds: null, target: this.target, time: 0,
    }], this);
  }
}
function Consumer({ scope }: { scope?: string }) {
  const currentToast = useToast();
  const currentConfirm = useConfirm(scope);
  useLayoutEffect(() => { toast = currentToast; confirm = currentConfirm; });
  return <main><button>호출 버튼</button></main>;
}
function Tree({ scope = 'one', ownerScope, show = true }: { scope?: string; ownerScope?: string; show?: boolean }) {
  return <ConfirmProvider scopeKey={scope}><ToastProvider>{show && <Consumer scope={ownerScope} />}</ToastProvider></ConfirmProvider>;
}
function ask(options: ConfirmOptions = { message: '삭제할까요?', danger: true }) {
  let promise!: Promise<boolean>;
  act(() => { promise = confirm(options); });
  return promise;
}
function advance(ms: number) { act(() => { vi.advanceTimersByTime(ms); }); }

beforeEach(() => {
  installDialogMock();
  autoVisible = true;
  visibilityObservers.length = 0;
  vi.stubGlobal('IntersectionObserver', MockVisibilityObserver);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('공통 토스트', () => {
  it('오류는 alert, 성공·안내는 polite status이며 4/6초 후 닫힌다', () => {
    vi.useFakeTimers();
    render(<Tree />);
    act(() => { toast.error('실패'); toast.success('완료'); toast.info('안내'); });
    expect(screen.getByRole('alert')).toHaveTextContent('실패');
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getAllByRole('status')[0]).toHaveAttribute('aria-live', 'polite');
    advance(3999);
    expect(screen.getAllByRole('status')).toHaveLength(2);
    advance(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    advance(1999);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('hover와 focus가 겹쳐도 모두 끝날 때만 남은 시간을 재개한다', () => {
    vi.useFakeTimers();
    render(<Tree />);
    act(() => toast.info('읽는 중'));
    advance(1000);
    const item = screen.getByRole('status');
    fireEvent.mouseEnter(item);
    const close = within(item).getByRole('button', { name: '알림 닫기' });
    act(() => close.focus());
    advance(8000);
    fireEvent.mouseLeave(item);
    advance(8000);
    expect(item).toBeInTheDocument();
    act(() => close.blur());
    advance(2999);
    expect(item).toBeInTheDocument();
    advance(1);
    expect(item).not.toBeInTheDocument();
  });
  it('동일 알림을 합치고 최대 3개, 초과는 FIFO로 표시하며 대기 시간은 차감하지 않는다', () => {
    vi.useFakeTimers();
    render(<Tree />);
    act(() => { ['1','2','3','4','4','5'].forEach(toast.info); });
    expect(screen.getAllByRole('status')).toHaveLength(3);
    expect(screen.queryByText('4')).not.toBeInTheDocument();
    advance(3000);
    fireEvent.click(screen.getAllByRole('button', { name: '알림 닫기' })[0]);
    expect(screen.getByText('4')).toBeInTheDocument();
    advance(1000);
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    advance(2999);
    expect(screen.getByText('4')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByText('4')).not.toBeInTheDocument();
  });
  it('Provider 변경에도 toast 함수 참조는 유지되며 해제 시 타이머가 정리된다', () => {
    vi.useFakeTimers();
    const view = render(<Tree />);
    const original = toast;
    act(() => toast.error('오류'));
    view.rerender(<Tree ownerScope='changed' />);
    expect(toast).toBe(original);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(visibilityObservers[0].disconnect).toHaveBeenCalledOnce();
  });
  it('가려진 알림은 처음 표시될 때까지 대기하고 다시 가려지면 남은 시간을 멈춘다', () => {
    vi.useFakeTimers();
    autoVisible = false;
    render(<Tree />);
    act(() => { toast.error('긴 오류 1'); toast.error('긴 오류 2'); });
    const first = screen.getByText('긴 오류 1').closest('[role=alert]')!;
    const observer = visibilityObservers[0];
    expect(observer.root).toBe(first.parentElement);
    advance(10000);
    expect(first).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    act(() => observer.emit(1));
    advance(1000);
    act(() => observer.emit(0.99));
    advance(10000);
    expect(first).toBeInTheDocument();
    act(() => observer.emit(1));
    advance(4999);
    expect(first).toBeInTheDocument();
    advance(1);
    expect(first).not.toBeInTheDocument();
    expect(screen.getByText('긴 오류 2')).toBeInTheDocument();
  });
  it('가시성 API가 없으면 자동으로 사라지지 않고 수동으로 닫을 수 있다', () => {
    vi.useFakeTimers();
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Tree />);
    act(() => toast.info('안내'));
    advance(10000);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('확인창이 열려 있으면 토스트 타이머를 멈춘다', async () => {
    vi.useFakeTimers();
    render(<Tree />);
    act(() => toast.info('안내'));
    advance(1000);
    const promise = ask();
    advance(10000);
    expect(screen.getByRole('status')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await expect(promise).resolves.toBe(false);
    advance(2999);
    expect(screen.getByRole('status')).toBeInTheDocument();
    advance(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Promise 확인창', () => {
  it('취소에 초기 포커스를 두고 확인 후 true와 명시적 포커스 복원을 제공한다', async () => {
    render(<Tree />);
    const trigger = screen.getByRole('button', { name: '호출 버튼' });
    trigger.focus();
    const promise = ask({ message: '삭제할까요?', danger: true, confirmLabel: '삭제', returnFocusTo: trigger });
    const dialog = screen.getByRole('alertdialog', { name: '작업 확인' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('삭제할까요?');
    expect(screen.getByRole('button', { name: '취소' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));
    await expect(promise).resolves.toBe(true);
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });
  it('취소·Esc는 false이며 이중 cancel로 다음 요청을 닫지 않는다', async () => {
    render(<Tree />);
    const first = ask();
    const dialog = screen.getByRole('alertdialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await expect(first).resolves.toBe(false);
    const second = ask({ message: '다음 작업', cancelLabel: '돌아가기' });
    fireEvent.click(screen.getByRole('button', { name: '돌아가기' }));
    await expect(second).resolves.toBe(false);
  });
  it('확인 대기 중 다른 호출은 false로 거절하고 기존 대상은 유지한다', async () => {
    render(<Tree />);
    const first = ask();
    const duplicate = ask({ message: '다른 대상' });
    await expect(duplicate).resolves.toBe(false);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('삭제할까요?');
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await expect(first).resolves.toBe(true);
  });
  it.each(['route', 'ownerScope', 'owner', 'provider'])('%s 변경·해제 시 대기 요청을 취소한다', async (kind) => {
    const view = render(<Tree ownerScope='a' />);
    const promise = ask();
    if (kind === 'provider') view.unmount();
    else if (kind === 'route') view.rerender(<Tree scope='two' ownerScope='a' />);
    else if (kind === 'ownerScope') view.rerender(<Tree ownerScope='b' />);
    else view.rerender(<Tree show={false} />);
    await expect(promise).resolves.toBe(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });
  it('복원 요소가 없어졌으면 본문에 포커스를 돌린다', async () => {
    render(<Tree />);
    const removed = document.createElement('button');
    const promise = ask({ message: '확인', returnFocusTo: removed });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    await expect(promise).resolves.toBe(false);
    expect(screen.getByRole('main')).toHaveFocus();
    expect(screen.getByRole('main')).not.toHaveAttribute('tabindex');
  });
  it('StrictMode에서도 확인은 정상 동작하고 모달을 열 수 없으면 false로 종료한다', async () => {
    render(<StrictMode><Tree /></StrictMode>);
    const first = ask();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));
    await expect(first).resolves.toBe(true);
    vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => { throw new Error('not supported'); });
    await expect(ask()).resolves.toBe(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
