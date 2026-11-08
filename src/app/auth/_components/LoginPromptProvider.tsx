'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useLayoutEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { EyeOff } from 'lucide-react';
import { useAuth, type User } from '@/app/context/AuthContext';
import { loginWithPassword } from '@/lib/auth-api';
import { getApiBaseUrl } from '@/lib/api-base';
import { getPublicRequestErrorMessage } from '@/lib/public-request-error';
import { HANDLE_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '@/lib/auth-validation';
import {
  LOGIN_PROMPT_EVENT, clearLoginReturnTo, currentPageReturnTo, isAccountPage, isPublicAppPath,
  readLoginReturnTo, rememberLoginReturnTo, requestLogin, safeLoginReturnTo, type LoginPromptRequest,
} from '@/lib/login-prompt';

const OAUTH_ERROR = 'Google 계정의 이메일이 인증되지 않아 계속할 수 없습니다. Google에서 이메일을 인증한 뒤 다시 시도해 주세요.';
const focusClass = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

function LoginQueryPrompt() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthReady } = useAuth();
  useEffect(() => {
    const error = params.get('error');
    const message = error === 'email_not_verified' ? OAUTH_ERROR
      : error === 'account_withdrawn' ? '탈퇴한 계정입니다. 다른 계정으로 로그인해 주세요.' : undefined;
    if (!isAuthReady || user || (params.get('login') !== '1' && !message)) return;
    requestLogin({
      message,
      returnTo: safeLoginReturnTo(params.get('returnTo') ?? readLoginReturnTo()),
    });
    const next = new URLSearchParams(params.toString());
    for (const key of ['login', 'returnTo', 'error']) next.delete(key);
    router.replace(pathname + (next.size ? `?${next}` : '') + window.location.hash, { scroll: false });
  }, [isAuthReady, params, pathname, router, user]);
  return null;
}

export function LoginDialog({ message, initialHandle, onClose, onNavigate, onSuccess, returnTo }: {
  message?: string; initialHandle?: string; returnTo: string; onClose: () => void; onNavigate: () => void; onSuccess: (user: User) => void;
}) {
  const { isLoggingOut } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [handle, setHandle] = useState(initialHandle ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (dialog.open) dialog.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current || isLoggingOut) return;
    if (!handle.trim() || !password.trim()) {
      setError('아이디와 비밀번호를 입력해 주세요.');
      return;
    }
    submittingRef.current = true;
    setPending(true);
    setError('');
    try {
      onSuccess(await loginWithPassword(handle.trim(), password));
    } catch (failure) {
      if (!(failure instanceof DOMException && failure.name === 'AbortError')) {
        setError(getPublicRequestErrorMessage(failure, '로그인에 실패했습니다.'));
      }
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  const navigateAccount = () => {
    rememberLoginReturnTo(returnTo);
    onNavigate();
  };
  return (
    <dialog
      ref={dialogRef} aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); return; }
        if (event.key !== 'Tab') return;
        const nodes = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled)') ?? [])];
        const first = nodes[0]; const last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[440px] overflow-y-auto rounded-[20px] border border-line bg-surface p-5 text-fg-primary shadow-[0_16px_56px_rgb(0_0_0/24%)] backdrop:bg-black/40 dark:backdrop:bg-black/60 md:p-7"
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-title">Gamer<span className="text-fg-brand">IN</span></span>
          <button type="button" aria-label="로그인 닫기" onClick={onClose} className={`flex size-11 items-center justify-center rounded-control text-[28px] text-fg-secondary ${focusClass}`}>×</button>
        </div>
        <div>
          <h2 id={`${id}-title`} className="text-title">다시 오신 걸 환영해요</h2>
          <p id={`${id}-description`} className="mt-1.5 break-keep text-label font-normal text-fg-secondary">{message ?? '함께 플레이하고 이야기를 나누려면 로그인해 주세요.'}</p>
        </div>
        <button type="button" disabled={pending || isLoggingOut} onClick={() => {
          rememberLoginReturnTo(returnTo);
          window.location.assign(`${getApiBaseUrl()}/oauth2/authorization/google`);
        }} className={`flex h-12 items-center justify-center gap-2.5 rounded-[10px] border border-line bg-subtle text-body font-bold disabled:opacity-50 ${focusClass}`}>
          <Image src="/images/auth/google.svg" alt="" width={20} height={20} />Google로 계속하기
        </button>
        <div className="flex items-center gap-2.5 text-caption text-fg-secondary"><span className="h-px flex-1 bg-line" />또는 아이디로 로그인<span className="h-px flex-1 bg-line" /></div>
        <form onSubmit={submit} noValidate className="flex flex-col gap-3">
          <div>
            <label htmlFor={`${id}-handle`} className="text-label font-bold">아이디</label>
            <input id={`${id}-handle`} name="username" autoComplete="username" maxLength={HANDLE_MAX_LENGTH} value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="아이디를 입력해 주세요" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
              className="mt-1.5 h-12 w-full rounded-[10px] border border-line !bg-subtle px-3.5 text-label font-normal text-fg-primary placeholder:text-fg-secondary focus-visible:outline-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus dark:placeholder:!text-fg-tertiary" />
          </div>
          <div>
            <label htmlFor={`${id}-password`} className="text-label font-bold">비밀번호</label>
            <div className="relative mt-1.5">
              <input id={`${id}-password`} name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" maxLength={PASSWORD_MAX_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력해 주세요" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
                className="h-12 w-full rounded-[10px] border border-line !bg-subtle pl-3.5 pr-12 text-label font-normal text-fg-primary placeholder:text-fg-secondary focus-visible:outline-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus dark:placeholder:!text-fg-tertiary" />
              <button type="button" aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className={`absolute right-0.5 top-0.5 flex size-11 items-center justify-center rounded-control text-fg-secondary ${focusClass}`}>
                {showPassword ? <EyeOff size={20} /> : <span aria-hidden="true" className="size-5 bg-current" style={{ maskImage: "url('/images/auth/eye.svg')", maskSize: 'contain', maskRepeat: 'no-repeat' }} />}
              </button>
            </div>
          </div>
          {error ? <p id={`${id}-error`} role="alert" className="text-label text-fg-danger">{error}</p> : null}
          <button type="submit" disabled={pending || isLoggingOut} className={`h-12 rounded-[10px] bg-brand text-body font-bold text-fg-on-brand hover:bg-brand-hover disabled:opacity-50 ${focusClass}`}>{pending ? '로그인 중…' : '로그인'}</button>
        </form>
        <div className="flex justify-center gap-4 text-label text-fg-secondary">
          <Link href="/find-id" onClick={navigateAccount} className={focusClass}>아이디 찾기</Link>
          <Link href="/auth/forgot-password" onClick={navigateAccount} className={focusClass}>비밀번호 찾기</Link>
        </div>
        <p className="flex flex-wrap items-center justify-center gap-2 text-caption text-fg-secondary">아직 계정이 없으신가요?<Link href="/signup" onClick={navigateAccount} className={`text-label font-bold text-fg-brand ${focusClass}`}>회원가입</Link></p>
        <p className="text-center text-caption text-fg-tertiary"><Link href="/terms" target="_blank" className={focusClass}>이용약관</Link> · <Link href="/privacy" target="_blank" className={focusClass}>개인정보 처리방침</Link></p>
      </div>
    </dialog>
  );
}

