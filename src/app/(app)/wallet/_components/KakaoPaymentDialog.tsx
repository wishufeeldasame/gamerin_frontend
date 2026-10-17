'use client';

import { Loader2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useToast } from '@/app/context/ToastContext';
import {
  PAYMENT_RESULT_ACK,
  PAYMENT_RESULT_MESSAGE,
  createRequestId,
  isMobileBrowser,
  type PaymentResultMessage,
} from '@/lib/payment-device';
import { approvePayment, getPayment, readyPayment, type PaymentProduct } from '@/lib/payment-api';
import { rememberPaymentReturnTo } from '@/lib/payment-return';

const POPUP_NAME = 'gamerin-kakaopay';
// 08 문서 12-13절: 카카오페이 권장 크기 확인 전까지 480×720.
const POPUP_FEATURES = 'width=480,height=720';
const POPUP_BLOCKED_MESSAGE = '팝업이 차단되었습니다. 브라우저 주소창의 팝업 차단을 해제한 뒤 다시 시도해주세요.';
// 팝업이 결과를 보내고 바로 닫히면 closed 감지가 message보다 먼저 올 수 있어 잠시 기다린다.
const CLOSED_GRACE_MS = 500;

type Phase = 'confirm' | 'preparing' | 'waiting';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '결제 요청을 처리하지 못했어요.';
}

const resultHref = (orderId: string) => `/payments/result?orderId=${encodeURIComponent(orderId)}`;

