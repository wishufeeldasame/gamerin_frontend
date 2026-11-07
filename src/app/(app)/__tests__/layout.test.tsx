import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/home' }));
const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isAuthReady: true,
  isSessionUnavailable: false,
  retrySessionRestore: vi.fn<() => Promise<void>>(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation,
  usePathname: () => navigation.pathname,
}));
vi.mock('@/app/context/AuthContext', () => ({
  useAuth: () => auth,
}));
vi.mock('@/app/home/components/MobileTopBar', () => ({ MobileTopBar: () => <header>top-bar</header> }));
vi.mock('@/hooks/useUnreadNotificationCount', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/hooks/useUnreadNotificationCount')>(),
  useUnreadNotificationCount: () => [0, vi.fn()],
}));
vi.mock('@/app/home/components/Sidebar', () => ({
  Sidebar: () => <nav>sidebar</nav>,
  MobileTabBar: () => <nav>tab-bar</nav>,
}));
vi.mock('@/app/context/PopupContext', () => ({
  PopupProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/app/context/PendingPostsContext', () => ({
  PendingPostsProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import AppLayout from '../layout';

const flushEffects = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
});

describe('AppLayout 인증 확인', () => {
  beforeEach(() => {
    navigation.replace.mockReset();
    navigation.pathname = '/home';
    auth.user = null;
    auth.isAuthReady = true;
    auth.isSessionUnavailable = false;
    auth.retrySessionRestore.mockReset();
    auth.retrySessionRestore.mockResolvedValue(undefined);
  });

  it('로그인하지 않았으면 로그인 화면으로 보낸다', async () => {
    render(<AppLayout><p>page</p></AppLayout>);
    await flushEffects();

    expect(navigation.replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('page')).not.toBeInTheDocument();
  });

  it('세션을 일시 장애로 확인하지 못했으면 로그인 화면으로 보내지 않고 재시도 안내를 보여 준다', async () => {
    auth.isSessionUnavailable = true;

    render(<AppLayout><p>page</p></AppLayout>);
    await flushEffects();

    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '로그인 상태를 확인하지 못했습니다' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인 화면으로 이동' })).toHaveAttribute('href', '/login');
    expect(screen.queryByText('page')).not.toBeInTheDocument();
  });

  it('다시 시도 중에는 버튼을 막아 중복 요청을 보내지 않는다', async () => {
    auth.isSessionUnavailable = true;
    let finishRetry: (() => void) | undefined;
    auth.retrySessionRestore.mockImplementation(() => new Promise<void>((resolve) => {
      finishRetry = resolve;
    }));

    render(<AppLayout><p>page</p></AppLayout>);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    const pendingButton = screen.getByRole('button', { name: '확인하는 중...' });
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(pendingButton);
    expect(auth.retrySessionRestore).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRetry?.();
    });
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeEnabled();
  });

  it('인증 준비 전에는 아무것도 보여 주지 않고 이동하지 않는다', async () => {
    auth.isAuthReady = false;

    const { container } = render(<AppLayout><p>page</p></AppLayout>);
    await flushEffects();

    expect(container).toBeEmptyDOMElement();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('로그인한 사용자에게는 화면을 보여 준다', async () => {
    auth.user = { id: 'user-id' };

    render(<AppLayout><p>page</p></AppLayout>);
    await flushEffects();

    expect(screen.getByText('page')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it.each([
    ['/home', true],
    ['/posts/12', false],
    ['/notifications', false],
    ['/wallet', false],
    ['/membership', false],
  ])('%s에서 모바일 상단 바 표시 여부는 %s다(상세 화면은 자체 뒤로 헤더)', (pathname, visible) => {
    navigation.pathname = pathname;
    auth.user = { id: 'user-1' };
    render(<AppLayout><p>page</p></AppLayout>);

    expect(screen.queryByText('top-bar') !== null).toBe(visible);
  });
});