export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const { user, login, isSessionUnavailable, isAccountBlocked } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<LoginPromptRequest | null>(null);
  const activeRef = useRef(active);
  const close = useCallback(() => {
    const previous = activeRef.current;
    activeRef.current = null;
    setActive(null);
    clearLoginReturnTo();
    if (previous?.dismissTo) router.replace(previous.dismissTo, { scroll: false });
  }, [router]);
  useLayoutEffect(() => {
    const open = (event: Event) => {
      if (isSessionUnavailable || isAccountBlocked || activeRef.current) return;
      // 결제 콜백에서 로그인하면 승인 effect가 재개될 수 있어 먼저 읽기 화면으로 벗어난다.
      if (window.location.pathname.startsWith('/payments/')) {
        const target = '/wallet?tab=payments';
        rememberLoginReturnTo(target);
        router.replace(`/?login=1&returnTo=${encodeURIComponent(target)}`, { scroll: false });
        return;
      }
      const detail = (event as CustomEvent<LoginPromptRequest>).detail ?? {};
      const next = { ...detail, returnTo: safeLoginReturnTo(detail.returnTo ?? currentPageReturnTo()) };
      activeRef.current = next;
      setActive(next);
    };
    window.addEventListener(LOGIN_PROMPT_EVENT, open);
    return () => window.removeEventListener(LOGIN_PROMPT_EVENT, open);
  }, [isSessionUnavailable, isAccountBlocked, router]);

  useEffect(() => {
    if (user || isAccountBlocked) { activeRef.current = null; setActive(null); }
  }, [user, isAccountBlocked]);

  return <>
    <div onClickCapture={(event) => {
      if (window.location.pathname.startsWith('/admin') || user || isSessionUnavailable || isAccountBlocked || event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor) return;
      const url = new URL(anchor.getAttribute('href')!, window.location.href);
      if (url.origin === window.location.origin && url.pathname === '/' && url.searchParams.get('login') === '1') {
        event.preventDefault(); event.stopPropagation();
        requestLogin({ returnTo: url.searchParams.get('returnTo') ?? (isAccountPage(window.location.pathname) ? readLoginReturnTo() : currentPageReturnTo()) });
        return;
      }
      if (url.origin !== window.location.origin || isAccountPage(url.pathname) || isPublicAppPath(url.pathname) || url.pathname.startsWith('/admin')) return;
      event.preventDefault(); event.stopPropagation();
      requestLogin({ returnTo: url.pathname + url.search + url.hash });
    }}>{children}</div>
    <Suspense fallback={null}><LoginQueryPrompt /></Suspense>
    {active && !user && !isAccountBlocked ? <LoginDialog
      message={active.message} initialHandle={active.initialHandle} returnTo={active.returnTo ?? '/'} onClose={close}
      onNavigate={() => { activeRef.current = null; setActive(null); }}
      onSuccess={(nextUser) => {
        const shouldNavigate = activeRef.current === active;
        login(nextUser);
        activeRef.current = null; setActive(null); clearLoginReturnTo();
        const target = safeLoginReturnTo(active.returnTo);
        if (shouldNavigate && target !== currentPageReturnTo()) router.replace(target, { scroll: false });
      }}
    /> : null}
  </>;
}
