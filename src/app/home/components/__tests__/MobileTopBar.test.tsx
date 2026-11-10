import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installDialogMock } from '@/test/feedback';

const mocks = vi.hoisted(() => ({
  pathname: '/',
  push: vi.fn(),
  logout: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => mocks.pathname,
}));

import { MobileTopBar } from '../MobileTopBar';

describe('MobileTopBar', () => {
  beforeEach(() => {
    installDialogMock();
    mocks.pathname = '/';
    mocks.push.mockReset();
    mocks.logout.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the search button on the search page', () => {
    mocks.pathname = '/search';
    render(<MobileTopBar />);
    expect(screen.queryByRole('button', { name: '검색 열기' })).not.toBeInTheDocument();
  });

  it('opens a full-screen search, focuses it, and closes it after searching', () => {
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));

    const input = screen.getByRole('textbox', { name: '통합 검색' });
    expect(input).toHaveFocus();
    fireEvent.change(input, { target: { value: ' 발로란트 ' } });
    expect(screen.getByRole('button', { name: /‘발로란트’ 전체 결과 보기/ })).toBeInTheDocument();
    fireEvent.submit(input);

    expect(mocks.push).toHaveBeenCalledWith('/search?q=%EB%B0%9C%EB%A1%9C%EB%9E%80%ED%8A%B8');
    expect(screen.queryByRole('dialog', { name: '검색' })).not.toBeInTheDocument();
  });

  it.each([
    ['Escape', (input: HTMLElement) => fireEvent.keyDown(input, { key: 'Escape' })],
    ['닫기 버튼', () => fireEvent.click(screen.getByRole('button', { name: '검색 닫기' }))],
  ])('closes the modal before returning focus to the button (%s)', (_label, closeSearch) => {
    render(<MobileTopBar />);
    const trigger = screen.getByRole('button', { name: '검색 열기' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '검색' }) as HTMLDialogElement;
    // 실제 브라우저는 모달이 열린 동안 배경을 inert로 두어 focus()가 무시된다. 포커스 시점에 모달이 닫혀 있어야 한다.
    let dialogOpenAtFocus: boolean | undefined;
    const focus = HTMLElement.prototype.focus;
    vi.spyOn(trigger, 'focus').mockImplementation(function (this: HTMLElement) {
      dialogOpenAtFocus = dialog.open;
      focus.call(this);
    });

    closeSearch(screen.getByRole('textbox', { name: '통합 검색' }));

    expect(dialogOpenAtFocus).toBe(false);
    expect(screen.queryByRole('dialog', { name: '검색' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('opens the side menu with membership, wallet, settings and logout', () => {
    render(<MobileTopBar />);
    const trigger = screen.getByRole('button', { name: '메뉴 열기' });
    fireEvent.click(trigger);
    const menu = within(screen.getByRole('dialog', { name: '메뉴' }));
    expect(menu.getByRole('link', { name: '북마크' })).toHaveAttribute('href', '/bookmarks');
    expect(menu.getByRole('link', { name: '멤버십' })).toHaveAttribute('href', '/membership');
    expect(menu.getByRole('link', { name: '지갑' })).toHaveAttribute('href', '/wallet');
    expect(menu.getByRole('link', { name: '설정' })).toHaveAttribute('href', '/settings');

    document.documentElement.classList.remove('dark');
    window.localStorage.setItem('gamerin_user_settings', '{"theme":"light"}');
    fireEvent.click(menu.getByRole('button', { name: /모드로 전환/ }));
    expect(window.localStorage.getItem('gamerin_user_settings')).toBe('{"theme":"dark"}');
    expect(document.documentElement).toHaveClass('dark');

    fireEvent.click(menu.getByRole('button', { name: '메뉴 닫기' }));
    expect(screen.queryByRole('dialog', { name: '메뉴' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: '메뉴' })).not.toBeInTheDocument();
  });

  it('does not search for a blank keyword', () => {
    render(<MobileTopBar />);
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
    render(<MobileTopBar />);
    fireEvent.click(screen.getByRole('button', { name: '검색 열기' }));
    expect(screen.getByRole('dialog', { name: '검색' })).toBeInTheDocument();

    act(() => listeners.forEach((listener) => listener({ matches: true })));
    expect(screen.queryByRole('dialog', { name: '검색' })).not.toBeInTheDocument();
  });
});

vi.mock('@/app/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'viewer-1', handle: 'viewer' }, isAuthReady: true, logout: mocks.logout }) }));

vi.mock('@/app/context/ToastContext', () => ({ useToast: () => ({ error: vi.fn() }) }));
vi.mock('@/lib/user-settings', async (original) => ({ ...(await original<typeof import('@/lib/user-settings')>()), saveThemeToServer: vi.fn().mockResolvedValue(undefined) }));
