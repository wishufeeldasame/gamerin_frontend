'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronRight, Crown, Loader2, RotateCcw, WalletCards } from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { fetchMyMileageBalance, fetchMyMileageTransactions, type MileageTransactionResponse } from '@/lib/mileage-api';
import { fetchMyPayments, fetchPaymentProducts, type PaymentProduct, type PaymentResponse } from '@/lib/payment-api';
import { safeReturnTo } from '@/lib/payment-return';
import { KakaoPaymentDialog } from './_components/KakaoPaymentDialog';

type HistoryTab = 'mileage' | 'payment';
const MILEAGE_PAGE_SIZE = 10;
const money = (value: number) => Number(value || 0).toLocaleString('ko-KR');
const dateTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '지갑 정보를 불러오지 못했어요.';

// 08 문서 12-7절. CREATED·READY·FAILED·EXPIRED는 결제가 일어나지 않아 목록에서 뺀다.
const PAYMENT_BADGE: Partial<Record<PaymentResponse['status'], { label: string; className: string }>> = {
  APPROVED: { label: '완료', className: 'bg-black text-white dark:bg-zinc-100 dark:text-black' },
  CANCELED: { label: '취소됨', className: 'bg-zinc-100 text-zinc-500 dark:bg-neutral-800 dark:text-zinc-400' },
  APPROVING: { label: '확인 중', className: 'bg-amber-50 text-amber-700 dark:bg-[#2a2112] dark:text-[#f5b93d]' },
  CANCELING: { label: '확인 중', className: 'bg-amber-50 text-amber-700 dark:bg-[#2a2112] dark:text-[#f5b93d]' },
  NEEDS_REVIEW: { label: '확인 중', className: 'bg-amber-50 text-amber-700 dark:bg-[#2a2112] dark:text-[#f5b93d]' },
};
const METHOD_LABEL: Record<string, string> = { CARD: '카드', MONEY: '카카오페이머니' };
const visiblePayments = (items: PaymentResponse[]) => items.filter((item) => PAYMENT_BADGE[item.status]);

