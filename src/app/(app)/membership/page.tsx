'use client';

import { BadgePercent, Crown, Loader2, PencilLine } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { fetchMyMembership, type MyMembership } from '@/lib/membership-api';
import { fetchPaymentProducts, type PaymentProduct } from '@/lib/payment-api';
import { KakaoPaymentDialog } from '../wallet/_components/KakaoPaymentDialog';

const DAY_MS = 24 * 60 * 60 * 1000;
const CANCEL_IN_PROGRESS_MESSAGE = '이전 결제 취소를 처리하고 있습니다. 잠시 후 다시 시도해주세요.';

// 혜택 문구는 정책(README 확정 표)과 같게 둔다. 서버 benefits는 요약 문자열이라 화면 설명은 여기서 붙인다.
const benefits = [
  { icon: Crown, title: '닉네임 옆 멤버십 배지', description: '프로필이 보이는 모든 화면에서 왕관 배지가 표시돼요.' },
  { icon: PencilLine, title: '게시물 1회 수정', description: '게시 후 1시간 이내, 게시물당 1번 본문을 수정할 수 있어요.' },
  { icon: BadgePercent, title: '멘토 정산 수수료 10% → 5%', description: '멘토로 받은 멘토링의 GamerIN 정산 수수료가 낮아져요.' },
];

function formatDate(value: Date | string | null) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function MembershipPage() {
  const [product, setProduct] = useState<PaymentProduct | null>(null);
  const [membership, setMembership] = useState<MyMembership | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [products, mine] = await Promise.all([fetchPaymentProducts(), fetchMyMembership()]);
      setProduct(products.find((item) => item.purpose === 'MEMBERSHIP_PASS') ?? null);
      setMembership(mine);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '멤버십 정보를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = membership?.active === true;
  const expired = !active && Boolean(membership?.expiresAt);
  const durationDays = product?.durationDays ?? membership?.durationDays ?? null;
  // 안내용 예상값. 실제 만료일은 결제 후 서버 응답을 따른다.
  const nextExpiry = active && membership?.expiresAt && durationDays
    ? new Date(Math.max(Date.now(), new Date(membership.expiresAt).getTime()) + durationDays * DAY_MS)
    : null;
  const priceLabel = product ? `${product.price.toLocaleString('ko-KR')}원` : '';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6 sm:py-10">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">GamerIN Membership</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight text-black dark:text-zinc-100">GamerIN 멤버십</h1>
      </header>

      <section className="mt-7 rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:p-7">
        {loading ? (
          <div className="grid min-h-40 place-items-center" aria-live="polite">
            <Loader2 className="animate-spin text-zinc-400" aria-label="멤버십 정보를 불러오는 중" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm font-bold text-red-600 dark:text-red-300">{error}</p>
            <button type="button" onClick={() => void load()} className="h-11 rounded-xl border border-zinc-200 px-4 text-sm font-black dark:border-neutral-700">
              다시 시도
            </button>
          </div>
        ) : (
          <>
            {active ? (
              <>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-black dark:bg-[#2a2112] dark:text-[#f5b93d]">
                  <Crown size={14} className="text-amber-600 dark:text-[#f5b93d]" aria-hidden="true" /> 이용 중
                </p>
                <p className="mt-4 text-2xl font-black text-black dark:text-zinc-100">만료일 {formatDate(membership?.expiresAt ?? null)}</p>
                {nextExpiry ? (
                  <p className="mt-2 text-sm font-bold text-zinc-500">지금 재구매하면 → {formatDate(nextExpiry)}</p>
                ) : null}
                <p className="mt-1 text-xs font-bold text-zinc-400">기간이 남아 있어도 구매하면 만료일에 {durationDays ?? 30}일이 더해져요.</p>
              </>
            ) : (
              <>
                {expired ? (
                  <p className="text-sm font-bold text-zinc-500">{formatDate(membership?.expiresAt ?? null)}에 만료되었어요</p>
                ) : null}
                <p className="mt-1 text-2xl font-black text-black dark:text-zinc-100">
                  {durationDays ?? 30}일 이용권 {priceLabel}
                </p>
                <p className="mt-2 text-sm font-bold text-zinc-500">자동 갱신 없음 · 직접 재구매</p>
              </>
            )}
            <button
              type="button"
              disabled={!product || paymentOpen}
              onClick={() => setPaymentOpen(true)}
              className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-black px-6 text-sm font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-[#f5b93d] dark:text-black sm:w-auto"
            >
              {!product
                ? '현재 구매할 수 없어요'
                : active
                  ? `${durationDays ?? 30}일 연장하기 ${priceLabel}`
                  : `카카오페이로 ${priceLabel} 결제`}
            </button>
          </>
        )}
      </section>

      <section className="mt-6 grid gap-3 lg:grid-cols-3">
        {benefits.map((benefit) => (
          <article key={benefit.title} className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <benefit.icon size={20} className="text-amber-600 dark:text-[#f5b93d]" aria-hidden="true" />
            <h2 className="mt-3 text-base font-black text-black dark:text-zinc-100">{benefit.title}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{benefit.description}</p>
          </article>
        ))}
      </section>

      <div className="mt-5 space-y-1 text-center text-xs font-bold text-zinc-400">
        <p>멘티 결제 금액은 바뀌지 않습니다.</p>
        <p>GamerIN 정산 수수료 할인이며 카카오페이 수수료와 무관합니다.</p>
      </div>

      {paymentOpen && product ? (
        <KakaoPaymentDialog
          product={product}
          conflictMessage={CANCEL_IN_PROGRESS_MESSAGE}
          onClose={() => setPaymentOpen(false)}
        />
      ) : null}
    </div>
  );
}
