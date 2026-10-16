'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { approvePayment, getPayment, type PaymentResponse } from '@/lib/payment-api';

// shortcut: 같은 탭 복귀 전용(시험 연동). PC 팝업·postMessage·팝업 refresh 예외는 08 문서 12-6절 구현 때 추가한다.
function titleOf(payment: PaymentResponse) {
  switch (payment.status) {
    case 'APPROVED':
      return payment.purpose === 'MEMBERSHIP_PASS'
        ? '멤버십 결제가 완료되었어요'
        : `${(payment.amount ?? 0).toLocaleString('ko-KR')} M이 충전되었어요`;
    case 'CANCELED':
      return '결제가 취소되었어요';
    case 'APPROVING':
    case 'CANCELING':
    case 'NEEDS_REVIEW':
      return '결제 결과를 확인하고 있어요';
    default:
      return '결제가 완료되지 않았어요';
  }
}

function PaymentResult() {
  const params = useSearchParams();
  const { user, isAuthReady } = useAuth();
  const [orderId] = useState(() => params.get('orderId'));
  const [result] = useState(() => params.get('result'));
  const [pgToken] = useState(() => params.get('pg_token'));
  const [payment, setPayment] = useState<PaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // pg_token을 주소창·기록에 남기지 않는다.
    if (orderId) window.history.replaceState(null, '', `/payments/result?orderId=${encodeURIComponent(orderId)}`);
  }, [orderId]);

  useEffect(() => {
    if (!isAuthReady || !user || !orderId || started.current) return;
    started.current = true;
    // cancel·fail 복귀는 표시용 신호이므로 승인하지 않고 서버 상태만 조회한다.
    const request = result === 'approval' && pgToken ? approvePayment(orderId, pgToken) : getPayment(orderId);
    request.then(setPayment).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '결제 결과를 불러오지 못했어요.');
    });
  }, [isAuthReady, user, orderId, result, pgToken]);

  const refresh = () => {
    if (!orderId) return;
    setError(null);
    getPayment(orderId).then(setPayment).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : '결제 결과를 불러오지 못했어요.');
    });
  };

  let title = '결제를 확인하고 있어요';
  if (!orderId) title = '결제 정보를 찾을 수 없어요';
  else if (isAuthReady && !user) title = '로그인 후 결제 내역에서 결과를 확인해주세요';
  else if (error) title = '결제 결과를 확인하지 못했어요';
  else if (payment) title = titleOf(payment);

  const destination = payment?.purpose === 'MEMBERSHIP_PASS' ? '/membership' : '/wallet';
  const destinationLabel = payment?.purpose === 'MEMBERSHIP_PASS' ? '멤버십 보기' : '지갑으로';

  return (
    <main className="grid min-h-screen place-items-center bg-white p-5 text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
      <section className="w-full max-w-[480px] space-y-4 rounded-2xl border border-zinc-100 bg-white p-7 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-[11px] font-black tracking-widest text-zinc-400">KAKAOPAY</span>
        <h1 className="text-[22px] font-black" aria-live="polite">{title}</h1>
        {error ? <p className="text-sm font-bold text-red-500">{error}</p> : null}
        {payment ? (
          <p className="text-sm text-zinc-500">
            {payment.itemName} · {(payment.amount ?? 0).toLocaleString('ko-KR')}원 · 상태 {payment.status}
          </p>
        ) : null}
        <div className="grid gap-2">
          {error && orderId && user ? (
            <button type="button" onClick={refresh} className="min-h-12 rounded-xl border border-zinc-200 bg-zinc-50 text-sm font-black dark:border-zinc-700 dark:bg-zinc-800">
              결제 상태 다시 확인
            </button>
          ) : null}
          {isAuthReady && !user ? (
            <Link href="/login" className="grid min-h-12 place-items-center rounded-xl bg-black text-sm font-black text-white dark:bg-[#f5b93d] dark:text-black">
              로그인
            </Link>
          ) : (
            <Link href={destination} className="grid min-h-12 place-items-center rounded-xl bg-black text-sm font-black text-white dark:bg-[#f5b93d] dark:text-black">
              {destinationLabel}
            </Link>
          )}
        </div>
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