function WalletContent() {
  const searchParams = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [transactions, setTransactions] = useState<MileageTransactionResponse[]>([]);
  const [mileagePage, setMileagePage] = useState(0);
  const [mileageLast, setMileageLast] = useState(true);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [paymentCursor, setPaymentCursor] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedForPayment, setSelectedForPayment] = useState<PaymentProduct | null>(null);
  const [tab, setTab] = useState<HistoryTab>(() => (searchParams.get('tab') === 'payments' ? 'payment' : 'mileage'));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      fetchPaymentProducts(),
      fetchMyMileageBalance(),
      fetchMyMileageTransactions(0, MILEAGE_PAGE_SIZE),
      fetchMyPayments(),
    ]);
    const [productResult, balanceResult, transactionResult, paymentResult] = results;
    if (productResult.status === 'fulfilled') {
      const chargeProducts = productResult.value.filter((product) => product.purpose === 'MILEAGE_CHARGE');
      setProducts(chargeProducts);
      setSelectedCode((current) => (chargeProducts.some((product) => product.productCode === current) ? current : null));
    }
    if (balanceResult.status === 'fulfilled') setBalance(balanceResult.value.currentBalance ?? 0);
    if (transactionResult.status === 'fulfilled') {
      setTransactions(transactionResult.value.content ?? []);
      setMileagePage(0);
      setMileageLast(transactionResult.value.last ?? true);
    }
    if (paymentResult.status === 'fulfilled') {
      setPayments(visiblePayments(paymentResult.value.items ?? []));
      setPaymentCursor(paymentResult.value.hasNext ? paymentResult.value.nextCursor : null);
    }
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setError(errorMessage(failed.reason));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === 'mileage') {
        const next = await fetchMyMileageTransactions(mileagePage + 1, MILEAGE_PAGE_SIZE);
        setTransactions((current) => [...current, ...(next.content ?? [])]);
        setMileagePage((page) => page + 1);
        setMileageLast(next.last ?? true);
      } else if (paymentCursor) {
        const next = await fetchMyPayments(paymentCursor);
        setPayments((current) => [...current, ...visiblePayments(next.items ?? [])]);
        setPaymentCursor(next.hasNext ? next.nextCursor : null);
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRadioKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0;
    if (!step || products.length === 0) return;
    event.preventDefault();
    const nextIndex = (index + step + products.length) % products.length;
    setSelectedCode(products[nextIndex].productCode);
    radioRefs.current[nextIndex]?.focus();
  };

  const selectedProduct = products.find((product) => product.productCode === selectedCode) ?? null;
  const focusIndex = Math.max(0, products.findIndex((product) => product.productCode === selectedCode));
  const hasMore = tab === 'mileage' ? !mileageLast : Boolean(paymentCursor);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black dark:text-zinc-100">내 지갑</h1>
          <p className="mt-2 text-sm font-bold text-zinc-500">카카오페이로 충전하고 멘토링에 바로 사용하세요.</p>
        </div>
        <Link href="/membership" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-black text-black dark:border-neutral-700 dark:bg-neutral-900 dark:text-zinc-100">
          <Crown size={17} className="text-amber-600 dark:text-[#f5b93d]" /> 멤버십 혜택 <ChevronRight size={16} />
        </Link>
      </header>

      {returnTo ? (
        <p className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm font-bold text-zinc-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-zinc-300">
          충전 후 멘토링 신청으로 돌아갑니다.
        </p>
      ) : null}

      <section className="mt-7 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-zinc-500">현재 마일리지</p>
            <p className="mt-1 text-3xl font-black text-black dark:text-zinc-100 sm:text-4xl">
              {loading ? '—' : `${money(balance)} M`}
            </p>
            <p className="mt-2 text-xs font-bold text-zinc-400">멘토링 신청·환불·정산에 사용됩니다.</p>
          </div>
          <WalletCards className="text-zinc-400" size={30} aria-hidden="true" />
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-neutral-800">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">충전 금액 선택</p>
          <h2 id="charge-package-title" className="mt-1 text-xl font-black text-black dark:text-zinc-100">얼마를 충전할까요?</h2>
          {loading ? (
            <div className="grid min-h-44 place-items-center"><Loader2 className="animate-spin text-zinc-400" /></div>
          ) : products.length > 0 ? (
            <div role="radiogroup" aria-labelledby="charge-package-title" className="mt-5 grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-3">
              {products.map((product, index) => {
                const selected = product.productCode === selectedCode;
                return (
                  <button
                    type="button"
                    role="radio"
                    key={product.productCode}
                    ref={(element) => { radioRefs.current[index] = element; }}
                    aria-checked={selected}
                    tabIndex={index === focusIndex ? 0 : -1}
                    onClick={() => setSelectedCode(product.productCode)}
                    onKeyDown={(event) => handleRadioKeyDown(event, index)}
                    className={[
                      'relative flex min-h-16 items-center justify-between rounded-xl border px-4 py-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2',
                      selected
                        ? 'border-black bg-zinc-50 ring-1 ring-black dark:border-[#f5b93d] dark:bg-[#2a2112] dark:ring-[#f5b93d]'
                        : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-neutral-700 dark:bg-neutral-900',
                    ].join(' ')}
                  >
                    <span>
                      <strong className="block text-lg font-black text-black dark:text-zinc-100">{money(product.price)}원</strong>
                      <span className="mt-0.5 block text-xs font-bold text-zinc-500">→ {money(product.mileage ?? product.price)} M</span>
                    </span>
                    {selected ? (
                      <span className="grid size-6 place-items-center rounded-full bg-black text-white dark:bg-[#f5b93d] dark:text-black">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="mt-5 rounded-xl bg-zinc-50 p-5 text-sm font-bold text-zinc-500 dark:bg-neutral-800">
              현재 선택할 수 있는 충전 상품이 없습니다.
            </p>
          )}
          <p className="mt-3 text-xs font-bold text-zinc-400">1원당 1마일리지 적립 · 보너스 없음</p>
          {error ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
              <p className="text-xs font-bold text-red-600 dark:text-red-300">{error}</p>
              <button type="button" onClick={() => void loadWallet()} className="shrink-0 text-xs font-black text-red-600 dark:text-red-300">다시 시도</button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={!selectedProduct || selectedForPayment !== null}
            onClick={() => selectedProduct && setSelectedForPayment(selectedProduct)}
            className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-[#f5b93d] dark:text-black dark:disabled:bg-neutral-700 dark:disabled:text-zinc-400"
          >
            {selectedProduct ? `카카오페이로 ${money(selectedProduct.price)}원 결제` : '충전 금액을 선택해주세요'}
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div role="tablist" className="grid grid-cols-2 border-b border-zinc-100 p-1.5 dark:border-neutral-800">
          {(['mileage', 'payment'] as const).map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === item}
              key={item}
              onClick={() => setTab(item)}
              className={['h-10 rounded-xl text-sm font-black', tab === item ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black' : 'text-zinc-400'].join(' ')}
            >
              {item === 'mileage' ? '마일리지 내역' : '결제 내역'}
            </button>
          ))}
        </div>
        {tab === 'mileage' ? (
          transactions.length > 0 ? transactions.map((transaction) => (
            <HistoryRow
              key={transaction.id}
              title={transaction.typeDescription}
              description={`${transaction.description} · ${dateTime(transaction.createdAt)}`}
              amount={`${transaction.amount > 0 ? '+' : ''}${money(transaction.amount)} M`}
              positive={transaction.amount >= 0}
            />
          )) : <EmptyHistory loading={loading} message="마일리지 내역이 없습니다" />
        ) : payments.length > 0 ? payments.map((payment) => {
          const badge = PAYMENT_BADGE[payment.status];
          const method = payment.paymentMethodType ? METHOD_LABEL[payment.paymentMethodType] : null;
          return (
            <HistoryRow
              key={payment.orderId}
              title={payment.itemName}
              description={[dateTime(payment.approvedAt ?? payment.createdAt), method].filter(Boolean).join(' · ')}
              amount={`${money(payment.amount ?? 0)}원`}
              badge={badge}
            />
          );
        }) : <EmptyHistory loading={loading} message="결제 내역이 없습니다" />}
        {hasMore && !loading ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="flex h-12 w-full items-center justify-center gap-2 border-t border-zinc-100 text-sm font-black text-zinc-500 disabled:text-zinc-300 dark:border-neutral-800"
          >
            {loadingMore ? <Loader2 className="animate-spin" size={16} /> : null}
            더 보기
          </button>
        ) : null}
      </section>

      {selectedForPayment ? (
        <KakaoPaymentDialog product={selectedForPayment} returnTo={returnTo} onClose={() => setSelectedForPayment(null)} />
      ) : null}
    </div>
  );
}

function HistoryRow({ title, description, amount, positive, badge }: {
  title: string;
  description: string;
  amount: string;
  positive?: boolean;
  badge?: { label: string; className: string };
}) {
  return (
    <article className="flex items-center justify-between gap-4 border-b border-zinc-100 p-4 last:border-b-0 dark:border-neutral-800 sm:p-5">
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-2 text-sm font-black text-black dark:text-zinc-100">
          <span className="truncate">{title}</span>
          {badge ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${badge.className}`}>{badge.label}</span> : null}
        </p>
        <p className="mt-1 truncate text-xs font-bold text-zinc-400">{description}</p>
      </div>
      <strong className={['shrink-0 text-sm font-black', positive ? 'text-blue-600 dark:text-blue-300' : 'text-black dark:text-zinc-100'].join(' ')}>
        {amount}
      </strong>
    </article>
  );
}

function EmptyHistory({ loading, message }: { loading: boolean; message: string }) {
  return (
    <div className="grid min-h-32 place-items-center p-5 text-center text-sm font-bold text-zinc-400">
      {loading ? <Loader2 className="animate-spin" /> : <span className="inline-flex items-center gap-2"><RotateCcw size={16} /> {message}</span>}
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={null}>
      <WalletContent />
    </Suspense>
  );
}