export function KakaoPaymentDialog({
  product,
  returnTo = null,
  onClose,
  conflictMessage,
}: {
  product: PaymentProduct;
  returnTo?: string | null;
  onClose: () => void;
  /** 409 응답을 화면 문구로 바꿀 때 쓴다(멤버십 M-5). */
  conflictMessage?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const requestIdRef = useRef<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const orderIdRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);
  const [phase, setPhase] = useState<Phase>('confirm');
  const [error, setError] = useState<string | null>(null);
  const isMembership = product.purpose === 'MEMBERSHIP_PASS';

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [phase]);

  // 부모 창이 승인한다. 결과·상태 표시는 결과 페이지가 맡는다(재조회 포함).
  const settle = useCallback(async (pgToken: string | null) => {
    const orderId = orderIdRef.current;
    if (!orderId || settledRef.current) return;
    settledRef.current = true;
    if (popupRef.current && !popupRef.current.closed) popupRef.current.close();

    if (pgToken) {
      // 실패·결과 불명도 결과 페이지가 주문 상태로 판정한다.
      await approvePayment(orderId, pgToken).catch(() => undefined);
      router.push(resultHref(orderId));
      return;
    }

    try {
      const payment = await getPayment(orderId);
      if (payment.status === 'READY' || payment.status === 'FAILED' || payment.status === 'EXPIRED') {
        toast.info('결제가 취소되었습니다.');
        onClose();
        return;
      }
      router.push(resultHref(orderId));
    } catch (caught) {
      toast.error(errorMessage(caught));
      onClose();
    }
  }, [onClose, router, toast]);

  useEffect(() => {
    if (phase !== 'waiting') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popupRef.current) return;
      const data = event.data as Partial<PaymentResultMessage> | null;
      if (data?.type !== PAYMENT_RESULT_MESSAGE || data.orderId !== orderIdRef.current) return;
      // 받았다고 알려야 팝업이 닫힌다. 응답이 없으면 팝업이 직접 승인한다.
      popupRef.current?.postMessage({ type: PAYMENT_RESULT_ACK, orderId: data.orderId }, window.location.origin);
      void settle(data.result === 'approval' && data.pgToken ? data.pgToken : null);
    };
    let graceTimer: number | undefined;
    const closedTimer = window.setInterval(() => {
      if (!popupRef.current?.closed || graceTimer !== undefined) return;
      graceTimer = window.setTimeout(() => void settle(null), CLOSED_GRACE_MS);
    }, 500);

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.clearInterval(closedTimer);
      window.clearTimeout(graceTimer);
    };
  }, [phase, settle]);

  const startPayment = async () => {
    if (phase !== 'confirm') return;
    const mobile = isMobileBrowser();
    let popup: Window | null = null;

    if (!mobile) {
      // await 전에 동기적으로 열어야 팝업 차단을 피한다. 차단되면 ready를 호출하지 않는다.
      popup = window.open('', POPUP_NAME, POPUP_FEATURES);
      if (!popup) {
        setError(POPUP_BLOCKED_MESSAGE);
        return;
      }
    }

    // 네트워크 오류로 다시 시도할 때는 같은 requestId를 보내 서버가 기존 주문으로 응답하게 한다.
    requestIdRef.current ??= createRequestId();
    setPhase('preparing');
    setError(null);

    try {
      const order = await readyPayment(product.productCode, requestIdRef.current);
      const paymentUrl = mobile ? order.mobileUrl : order.pcUrl;

      if (!paymentUrl) {
        popup?.close();
        // 첫 ready가 아직 처리 중이면 같은 requestId로 다시 확인하게 둔다.
        if (order.status === 'CREATED') {
          throw new Error('결제를 준비하고 있어요. 잠시 후 다시 시도해주세요.');
        }
        // 같은 requestId로 이미 승인·확인 중인 주문이면 결과만 확인한다.
        if (order.status !== 'FAILED' && order.status !== 'EXPIRED' && order.status !== 'READY') {
          router.push(resultHref(order.orderId));
          return;
        }
        requestIdRef.current = null;
        throw new Error('카카오페이 결제창을 열 수 없어요. 다시 시도해주세요.');
      }

      // 결제창까지 열린 주문은 끝났으므로 이후 결제는 새 주문으로 만든다.
      requestIdRef.current = null;
      orderIdRef.current = order.orderId;
      settledRef.current = false;
      rememberPaymentReturnTo(order.orderId, returnTo);

      if (mobile) {
        window.location.assign(paymentUrl);
        return;
      }

      popup!.location.href = paymentUrl;
      popupRef.current = popup;
      setPhase('waiting');
    } catch (caught) {
      popup?.close();
      const status = (caught as { status?: number }).status;
      setError(status === 409 && conflictMessage ? conflictMessage : errorMessage(caught));
      setPhase('confirm');
    }
  };

  const stopPayment = () => void settle(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (phase === 'waiting') stopPayment();
      else if (phase === 'confirm') onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    // 모달 안에서만 포커스가 돌게 한다.
    const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const title = phase === 'waiting'
    ? '결제 진행 중'
    : phase === 'preparing'
      ? '결제를 준비하고 있어요'
      : isMembership ? '멤버십 결제하기' : '카카오페이로 충전하기';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onMouseDown={phase === 'confirm' ? onClose : undefined}
    >
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kakao-payment-title"
        onKeyDown={handleKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        className="relative w-full max-w-[460px] rounded-2xl border border-zinc-100 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-7"
      >
        {phase === 'confirm' ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="결제창 닫기"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-neutral-800 dark:text-zinc-300"
          >
            <X size={17} />
          </button>
        ) : null}

        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">KAKAOPAY</p>
        <h2 id="kakao-payment-title" className="mt-2 pr-10 text-2xl font-black text-black dark:text-zinc-100">
          {title}
        </h2>

        {phase === 'preparing' ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-4 text-center" aria-live="polite">
            <Loader2 className="animate-spin text-zinc-400" size={36} />
            <p className="text-sm font-bold text-zinc-500">잠시 후 카카오페이 결제 화면으로 이동합니다.</p>
          </div>
        ) : phase === 'waiting' ? (
          <>
            <div className="mt-5 space-y-1 text-sm font-bold text-zinc-500" aria-live="polite">
              <p>카카오페이 창에서 결제를 완료해주세요.</p>
              <p>QR 또는 카카오톡 알림으로 결제할 수 있어요.</p>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => popupRef.current?.focus()}
                className="h-12 rounded-xl border border-zinc-200 px-4 text-sm font-black text-black dark:border-neutral-700 dark:text-zinc-100"
              >
                결제 창 다시 열기
              </button>
              <button
                type="button"
                onClick={stopPayment}
                className="h-12 rounded-xl bg-black px-4 text-sm font-black text-white dark:bg-[#f5b93d] dark:text-black"
              >
                결제 중단
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-zinc-50 p-5 dark:bg-neutral-800">
              <p className="text-xs font-bold text-zinc-500">{product.name}</p>
              <p className="mt-2 text-3xl font-black text-black dark:text-zinc-100">
                {product.price.toLocaleString('ko-KR')}원
              </p>
              <p className="mt-2 text-xs font-bold text-zinc-400">
                {isMembership
                  ? `${product.durationDays ?? 30}일 이용권이 적용됩니다. 자동 갱신되지 않아요.`
                  : `${(product.mileage ?? product.price).toLocaleString('ko-KR')} M가 충전됩니다.`}
              </p>
            </div>

            {error ? (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-12 rounded-xl bg-zinc-100 px-4 text-sm font-black text-zinc-600 dark:bg-neutral-800 dark:text-zinc-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void startPayment()}
                className="h-12 rounded-xl bg-black px-4 text-sm font-black text-white dark:bg-[#f5b93d] dark:text-black"
              >
                카카오페이로 결제
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
