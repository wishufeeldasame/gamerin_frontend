'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { fetchMyMembership } from '@/lib/membership-api';
import {
  approvePayment,
  getPayment,
  isPaymentPending,
  type PaymentResponse,
} from '@/lib/payment-api';
import {
  PAYMENT_RESULT_ACK,
  PAYMENT_RESULT_MESSAGE,
  PAYMENT_STANDALONE_PARAM,
  isPaymentResultRelay,
  type PaymentResultMessage,
} from '@/lib/payment-device';
import { readPaymentReturnTo } from '@/lib/payment-return';

// 08 문서 12-6절: 3·5·10초, 이후 15초 간격으로 최대 2분 재조회한다.
const POLL_DELAYS_MS = [3_000, 5_000, 10_000, 15_000];
const POLL_LIMIT_MS = 120_000;
// 부모 창이 새로고침·이동해 결과를 받지 못하면 팝업이 직접 처리한다.
const RELAY_ACK_TIMEOUT_MS = 1_500;

type View =
  | { kind: 'relay' }
  | { kind: 'checking' }
  | { kind: 'missing' }
  | { kind: 'login' }
  | { kind: 'payment'; payment: PaymentResponse };

type Tone = 'pending' | 'success' | 'fail' | 'lock';

interface Action {
  href: string;
  label: string;
}

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function PaymentResult() {
  const params = useSearchParams();
  const { user, isAuthReady, updateUser } = useAuth();
  // 첫 렌더의 값을 고정한다. 곧바로 URL에서 pg_token을 지운다.
  const [orderId] = useState(() => params.get('orderId'));
  const [result] = useState(() => params.get('result'));
  const [pgToken] = useState(() => params.get('pg_token'));
  const [popupMode] = useState(() => typeof window !== 'undefined' && isPaymentResultRelay());
  const [standalone] = useState(() => params.has(PAYMENT_STANDALONE_PARAM));
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membershipUntil, setMembershipUntil] = useState<string | null>(null);
  const [pollExpired, setPollExpired] = useState(false);
  const [pollTick, setPollTick] = useState(0);
  const started = useRef(false);
  const pollStartRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!orderId) return;
    // standalone 표시는 남겨야 AuthContext가 이 창을 결과 전달 팝업으로 보지 않는다.
    const suffix = standalone ? `&${PAYMENT_STANDALONE_PARAM}=1` : '';
    window.history.replaceState(null, '', `/payments/result?orderId=${encodeURIComponent(orderId)}${suffix}`);
  }, [orderId, standalone]);

  // 팝업 모드: 결과만 부모 창에 넘기고 닫는다. 승인은 부모 창이 한다.
  useEffect(() => {
    if (!popupMode || !orderId) return;
    const message: PaymentResultMessage = { type: PAYMENT_RESULT_MESSAGE, orderId, result, pgToken };
    const handleAck = (event: MessageEvent) => {
      const data = event.data as { type?: unknown; orderId?: unknown } | null;
      if (event.origin !== window.location.origin || event.source !== window.opener) return;
      if (data?.type === PAYMENT_RESULT_ACK && data.orderId === orderId) window.close();
    };
    window.addEventListener('message', handleAck);
    window.opener.postMessage(message, window.location.origin);
    const fallback = window.setTimeout(() => {
      const query = new URLSearchParams({ orderId, [PAYMENT_STANDALONE_PARAM]: '1' });
      if (result) query.set('result', result);
      if (pgToken) query.set('pg_token', pgToken);
      window.location.replace(`/payments/result?${query.toString()}`);
    }, RELAY_ACK_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', handleAck);
      window.clearTimeout(fallback);
    };
  }, [popupMode, orderId, result, pgToken]);

  useEffect(() => {
    if (popupMode || !isAuthReady || !user || !orderId || started.current) return;
    started.current = true;

    const load = async () => {
      if (result === 'approval' && pgToken) {
        try {
          setPayment(await approvePayment(orderId, pgToken));
          return;
        } catch {
          // 네트워크·5xx(결과 불명)든 409 등 거부든 실제 주문 상태를 조회해 보여준다.
        }
      }
      try {
        setPayment(await getPayment(orderId));
      } catch (caught) {
        const status = (caught as { status?: number }).status;
        if (status === 403 || status === 404) setMissing(true);
        else setError(caught instanceof Error ? caught.message : '결제 결과를 불러오지 못했어요.');
      }
    };
    void load();
  }, [popupMode, isAuthReady, user, orderId, result, pgToken]);

  // 멤버십 완료: 만료일을 다시 불러오고 헤더·사이드바 배지를 바로 반영한다.
  const approvedMembership = payment?.status === 'APPROVED' && payment.purpose === 'MEMBERSHIP_PASS';
  useEffect(() => {
    if (!approvedMembership) return;
    fetchMyMembership()
      .then((membership) => {
        setMembershipUntil(formatDate(membership.expiresAt));
        updateUser({ membershipBadge: membership.active });
      })
      .catch(() => undefined);
  }, [approvedMembership, updateUser]);

  // 결과 불명 재조회. 숨긴 탭에서는 멈추고 다시 보이면 한 번 조회한다.
  useEffect(() => {
    if (!orderId || !payment || !isPaymentPending(payment.status) || pollExpired) return;
    pollStartRef.current ??= Date.now();
    const remaining = POLL_LIMIT_MS - (Date.now() - pollStartRef.current);
    let active = true;

    const poll = () => {
      if (document.hidden) return;
      if (Date.now() - (pollStartRef.current ?? 0) >= POLL_LIMIT_MS) {
        setPollExpired(true);
        return;
      }
      attemptRef.current += 1;
      // 응답이 같아도 다음 재조회를 예약하도록 tick을 올린다.
      getPayment(orderId)
        .then((next) => active && setPayment(next))
        .catch(() => undefined)
        .finally(() => active && setPollTick((tick) => tick + 1));
    };
    const delay = POLL_DELAYS_MS[Math.min(attemptRef.current, POLL_DELAYS_MS.length - 1)];
    const timer = window.setTimeout(poll, Math.max(0, Math.min(delay, remaining)));
    const handleVisibility = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      poll();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [orderId, payment, pollExpired, pollTick]);

  let view: View;
  if (!orderId || missing) view = { kind: 'missing' };
  else if (popupMode) view = { kind: 'relay' };
  else if (!isAuthReady) view = { kind: 'checking' };
  else if (!user) view = { kind: 'login' };
  else if (payment) view = { kind: 'payment', payment };
  else view = { kind: 'checking' };

  const returnTo = orderId ? readPaymentReturnTo(orderId) : null;
  const historyAction: Action = { href: '/wallet?tab=payments', label: '결제 내역 보기' };
  let tone: Tone = 'pending';
  let title = '결제를 확인하고 있어요';
  let description: string | null = null;
  let actions: Action[] = [];

  switch (view.kind) {
    case 'relay':
      title = '결제 결과를 전달하고 있어요';
      break;
    case 'missing':
      tone = 'fail';
      title = '결제 정보를 찾을 수 없어요';
      actions = [{ href: '/home', label: '홈으로' }];
      break;
    case 'login':
      tone = 'lock';
      title = '로그인 후 결제 내역에서 결과를 확인해주세요';
      description = '승인되지 않은 결제는 15분 후 자동으로 정리돼요.';
      actions = [{ href: '/login', label: '로그인' }];
      break;
    case 'checking':
      if (error) {
        tone = 'fail';
        title = '결제 결과를 확인하지 못했어요';
        description = error;
        actions = [historyAction];
      }
      break;
    case 'payment': {
      const current = view.payment;
      const isMembership = current.purpose === 'MEMBERSHIP_PASS';
      const retry: Action = isMembership
        ? { href: '/membership', label: '다시 결제하기' }
        : { href: returnTo ? `/wallet?returnTo=${encodeURIComponent(returnTo)}` : '/wallet', label: '다시 결제하기' };

      if (current.status === 'APPROVED') {
        tone = 'success';
        if (isMembership) {
          title = membershipUntil ? `멤버십이 ${membershipUntil}까지 이용 가능해요` : '멤버십 결제가 완료되었어요';
          actions = [{ href: '/membership', label: '멤버십 보기' }];
        } else {
          // 1원 = 1 M 정책이라 결제 금액이 곧 적립액이다.
          title = `${(current.amount ?? 0).toLocaleString('ko-KR')} M이 충전되었어요`;
          actions = [{ href: '/wallet', label: '지갑으로' }];
          if (returnTo?.startsWith('/mentoring')) actions.push({ href: returnTo, label: '멘토링으로 돌아가기' });
        }
      } else if (isPaymentPending(current.status)) {
        title = pollExpired ? '결제 내역에서 결과를 확인할 수 있어요' : '결제 결과를 확인하고 있어요';
        description = pollExpired ? null : '잠시만 기다려주세요. 결과가 확정되면 자동으로 바뀌어요.';
        actions = [historyAction];
      } else if (current.status === 'CANCELED') {
        tone = 'fail';
        title = '결제가 취소되었어요';
        actions = [historyAction];
      } else if (['FAILED', 'EXPIRED', 'READY', 'CREATED'].includes(current.status)) {
        // cancel·fail 복귀는 서버 주문이 READY로 남는다(09 문서 13-9절).
        tone = 'fail';
        title = '결제가 완료되지 않았어요';
        actions = [retry];
      }
      break;
    }
  }

  useEffect(() => {
    titleRef.current?.focus();
  }, [title]);

  const Icon = tone === 'success' ? CheckCircle2 : tone === 'fail' ? AlertCircle : tone === 'lock' ? Lock : Loader2;

  return (
    <main className="grid min-h-screen place-items-center bg-background p-5 text-zinc-900 dark:text-zinc-100">
      <section className="w-full max-w-[480px] space-y-4 rounded-2xl border border-zinc-100 bg-white p-7 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">KAKAOPAY</span>
        <Icon
          aria-hidden="true"
          size={32}
          className={
            tone === 'success'
              ? 'text-black dark:text-[#f5b93d]'
              : tone === 'fail'
                ? 'text-red-500'
                : tone === 'lock'
                  ? 'text-zinc-500'
                  : 'animate-spin text-zinc-400'
          }
        />
        <div aria-live="polite">
          <h1 ref={titleRef} tabIndex={-1} className="text-2xl font-black outline-none">{title}</h1>
          {description ? <p className="mt-2 text-sm font-bold text-zinc-500">{description}</p> : null}
          {view.kind === 'payment' ? (
            <p className="mt-2 text-sm text-zinc-500">
              {view.payment.itemName} · {(view.payment.amount ?? 0).toLocaleString('ko-KR')}원
            </p>
          ) : null}
        </div>
        {actions.length > 0 ? (
          <div className="grid gap-2">
            {actions.map((action, index) => (
              <Link
                key={action.href + action.label}
                href={action.href}
                className={
                  index === 0
                    ? 'grid h-12 place-items-center rounded-xl bg-black text-sm font-black text-white dark:bg-[#f5b93d] dark:text-black'
                    : 'grid h-12 place-items-center rounded-xl border border-zinc-200 text-sm font-black dark:border-zinc-700'
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResult />
    </Suspense>
  );
}
