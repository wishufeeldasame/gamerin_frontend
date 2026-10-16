'use client';

import { Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { readyPayment, type PaymentProduct } from '@/lib/payment-api';

function isMobileBrowser() {
  return /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '결제 요청을 처리하지 못했어요.';
}

export function KakaoPaymentDialog({
  product,
  onClose,
}: {
  product: PaymentProduct;
  onClose: () => void;
}) {
  const requestIdRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMembership = product.purpose === 'MEMBERSHIP_PASS';

  const startPayment = async () => {
    if (submitting) return;

    requestIdRef.current ??= crypto.randomUUID();
    setSubmitting(true);
    setError(null);

    try {
      const order = await readyPayment(product.productCode, requestIdRef.current);
      const paymentUrl = isMobileBrowser() ? order.mobileUrl : order.pcUrl;

      if (!paymentUrl) {
        throw new Error('카카오페이 결제창을 열 수 없어요. 다시 시도해주세요.');
      }

      window.location.assign(paymentUrl);
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-5"
      onMouseDown={submitting ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="kakao-payment-title"
        onMouseDown={(event) => event.stopPropagation()}
        className="relative w-full max-w-[460px] rounded-3xl border border-zinc-100 bg-white p-6 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900 sm:p-7"
      >
        {!submitting ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="결제창 닫기"
            className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-neutral-800 dark:text-zinc-300"
          >
            <X size={17} />
          </button>
        ) : null}

        <p className="text-xs font-black tracking-[0.18em] text-[#9a6811] dark:text-[#f5b93d]">KAKAOPAY</p>
        <h2 id="kakao-payment-title" className="mt-2 pr-10 text-2xl font-black text-black dark:text-zinc-100">
          {submitting ? '결제를 준비하고 있어요' : isMembership ? '멤버십 결제하기' : '카카오페이로 충전하기'}
        </h2>

        {submitting ? (
          <div className="flex min-h-44 flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="animate-spin text-[#d69a1f]" size={36} />
            <p className="text-sm font-bold text-zinc-500">잠시 후 카카오페이 결제 화면으로 이동합니다.</p>
          </div>
        ) : (
          <>
            <div className="mt-6 rounded-2xl bg-zinc-50 p-5 dark:bg-neutral-800">
              <p className="text-xs font-bold text-zinc-500">{product.name}</p>
              <p className="mt-2 text-3xl font-black text-black dark:text-zinc-100">
                {product.price.toLocaleString('ko-KR')}원
              </p>
              <p className="mt-2 text-xs font-bold text-zinc-400">
                {isMembership
                  ? (product.durationDays ?? 30) + '일 이용권이 적용됩니다.'
                  : (product.mileage ?? product.price).toLocaleString('ko-KR') + ' M가 충전됩니다.'}
              </p>
            </div>

            {error ? <p className="mt-4 text-sm font-bold text-red-500">{error}</p> : null}

            <div className="mt-6 grid grid-cols-[1fr_2fr] gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-xl bg-zinc-100 px-4 text-sm font-black text-zinc-600 dark:bg-neutral-800 dark:text-zinc-300"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void startPayment()}
                className="min-h-12 rounded-xl bg-[#f5b93d] px-4 text-sm font-black text-black transition hover:bg-[#e7aa2e]"
              >
                카카오페이 결제
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
