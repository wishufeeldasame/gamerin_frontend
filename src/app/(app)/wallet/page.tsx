'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Crown, Loader2 } from 'lucide-react';
import { Suspense, useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { fetchMyMileageBalance, fetchMyMileageTransactions, type MileageTransactionResponse } from '@/lib/mileage-api';
import { fetchMyPayments, fetchPaymentProducts, type PaymentProduct, type PaymentResponse } from '@/lib/payment-api';
import { canGoBack } from '@/lib/history-back';
import { safeReturnTo } from '@/lib/payment-return';
import { KakaoPaymentDialog } from './_components/KakaoPaymentDialog';
import { ChargeProductsSkeleton } from '@/app/home/components/LoadingSkeletons';

type HistoryTab = 'mileage' | 'payment';
const HISTORY_TABS = [
  { name: 'mileage', label: '마일리지 내역' },
  { name: 'payment', label: '결제 내역' },
] as const;
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';
const MILEAGE_PAGE_SIZE = 10;
const money = (value: number) => Number(value || 0).toLocaleString('ko-KR');
const dateTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '지갑 정보를 불러오지 못했습니다.';

// 08 문서 12-7절. CREATED·READY·FAILED·EXPIRED는 결제가 일어나지 않아 목록에서 뺀다.
const PAYMENT_BADGE: Partial<Record<PaymentResponse['status'], { label: string; className: string }>> = {
  APPROVED: { label: '완료', className: 'bg-success-subtle text-green-800 dark:text-fg-success' },
  CANCELED: { label: '취소됨', className: 'bg-subtle text-fg-secondary' },
  APPROVING: { label: '확인 중', className: 'bg-brand-subtle text-fg-brand' },
  CANCELING: { label: '확인 중', className: 'bg-brand-subtle text-fg-brand' },
  NEEDS_REVIEW: { label: '확인 중', className: 'bg-brand-subtle text-fg-brand' },
};
const METHOD_LABEL: Record<string, string> = { CARD: '카드', MONEY: '카카오페이머니' };
const visiblePayments = (items: PaymentResponse[]) => items.filter((item) => PAYMENT_BADGE[item.status]);

function WalletContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const historyId = useId();
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
    <>
      <header className="sticky top-0 z-20 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 bg-canvas px-2 pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          type="button"
          aria-label="뒤로"
          className={`btn-icon ${FOCUS_RING}`}
          onClick={() => {
            if (canGoBack()) router.back();
            else router.replace('/profile');
          }}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1 className="text-heading text-fg-primary">내 지갑</h1>
      </header>

      {/* 로딩 때도 높이를 유지해 스크롤바가 사라지지 않게 한다. */}
      <div className={`relative mx-4 max-w-[940px] pb-6 pt-1 md:mx-6 lg:pt-6 xl:mr-0 ${loading ? 'min-h-[100dvh]' : ''}`}>
        <header className="mb-5 hidden lg:block xl:pr-40">
          <h1 className="text-title text-fg-primary">내 지갑</h1>
          <p className="mt-1 text-body text-fg-secondary">카카오페이로 충전하고 멘토링에 바로 사용하세요.</p>
        </header>

        {returnTo ? (
          <p className="mb-4 rounded-control bg-brand-subtle p-3 text-label text-fg-brand">
            충전 후 멘토링 신청으로 돌아갑니다.
          </p>
        ) : null}

        {error ? (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-control bg-danger-subtle p-3 text-label text-red-700 dark:text-fg-danger">
            <p className="min-w-0 [overflow-wrap:anywhere]">{error}</p>
            <button type="button" onClick={() => void loadWallet()} className={`shrink-0 rounded-control underline ${FOCUS_RING}`}>다시 시도</button>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start xl:gap-5">
          <div className="min-w-0 space-y-4">
            <section className="rounded-card border border-line-card bg-surface px-5 py-4 xl:px-6 xl:py-5">
              <h2 className="text-label text-fg-secondary">현재 마일리지</h2>
              <p className="mt-1 break-words text-display text-fg-primary">
                {loading ? '—' : `${money(balance)} M`}
              </p>
            </section>

            <Link
              href="/membership"
              className={`flex min-h-12 items-center gap-2 rounded-card border border-line-card bg-surface px-4 text-label text-fg-primary transition hover:bg-subtle xl:absolute xl:right-0 xl:top-6 xl:min-h-10 xl:rounded-control xl:px-3 ${FOCUS_RING}`}
            >
              <Crown size={17} className="shrink-0 text-fg-brand" aria-hidden="true" />
              <span className="flex-1 font-semibold">멤버십 혜택</span>
              <ChevronRight size={16} className="shrink-0 text-icon-secondary" aria-hidden="true" />
            </Link>

            <section className="rounded-card border border-line-card bg-surface p-4 xl:p-6">
              <p className="hidden text-caption text-fg-tertiary xl:block">충전 금액 선택</p>
              <h2 id="charge-package-title" className="text-heading text-fg-primary xl:mt-1">얼마를 충전할까요?</h2>
              {loading ? (
                <ChargeProductsSkeleton />
              ) : products.length > 0 ? (
                <div role="radiogroup" aria-labelledby="charge-package-title" className="mt-3 grid grid-cols-2 gap-2.5 xl:mt-4 xl:gap-3">
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
                        className={`relative min-h-[72px] min-w-0 rounded-xl border px-3 py-3 text-left transition xl:px-4 ${FOCUS_RING} ${
                          selected ? 'border-fg-brand bg-brand-subtle dark:border-brand' : 'border-line bg-subtle hover:border-line-strong'
                        }`}
                      >
                        <strong className="block break-words text-heading text-fg-primary">{money(product.price)}원</strong>
                        <span className={`mt-0.5 block break-words text-caption ${selected ? 'text-fg-brand' : 'text-fg-secondary'}`}>
                          → {money(product.mileage ?? product.price)} M
                        </span>
                        {selected ? (
                          <Check size={12} className="absolute right-1.5 top-1.5 text-fg-brand" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 rounded-control bg-subtle p-4 text-body text-fg-secondary">
                  현재 선택할 수 있는 충전 상품이 없습니다.
                </p>
              )}
              <p className="mt-3 text-caption text-fg-tertiary">1원당 1마일리지 적립 · 보너스 없음</p>
              <button
                type="button"
                disabled={!selectedProduct || selectedForPayment !== null}
                onClick={() => selectedProduct && setSelectedForPayment(selectedProduct)}
                className={`mt-3 inline-flex h-[50px] w-full shrink-0 items-center justify-center rounded-control bg-brand px-2 text-body font-medium text-fg-on-brand transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-tertiary ${FOCUS_RING}`}
              >
                {selectedProduct ? `카카오페이로 ${money(selectedProduct.price)}원 결제` : '충전 금액을 선택해 주세요'}
              </button>
            </section>
          </div>

          <section className="min-w-0 xl:rounded-card xl:border xl:border-line-card xl:bg-surface xl:px-6 xl:py-4">
            <div role="tablist" aria-label="지갑 내역" className="flex gap-6 border-b border-line">
              {HISTORY_TABS.map(({ name, label }) => (
                <button
                  type="button"
                  role="tab"
                  id={`${historyId}-tab-${name}`}
                  aria-selected={tab === name}
                  aria-controls={`${historyId}-panel-${name}`}
                  tabIndex={tab === name ? 0 : -1}
                  key={name}
                  onClick={() => setTab(name)}
                  onFocus={() => setTab(name)}
                  onKeyDown={(event) => {
                    const next = event.key === 'Home' ? 'mileage' : event.key === 'End' ? 'payment'
                      : event.key === 'ArrowLeft' || event.key === 'ArrowRight'
                        ? (name === 'mileage' ? 'payment' : 'mileage') : null;
                    if (!next) return;
                    event.preventDefault();
                    document.getElementById(`${historyId}-tab-${next}`)?.focus();
                  }}
                  className={`h-11 border-b-2 text-body transition-colors ${FOCUS_RING} ${
                    tab === name ? 'border-brand font-semibold text-fg-primary' : 'border-transparent text-fg-secondary hover:text-fg-primary'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {HISTORY_TABS.map(({ name }) => (
              <div
                key={name}
                role="tabpanel"
                id={`${historyId}-panel-${name}`}
                aria-labelledby={`${historyId}-tab-${name}`}
                hidden={tab !== name}
                tabIndex={0}
                className={FOCUS_RING}
              >
                {tab === name ? (
                  <>
                    {name === 'mileage' ? (
                      transactions.length > 0 ? transactions.map((transaction) => (
                        <HistoryRow
                          key={transaction.id}
                          title={transaction.typeDescription}
                          description={[transaction.description, dateTime(transaction.createdAt)].filter(Boolean).join(' · ')}
                          amount={`${transaction.amount > 0 ? '+' : ''}${money(transaction.amount)} M`}
                          positive={transaction.amount > 0}
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
                        className={`btn-secondary mt-3 w-full ${FOCUS_RING}`}
                      >
                        {loadingMore ? <Loader2 className="motion-safe:animate-spin" size={16} aria-hidden="true" /> : null}
                        더 보기
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ))}
          </section>
        </div>

        {selectedForPayment ? (
          <KakaoPaymentDialog product={selectedForPayment} returnTo={returnTo} onClose={() => setSelectedForPayment(null)} />
        ) : null}
      </div>
    </>
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
    <article className="flex items-center justify-between gap-3 border-b border-line py-3">
      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-body font-medium text-fg-primary">
          <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
          {badge ? <span className={`shrink-0 rounded-full px-2 py-0.5 text-caption ${badge.className}`}>{badge.label}</span> : null}
        </p>
        <p className="text-caption text-fg-tertiary [overflow-wrap:anywhere]">{description}</p>
      </div>
      <strong className={['shrink-0 text-body font-medium tabular-nums', positive ? 'text-green-800 dark:text-fg-success' : 'text-fg-primary'].join(' ')}>
        {amount}
      </strong>
    </article>
  );
}

function EmptyHistory({ loading, message }: { loading: boolean; message: string }) {
  return (
    <div className="grid min-h-32 place-items-center p-5 text-center text-body text-fg-secondary">
      {loading ? (
        <span role="status"><Loader2 className="motion-safe:animate-spin" aria-hidden="true" /><span className="sr-only">내역을 불러오는 중</span></span>
      ) : message}
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <WalletContent />
    </Suspense>
  );
}
