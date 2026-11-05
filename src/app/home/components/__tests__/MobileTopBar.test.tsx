import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDialogMock } from '@/test/feedback';

const mocks = vi.hoisted(() => ({
  pathname: '/home',
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));

import { MobileTopBar } from '../MobileTopBar';

describe('MobileTopBar', () => {
  beforeEach(() => {
    installDialogMock();
    mocks.pathname = '/home';
    mocks.push.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('links the bell to the notifications page with the unread count in its name', () => {
    const view = render(<MobileTopBar unreadCount={3} />);
    expect(screen.getByRole('link', { name: '알림, 읽지 않은 알림 3개' })).toHaveAttribute('href', '/notifications');

    view.rerender(<MobileTopBar unreadCount={0} />);
    expect(screen.getByRole('link', { name: '알림' })).toBeInTheDocument();
  });

  it('hides the search button on the search page', () => {
    mocks.pathname = '/search';
    render(<MobileTopBar unreadCount={0} />);
    expect(screen.queryByRole('button', { name: '검색 열기' })).not.toBeInTheDocument();
  });

  it('opens a full-screen search, focuses it, and closes it after searching', () => {
    render(<MobileTopBar unreadCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));

    const input = screen.getByRole('textbox', { name: '통합 검색' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: ' 발로란트 ' } });
    expect(screen.getByRole('button', { name: /‘발로란트’ 전체 결과 보기/ })).toBeInTheDocument();
    fireEvent.submit(input);

    expect(mocks.push).toHaveBeenCalledWith('/search?q=%EB%B0%9C%EB%A1%9C%EB%9E%80%ED%8A%B8');
    expect(screen.queryByRole('dialog', { name: '검색' })).not.toBeInTheDocument();
  });

  it('closes the search with Escape and returns focus to the button', () => {
    render(<MobileTopBar unreadCount={0} />);
    const trigger = screen.getByRole('button', { name: '검색 열기' });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole('textbox', { name: '통합 검색' }), { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: '검색' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('does not search for a blank keyword', () => {
    render(<MobileTopBar unreadCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));
    fireEvent.submit(screen.getByRole('textbox', { name: '통합 검색' }));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('closes the search when the window widens to the desktop shell', () => {
    const listeners = new Set<(event: { matches: boolean }) => void>();
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: (event: { matches: boolean }) => void) => listeners.delete(listener),
    })));
    render(<MobileTopBar unreadCount={0} />);
    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));
    expect(screen.getByRole('dialog', { name: '검색' })).toBeInTheDocument();

    act(() => listeners.forEach((listener) => listener({ matches: true })));
    expect(screen.queryByRole('dialog', { name: '검색' })).not.toBeInTheDocument();
  });
});
