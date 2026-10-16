'use client';

import Link from 'next/link';
import { Check, ChevronRight, Crown, Loader2, RotateCcw, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchMyMileageBalance, fetchMyMileageTransactions, type MileageTransactionResponse } from '@/lib/mileage-api';
import { fetchMyPayments, fetchPaymentProducts, type PaymentProduct, type PaymentResponse } from '@/lib/payment-api';
import { KakaoPaymentDialog } from './_components/KakaoPaymentDialog';

type HistoryTab = 'mileage' | 'payment';
const money = (value: number) => Number(value || 0).toLocaleString('ko-KR');
const dateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
};
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '지갑 정보를 불러오지 못했어요.';
const paymentStatus = (status: PaymentResponse['status']) => {
  if (status === 'APPROVED') return '완료';
  if (status === 'CANCELED') return '취소';
  if (status === 'FAILED' || status === 'EXPIRED') return '실패';
  return '확인 중';
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [transactions, setTransactions] = useState<MileageTransactionResponse[]>([]);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [selectedForPayment, setSelectedForPayment] = useState<PaymentProduct | null>(null);
  const [tab, setTab] = useState<HistoryTab>('mileage');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      fetchPaymentProducts(),
      fetchMyMileageBalance(),
      fetchMyMileageTransactions(0, 10),
      fetchMyPayments(),
    ]);
    const [productResult, balanceResult, transactionResult, paymentResult] = results;
    if (productResult.status === 'fulfilled') {
      const chargeProducts = productResult.value.filter((product) => product.purpose === 'MILEAGE_CHARGE');
      setProducts(chargeProducts);
      setSelectedCode((current) =>
        current && chargeProducts.some((product) => product.productCode === current)
          ? current
          : chargeProducts[0]?.productCode ?? null,
      );
    }
    if (balanceResult.status === 'fulfilled') setBalance(balanceResult.value.currentBalance ?? 0);
    if (transactionResult.status === 'fulfilled') setTransactions(transactionResult.value.content ?? []);
    if (paymentResult.status === 'fulfilled') setPayments(paymentResult.value.items ?? []);
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') setError(errorMessage(failed.reason));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const selectedProduct = products.find((product) => product.productCode === selectedCode) ?? null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black dark:text-zinc-100">내 지갑</h1>
          <p className="mt-2 text-sm font-bold text-zinc-500">카카오페이로 충전하고 멘토링에 바로 사용하세요.</p>
        </div>
        <Link href="/membership" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e7c16e] bg-[#fff9e9] px-4 text-sm font-black text-[#80550c] dark:border-[#80550c] dark:bg-[#2a2112] dark:text-[#f5b93d]">
          <Crown size={17} /> 멤버십 혜택 <ChevronRight size={16} />
        </Link>
      </header>

      <section className="mt-7 rounded-3xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-zinc-500">현재 마일리지</p>
            <p className="mt-1 text-3xl font-black text-black dark:text-zinc-100 sm:text-4xl">
              {loading ? '—' : money(balance) + ' M'}
            </p>
          </div>
          <WalletCards className="text-[#d69a1f]" size={30} aria-hidden="true" />
        </div>

        <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-neutral-800">
          <p className="text-xs font-black tracking-[0.18em] text-zinc-400">충전 금액 선택</p>
          <h2 className="mt-1 text-xl font-black text-black dark:text-zinc-100">얼마를 충전할까요?</h2>
          {loading ? (
            <div className="grid min-h-44 place-items-center"><Loader2 className="animate-spin text-zinc-400" /></div>
          ) : products.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              {products.map((product) => {
                const selected = product.productCode === selectedCode;
                return (
                  <button
                    type="button"
                    key={product.productCode}
                    onClick={() => setSelectedCode(product.productCode)}
                    aria-pressed={selected}
                    className={[
                      'relative min-h-[76px] rounded-2xl border px-3 py-3 text-left transition sm:min-h-24 sm:px-4',
                      selected
                        ? 'border-[#d69a1f] bg-[#fff9e9] ring-1 ring-[#d69a1f] dark:bg-[#2a2112]'
                        : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-neutral-700 dark:bg-neutral-900',
                    ].join(' ')}
                  >
                    <strong className="block text-base font-black text-black dark:text-zinc-100 sm:text-lg">
                      {money(product.price)}원
                    </strong>
                    <span className="mt-1 block text-[11px] font-bold text-zinc-500">
                      {money(product.mileage ?? product.price)} M
                    </span>
                    {selected ? (
                      <span className="absolute right-2.5 top-2.5 grid size-5 place-items-center rounded-full bg-[#f5b93d] text-black">
                        <Check size={13} strokeWidth={3} />
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
          {error ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3 dark:bg-red-950/30">
              <p className="text-xs font-bold text-red-600 dark:text-red-300">{error}</p>
              <button type="button" onClick={() => void loadWallet()} className="shrink-0 text-xs font-black text-red-600 dark:text-red-300">다시 시도</button>
            </div>
          ) : null}
          <button
            type="button"
            disabled={!selectedProduct}
            onClick={() => selectedProduct && setSelectedForPayment(selectedProduct)}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#f5b93d] px-5 text-sm font-black text-black transition hover:bg-[#e7aa2e] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:disabled:bg-neutral-700"
          >
            {selectedProduct ? '카카오페이로 ' + money(selectedProduct.price) + '원 결제' : '충전 금액을 선택해주세요'}
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid grid-cols-2 border-b border-zinc-100 p-1.5 dark:border-neutral-800">
          {(['mileage', 'payment'] as const).map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setTab(item)}
              className={['h-10 rounded-xl text-sm font-black', tab === item ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black' : 'text-zinc-400'].join(' ')}
            >
              {item === 'mileage' ? '마일리지 내역' : '카카오페이 결제 내역'}
            </button>
          ))}
        </div>
        {tab === 'mileage' ? (
          transactions.length > 0 ? transactions.map((transaction) => (
            <HistoryRow
              key={transaction.id}
              title={transaction.typeDescription}
              description={transaction.description + ' · ' + dateTime(transaction.createdAt)}
              amount={(transaction.amount > 0 ? '+' : '') + money(transaction.amount) + ' M'}
              positive={transaction.amount >= 0}
            />
          )) : <EmptyHistory loading={loading} />
        ) : payments.length > 0 ? payments.map((payment) => (
          <HistoryRow
            key={payment.orderId}
            title={payment.itemName}
            description={dateTime(payment.createdAt) + ' · ' + paymentStatus(payment.status)}
            amount={money(payment.amount ?? 0) + '원'}
          />
        )) : <EmptyHistory loading={loading} />}
      </section>

      {selectedForPayment ? <KakaoPaymentDialog product={selectedForPayment} onClose={() => setSelectedForPayment(null)} /> : null}
    </div>
  );
}

function HistoryRow({ title, description, amount, positive }: {
  title: string;
  description: string;
  amount: string;
  positive?: boolean;
}) {
  return (
    <article className="flex items-center justify-between gap-4 border-b border-zinc-100 p-4 last:border-b-0 dark:border-neutral-800 sm:p-5">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-black dark:text-zinc-100">{title}</p>
        <p className="mt-1 truncate text-xs font-bold text-zinc-400">{description}</p>
      </div>
      <strong className={['shrink-0 text-sm font-black', positive ? 'text-blue-600 dark:text-blue-300' : 'text-black dark:text-zinc-100'].join(' ')}>
        {amount}
      </strong>
    </article>
  );
}

function EmptyHistory({ loading }: { loading: boolean }) {
  return (
    <div className="grid min-h-32 place-items-center p-5 text-center text-sm font-bold text-zinc-400">
      {loading ? <Loader2 className="animate-spin" /> : <span className="inline-flex items-center gap-2"><RotateCcw size={16} /> 내역이 없습니다.</span>}
    </div>
  );
}
