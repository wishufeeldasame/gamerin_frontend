'use client';

import { ArrowUpRight, BadgeCheck, BadgePercent, Ban, ChevronLeft, Clock, Crown, Loader2, Newspaper, PencilLine, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { fetchMyMembership, type MyMembership } from '@/lib/membership-api';
import { fetchPaymentProducts, type PaymentProduct } from '@/lib/payment-api';
import { KakaoPaymentDialog } from '../wallet/_components/KakaoPaymentDialog';
import { canGoBack } from '@/lib/history-back';

const DAY_MS = 24 * 60 * 60 * 1000;
const CANCEL_IN_PROGRESS_MESSAGE = '이전 결제 취소를 처리하고 있습니다. 잠시 후 다시 시도해 주세요.';
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand dark:focus-visible:outline-line-focus';

// 혜택 문구는 정책(README 확정 표)과 같게 둔다. 서버 benefits는 요약 문자열이라 화면 설명은 여기서 붙인다.
const benefits = [
  { icon: BadgeCheck, title: '닉네임 옆 멤버십 배지', description: '프로필이 보이는 모든 화면에서 노란 체크 배지가 표시됩니다.' },
  { icon: PencilLine, title: '게시글 1회 수정', description: '게시 후 1시간 이내, 게시글당 1번 본문을 수정할 수 있습니다.' },
  { icon: BadgePercent, title: '멘토 정산 수수료 10% → 5%', description: '멘토로 진행한 멘토링의 GamerIN 정산 수수료가 낮아집니다.' },
];

const upcomingBenefits = [
  { icon: Newspaper, title: '멤버십 전용 콘텐츠', description: '한 주의 전적과 게임별 패치 소식을 한눈에 확인하세요.', preview: true },
  { icon: Video, title: '고화질 영상 업로드', description: '선명한 화질로 플레이의 순간을 공유하세요.', preview: false },
  { icon: Ban, title: '광고 제거', description: '광고 없이 피드와 콘텐츠에 집중하세요.', preview: false },
];

function formatDate(value: Date | string | null) {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function MembershipPage() {
  const router = useRouter();
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
      setError(caught instanceof Error ? caught.message : '멤버십 정보를 불러오지 못했습니다.');
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
    <>
      <header className="sticky top-0 z-20 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-2 bg-canvas px-2 pt-[env(safe-area-inset-top)] lg:hidden">
        <button
          type="button"
          aria-label="뒤로"
          className={`btn-icon ${FOCUS_RING}`}
          onClick={() => {
            if (canGoBack()) router.back();
            else router.replace('/wallet');
          }}
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h1 className="text-heading text-fg-primary">GamerIN 멤버십</h1>
      </header>

      <div className="mx-4 max-w-[940px] pb-6 pt-1 md:mx-6 lg:pt-6 xl:mr-0">
        <header className="mb-4 hidden lg:block">
          <h1 className="text-title text-fg-primary">GamerIN 멤버십</h1>
        </header>

        <div className="max-w-[640px] space-y-4">
          <section className="rounded-card border border-line-card bg-surface p-5 sm:p-7">
            {loading ? (
              <div role="status" className="grid min-h-40 place-items-center">
                <Loader2 className="animate-spin text-icon-secondary" aria-hidden="true" />
                <span className="sr-only">멤버십 정보를 불러오는 중</span>
              </div>
            ) : error ? (
              <div role="alert" className="flex flex-col items-start gap-3">
                <p className="break-words text-body text-fg-danger">{error}</p>
                <button type="button" onClick={() => void load()} className="btn-secondary">
                  다시 시도
                </button>
              </div>
            ) : (
              <>
                {active ? (
                  <>
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-subtle px-3 py-1 text-caption text-fg-brand">
                      <Crown size={14} aria-hidden="true" /> 이용 중
                    </p>
                    <h2 className="mt-4 text-title text-fg-primary">만료일 {formatDate(membership?.expiresAt ?? null)}</h2>
                    {nextExpiry ? (
                      <p className="mt-2 text-body text-fg-secondary">지금 구매하면 만료일이 {formatDate(nextExpiry)}로 연장됩니다.</p>
                    ) : null}
                    <p className="mt-2 text-caption text-fg-secondary">기간이 남아 있어도 구매하면 만료일에 {durationDays ?? 30}일이 더해집니다.</p>
                  </>
                ) : (
                  <>
                    {expired ? (
                      <p className="mb-2 text-body text-fg-secondary">{formatDate(membership?.expiresAt ?? null)}에 만료되었습니다</p>
                    ) : null}
                    <h2 className="text-title text-fg-primary">
                      {durationDays ?? 30}일 이용권 {priceLabel}
                    </h2>
                    <p className="mt-2 text-body text-fg-secondary">자동 갱신 없음 · 직접 재구매</p>
                  </>
                )}
                <button
                  type="button"
                  disabled={!product || paymentOpen}
                  onClick={() => setPaymentOpen(true)}
                  className={`mt-6 inline-flex h-[50px] w-full items-center justify-center rounded-control bg-brand px-4 text-label text-fg-on-brand transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-tertiary sm:w-auto ${FOCUS_RING}`}
                >
                  {!product
                    ? '현재 구매할 수 없습니다'
                    : active
                      ? `${durationDays ?? 30}일 연장하기 ${priceLabel}`
                      : `카카오페이로 ${priceLabel} 결제`}
                </button>
              </>
            )}
          </section>

          <section className="rounded-card border border-line-card bg-surface p-4 sm:p-7" aria-labelledby="membership-benefits-title">
            <h2 id="membership-benefits-title" className="text-heading text-fg-primary">멤버십 혜택</h2>
            <ul className="mt-4 space-y-6 sm:space-y-7">
              {benefits.map((benefit) => (
                <li key={benefit.title} className="flex items-start gap-3 sm:gap-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-subtle text-fg-brand">
                    <benefit.icon size={20} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-label text-fg-primary">{benefit.title}</h3>
                    <p className="mt-1 text-body text-fg-secondary">{benefit.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1 border-t border-line pt-3 text-caption text-fg-secondary">
              <p>멘티 결제 금액은 바뀌지 않습니다.</p>
              <p>GamerIN 정산 수수료 할인이며 카카오페이 수수료와 무관합니다.</p>
            </div>
          </section>

          <section aria-labelledby="membership-upcoming-title" className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Clock size={18} className="text-icon-secondary" aria-hidden="true" />
              <h2 id="membership-upcoming-title" className="text-heading text-fg-primary">앞으로 만날 혜택</h2>
            </div>
            <ul className="space-y-3">
              {upcomingBenefits.map((benefit) => (
                <li key={benefit.title} className="rounded-card border border-line-card bg-surface p-5 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-subtle text-fg-brand">
                      <benefit.icon size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="rounded-full bg-subtle px-2 py-1 text-caption text-fg-secondary">지원 예정</span>
                      <h3 className="mt-2 text-heading text-fg-primary">{benefit.title}</h3>
                      <p className="mt-1 text-body text-fg-secondary">{benefit.description}</p>
                      {benefit.preview ? (
                        <button type="button" onClick={() => router.push('/membership/content')} className={`btn-secondary mt-4 inline-flex items-center gap-2 ${FOCUS_RING}`}>
                          미리보기 <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {paymentOpen && product ? (
        <KakaoPaymentDialog
          product={product}
          conflictMessage={CANCEL_IN_PROGRESS_MESSAGE}
          onClose={() => setPaymentOpen(false)}
        />
      ) : null}
    </>
  );
}
