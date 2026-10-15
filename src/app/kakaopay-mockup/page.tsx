'use client';

import Image from 'next/image';
import {
  BookOpen,
  Crown,
  FilePenLine,
  Moon,
  Sun,
  WalletCards,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchMyMileageBalance } from '@/lib/mileage-api';
import {
  cancelPayment,
  fetchMyPayments,
  fetchPaymentProducts,
  readyPayment,
  type PaymentProduct,
  type PaymentResponse,
} from '@/lib/payment-api';

type View = 'wallet' | 'membership' | 'mentoring' | 'post';
type PayStep = 'closed' | 'confirm' | 'processing';
const money = (value: number) => new Intl.NumberFormat('ko-KR').format(value);
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : '요청을 처리하지 못했어요.');
const statusBadge = (status: PaymentResponse['status']) =>
  status === 'APPROVED' ? '완료' : status === 'CANCELED' ? '취소됨' : '확인 중';
// PC·모바일 판정. PC는 팝업이 정책이지만 시험 연동은 같은 탭으로 이동한다.
const isMobileBrowser = () => /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);

export default function KakaoPayMockupPage() {
  const [view, setView] = useState<View>('wallet');
  const [dark, setDark] = useState(false);
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<PaymentProduct[]>([]);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const [amount, setAmount] = useState<number | null>(10_000);
  const [tab, setTab] = useState<'mileage' | 'payment'>('mileage');
  const [payStep, setPayStep] = useState<PayStep>('closed');
  const [member, setMember] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [savedPost, setSavedPost] = useState(
    '게임에서 기억에 남은 장면과 공략을 공유합니다. 함께 플레이할 분도 찾아요.',
  );
  const [draft, setDraft] = useState(savedPost);
  const [saving, setSaving] = useState(false);

  const move = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadWallet = useCallback(async () => {
    try {
      const [productList, mileage, paymentPage] = await Promise.all([
        fetchPaymentProducts(),
        fetchMyMileageBalance(),
        fetchMyPayments(),
      ]);
      setProducts(productList.filter((product) => product.purpose === 'MILEAGE_CHARGE'));
      setBalance(mileage.currentBalance);
      setPayments(paymentPage.items);
      setWalletError(null);
    } catch (error) {
      setWalletError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const selectedProduct = products.find((product) => product.price === amount) ?? null;

  const openPayment = () => {
    // 같은 결제 시도의 재요청은 같은 requestId로 보내 서버가 기존 주문을 재응답하게 한다.
    requestIdRef.current = crypto.randomUUID();
    setPayError(null);
    setPayStep('confirm');
  };

  const startPayment = async () => {
    if (!selectedProduct || !requestIdRef.current) return;
    setPayStep('processing');
    try {
      const order = await readyPayment(selectedProduct.productCode, requestIdRef.current);
      const url = isMobileBrowser() ? order.mobileUrl : order.pcUrl;
      if (!url) throw new Error('결제창을 열 수 없어요. 다시 결제해주세요.');
      window.location.assign(url);
    } catch (error) {
      setPayError(errorMessage(error));
      setPayStep('confirm');
    }
  };

  const cancel = async (payment: PaymentResponse) => {
    if (cancelingId || !window.confirm(`${payment.itemName} 결제를 취소할까요? 충전된 마일리지가 회수됩니다.`)) return;
    setCancelingId(payment.orderId);
    try {
      await cancelPayment(payment.orderId);
    } catch (error) {
      window.alert(errorMessage(error));
    } finally {
      setCancelingId(null);
      await loadWallet();
    }
  };

  const savePost = () => {
    if (draft === savedPost || saving) return;
    setSaving(true);
    window.setTimeout(() => {
      setSavedPost(draft);
      setSaving(false);
      setEditOpen(false);
    }, 650);
  };

  const menu: Array<{ id: View; label: string; icon: typeof WalletCards }> = [
    { id: 'wallet', label: '내 지갑', icon: WalletCards },
    { id: 'membership', label: '멤버십', icon: Crown },
    { id: 'mentoring', label: '멘토링', icon: BookOpen },
    { id: 'post', label: '게시물 수정', icon: FilePenLine },
  ];

  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen bg-white text-zinc-900 dark:bg-[#09090b] dark:text-zinc-100">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-zinc-100 bg-white/95 px-5 backdrop-blur lg:px-6 dark:border-zinc-800 dark:bg-zinc-900/95">
          <button type="button" onClick={() => move('wallet')} className="text-xl font-black">
            GamerIN
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-zinc-200 px-2.5 py-1.5 text-[10px] font-black tracking-widest text-zinc-500 sm:block dark:border-zinc-700">
              FRONT MOCKUP
            </span>
            <button
              type="button"
              onClick={() => setDark((current) => !current)}
              aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
              className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 dark:border-zinc-700"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <strong className="hidden text-sm sm:block">전준범</strong>
          </div>
        </header>

        <div className="lg:grid lg:min-h-[calc(100vh-64px)] lg:grid-cols-[256px_minmax(0,1fr)]">
          <aside className="sticky top-16 hidden h-[calc(100vh-64px)] flex-col justify-between border-r border-zinc-100 bg-white p-6 lg:flex dark:border-zinc-800 dark:bg-zinc-900">
            <nav className="space-y-2" aria-label="목업 화면 메뉴">
              {menu.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => move(item.id)}
                  className={`flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-sm font-black transition ${
                    view === item.id
                      ? 'bg-black text-white dark:bg-[#f5b93d] dark:text-black'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <item.icon size={19} />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800">
              <strong className="text-sm">전준범</strong>
              <span className="mt-2 block text-[11px] font-bold text-zinc-400">내 지갑</span>
              <b className="mt-1 block text-lg">{money(balance)} M</b>
            </div>
          </aside>

          <main>
            {view === 'wallet' ? (
              <Page eyebrow="WALLET" title="내 지갑">
                <section className="rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-xs font-black text-zinc-400">현재 마일리지</span>
                  <strong className="mt-2 block text-3xl font-black">{money(balance)} M</strong>
                  <p className="mt-2 text-sm font-bold text-zinc-500">멘토링 신청·환불·정산에 사용됩니다.</p>
                </section>

                <section className="space-y-[18px] rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <span className="text-[11px] font-black tracking-widest text-zinc-400">CHARGE</span>
                  <h2 className="text-[22px] font-black">충전할 금액을 선택해주세요</h2>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {products.map(({ price: item }) => {
                      const selected = item === amount;
                      return (
                        <button
                          type="button"
                          key={item}
                          onClick={() => setAmount(item)}
                          aria-pressed={selected}
                          className={`flex h-28 flex-col gap-2 rounded-2xl bg-white p-5 text-left dark:bg-zinc-900 ${
                            selected
                              ? 'border-2 border-amber-600 bg-zinc-50 p-[19px] dark:border-[#f5b93d] dark:bg-zinc-800'
                              : 'border border-zinc-100 dark:border-zinc-800'
                          }`}
                        >
                          <span className="flex items-center justify-between">
                            <strong className="text-xl font-black">{money(item)}원</strong>
                            <Image
                              src={selected ? '/kakaopay-mockup/radio-selected.svg' : '/kakaopay-mockup/radio-default.svg'}
                              alt=""
                              width={18}
                              height={18}
                            />
                          </span>
                          <small className="font-bold text-zinc-500">→ {money(item)} M</small>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs font-bold text-zinc-400">1원당 1마일리지 적립 · 보너스 없음</p>
                  {walletError ? <p className="text-sm font-bold text-red-500">{walletError}</p> : null}
                  <PrimaryButton disabled={!selectedProduct} onClick={openPayment}>
                    {selectedProduct ? `카카오페이로 ${money(selectedProduct.price)}원 결제` : '충전 금액을 선택해주세요'}
                  </PrimaryButton>
                </section>

                <div className="grid grid-cols-2 rounded-xl bg-zinc-50 p-1 dark:bg-zinc-800">
                  {(['mileage', 'payment'] as const).map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setTab(item)}
                      className={`h-10 rounded-lg text-sm font-black ${
                        tab === item ? 'bg-white shadow-sm dark:bg-zinc-900' : 'text-zinc-500'
                      }`}
                    >
                      {item === 'mileage' ? '마일리지 내역' : '결제 내역'}
                    </button>
                  ))}
                </div>
                <section className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-zinc-800">
                  {tab === 'mileage' ? (
                    <>
                      <History title="멘토링 정산" date="2026.10.12" amount="+ 9,500 M" />
                      <History title="멘토링 신청" date="2026.10.08" amount="- 10,000 M" />
                    </>
                  ) : (
                    payments.length === 0 ? (
                      <p className="bg-white p-5 text-sm font-bold text-zinc-400 dark:bg-zinc-900">결제 내역이 없습니다</p>
                    ) : (
                      payments.map((payment) => (
                        <History
                          key={payment.orderId}
                          title={payment.itemName}
                          date={`${new Date(payment.createdAt).toLocaleString('ko-KR')} · ${payment.paymentMethodType === 'MONEY' ? '카카오페이머니' : payment.paymentMethodType === 'CARD' ? '카드' : '카카오페이'}`}
                          amount={`${money(payment.amount ?? 0)}원`}
                          badge={statusBadge(payment.status)}
                          action={payment.status === 'APPROVED' ? (
                            // 시험용: 사용자 화면에는 취소 버튼을 두지 않는다(08 문서 12-1절).
                            <button type="button" disabled={cancelingId !== null} onClick={() => void cancel(payment)} className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-black disabled:opacity-50 dark:border-zinc-700">
                              {cancelingId === payment.orderId ? '취소 중…' : '결제 취소'}
                            </button>
                          ) : null}
                        />
                      ))
                    )
                  )}
                </section>
              </Page>
            ) : null}

            {view === 'membership' ? (
              <Page
                eyebrow="MEMBERSHIP"
                title={member ? '멤버십을 이용 중이에요' : '게임 생활을 더 가볍게'}
                subtitle={member ? '다음 결제일은 11월 14일입니다.' : '멤버십 회원만의 혜택을 확인해 보세요.'}
              >
                <section className="space-y-3 rounded-[20px] border border-zinc-100 bg-white px-7 py-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-600 dark:text-[#f5b93d]">
                    <Image src="/kakaopay-mockup/membership-crown.svg" alt="멤버십 회원" width={14} height={22} />
                    {member ? 'GAMERIN MEMBER' : 'MEMBERSHIP'}
                  </div>
                  <strong className="block text-[28px] font-black">{member ? '활성 멤버십' : '월 9,900원'}</strong>
                  <p className="text-sm text-zinc-500">
                    {member ? '광고 없는 탐색 · 전용 배지 · 우선 멘토링 알림' : '언제든 해지할 수 있으며 다음 결제일부터 적용됩니다.'}
                  </p>
                  <PrimaryButton onClick={() => setJoinOpen(true)}>
                    {member ? '결제 정보 관리' : '멤버십 시작하기'}
                  </PrimaryButton>
                </section>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ['광고 없이 집중', '피드와 상세 화면의 광고를 줄여요.'],
                    ['전용 프로필 배지', '닉네임 옆 왕관으로 멤버십을 표시해요.'],
                    ['빠른 알림', '새 멘토링 모집 소식을 먼저 확인해요.'],
                  ].map(([title, description]) => (
                    <article key={title} className="rounded-2xl border border-zinc-100 bg-white p-[18px] dark:border-zinc-800 dark:bg-zinc-900">
                      <div className="flex items-center gap-2">
                        <Image src="/kakaopay-mockup/benefit-dot.svg" alt="" width={20} height={20} />
                        <strong className="text-[15px] font-black">{title}</strong>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-zinc-500">{description}</p>
                    </article>
                  ))}
                </div>
              </Page>
            ) : null}

            {view === 'mentoring' ? (
              <Page eyebrow="MY MENTORING" title="내 멘토링">
                <section className="flex flex-col gap-5 rounded-2xl border border-zinc-100 bg-white p-6 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900">
                  <div>
                    <span className="text-xs font-black text-zinc-400">내 마일리지</span>
                    <strong className="mt-2 block text-3xl font-black">{money(balance)} M</strong>
                    <p className="mt-2 text-sm text-zinc-500">멘토링 신청·환불·정산에 사용됩니다.</p>
                  </div>
                  <PrimaryButton onClick={() => move('wallet')}>충전하기</PrimaryButton>
                </section>
                <section className="flex flex-col gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-[18px] sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-800">
                  <div><strong className="block text-sm">마일리지가 부족해요</strong><span className="mt-1 block text-xs text-zinc-500">요청을 수락하려면 10,000 M가 필요합니다.</span></div>
                  <PrimaryButton onClick={() => move('wallet')}>충전하기</PrimaryButton>
                </section>
                <h2 className="text-[22px] font-black">받은 멘토링 요청</h2>
                <section className="space-y-3 rounded-2xl border border-zinc-100 bg-white p-[22px] dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-lg font-black">랭크 게임 피드백 · 60분</h3>
                  <p className="text-sm text-zinc-500">신청자 게임초보99 · 오늘 20:00</p>
                  <div className="rounded-xl bg-zinc-50 p-3 text-[13px] font-black dark:bg-zinc-800">10,000 M 중 수수료 500 M(5%) · 수령 9,500 M</div>
                  <div className="rounded-xl bg-zinc-50 p-3 text-xs font-black text-amber-600 dark:bg-zinc-800 dark:text-[#f5b93d]">멤버십이면 수수료 5% <span className="ml-2 text-zinc-500">멤버십 혜택 보기 →</span></div>
                  <div className="grid gap-2 sm:grid-cols-[180px_1fr]"><SecondaryButton>거절</SecondaryButton><PrimaryButton>요청 수락</PrimaryButton></div>
                </section>
              </Page>
            ) : null}

            {view === 'post' ? (
              <Page eyebrow="POST DETAIL" title="내 게시물" subtitle="본인 게시물의 수정 흐름을 확인하는 목업입니다.">
                <article className="space-y-5 rounded-2xl border border-zinc-100 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-zinc-100 text-sm font-black dark:bg-zinc-800">전</span>
                    <div className="flex-1"><strong className="block text-sm">전준범</strong><small className="text-zinc-400">방금 전</small></div>
                    <button type="button" onClick={() => { setDraft(savedPost); setEditOpen(true); }} className="rounded-xl bg-zinc-50 px-4 py-2 text-xs font-black dark:bg-zinc-800">수정</button>
                  </div>
                  <p className="text-[17px] font-bold leading-7">{savedPost}</p>
                  <div className="grid h-64 place-items-center rounded-2xl bg-zinc-50 text-xs font-bold text-zinc-400 dark:bg-zinc-800">이미지·영상 영역</div>
                  <footer className="text-xs font-bold text-zinc-500">좋아요 24 · 댓글 7</footer>
                </article>
              </Page>
            ) : null}
          </main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-4 border-t border-zinc-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden dark:border-zinc-800 dark:bg-zinc-900/95">
          {menu.map((item) => (
            <button type="button" key={item.id} onClick={() => move(item.id)} className={`flex flex-col items-center justify-center gap-1 text-[10px] font-black ${view === item.id ? 'text-amber-600 dark:text-[#f5b93d]' : 'text-zinc-400'}`}>
              <item.icon size={20} />{item.label.replace('내 ', '').replace('게시물 ', '')}
            </button>
          ))}
        </nav>

        {payStep !== 'closed' ? (
          <Modal onClose={payStep === 'processing' ? undefined : () => setPayStep('closed')}>
            {payStep === 'confirm' ? (
              <>
                <span className="text-[11px] font-black tracking-widest text-zinc-400">KAKAOPAY</span>
                <h2 className="text-2xl font-black">카카오페이로 결제하기</h2>
                <div className="rounded-2xl border border-zinc-100 p-5 dark:border-zinc-800"><span className="text-xs text-zinc-500">결제 금액</span><strong className="mt-2 block text-3xl">{money(amount ?? 0)}원</strong></div>
                <p className="text-sm leading-6 text-zinc-500">결제 완료 후 {money(amount ?? 0)} M가 충전됩니다. 카카오페이 결제 화면으로 이동합니다.</p>
                {payError ? <p className="text-sm font-bold text-red-500">{payError}</p> : null}
                <PrimaryButton onClick={() => void startPayment()}>카카오페이 결제창으로 이동</PrimaryButton>
              </>
            ) : null}
            {payStep === 'processing' ? <Result title="결제를 준비하고 있어요" description="잠시 후 카카오페이 결제 화면으로 이동합니다." pending /> : null}
          </Modal>
        ) : null}

        {joinOpen ? (
          <Modal onClose={() => setJoinOpen(false)}>
            <span className="text-[11px] font-black tracking-widest text-zinc-400">MEMBERSHIP</span>
            <h2 className="text-2xl font-black">멤버십을 시작할까요?</h2>
            <p className="text-sm leading-6 text-zinc-500">월 9,900원이며, 이 목업에서는 실제 결제가 발생하지 않습니다.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]"><SecondaryButton onClick={() => setJoinOpen(false)}>취소</SecondaryButton><PrimaryButton onClick={() => { setMember(true); setJoinOpen(false); }}>목업 가입 완료</PrimaryButton></div>
          </Modal>
        ) : null}

        {editOpen ? (
          <Modal onClose={() => setEditOpen(false)}>
            <h2 className="text-2xl font-black">게시물 수정</h2>
            <strong className="text-xs text-zinc-500">남은 시간 42분</strong>
            <textarea value={draft} maxLength={1000} onChange={(event) => setDraft(event.target.value)} className="min-h-48 resize-y rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 outline-none focus:border-amber-600 dark:border-zinc-700 dark:bg-zinc-800" />
            <div className="text-right text-[11px] text-zinc-400">{draft.length} / 1000</div>
            <p className="text-xs leading-5 text-zinc-500">이미지·영상은 수정할 수 없어요.<br />게시물당 1회만 수정됩니다.</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_2fr]"><SecondaryButton onClick={() => setEditOpen(false)}>취소</SecondaryButton><PrimaryButton disabled={draft === savedPost || saving} onClick={savePost}>{saving ? '수정하는 중…' : '수정하기'}</PrimaryButton></div>
          </Modal>
        ) : null}
      </div>
    </div>
  );
}

function Page({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-[min(880px,calc(100%-40px))] flex-col gap-6 py-8 pb-28 lg:w-[min(880px,calc(100%-64px))] lg:py-12 lg:pb-20">
      <header className="space-y-2.5"><span className="text-[11px] font-black tracking-widest text-zinc-400">{eyebrow}</span><h1 className="text-[30px] font-black tracking-tight lg:text-4xl">{title}</h1>{subtitle ? <p className="text-sm text-zinc-500">{subtitle}</p> : null}</header>
      {children}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-5" onMouseDown={onClose}><section role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} className="relative flex max-h-[calc(100vh-40px)] w-full max-w-[480px] flex-col gap-4 overflow-y-auto rounded-[20px] border border-zinc-100 bg-white p-7 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">{onClose ? <button type="button" onClick={onClose} aria-label="닫기" className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-xl bg-zinc-50 dark:bg-zinc-800"><X size={18} /></button> : null}{children}</section></div>;
}

function Result({ title, description, pending = false, onDone }: { title: string; description: string; pending?: boolean; onDone?: () => void }) {
  return <div className="flex min-h-64 flex-col items-start justify-center gap-4">{pending ? <span className="h-[52px] w-[52px] animate-pulse rounded-full bg-amber-600" /> : <Image src="/kakaopay-mockup/status-success.svg" alt="결제 성공" width={52} height={52} />}<h2 className="text-[22px] font-black">{title}</h2><p className="text-sm leading-6 text-zinc-500">{description}</p>{onDone ? <PrimaryButton onClick={onDone}>내 지갑 보기</PrimaryButton> : null}</div>;
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-black px-5 text-sm font-black text-white transition hover:-translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-[#f5b93d] dark:text-black dark:disabled:bg-zinc-700">{children}</button>;
}

function SecondaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 px-5 text-sm font-black dark:border-zinc-700 dark:bg-zinc-800">{children}</button>;
}

function History({ title, date, amount, badge, action }: { title: string; date: string; amount: string; badge?: string; action?: React.ReactNode }) {
  return <div className="flex items-center justify-between border-b border-zinc-100 bg-white p-5 last:border-b-0 dark:border-zinc-800 dark:bg-zinc-900"><div><strong className="block text-sm">{title}</strong><span className="mt-1 block text-[11px] text-zinc-400">{date}</span></div><div className="flex items-center gap-2">{badge ? <em className="rounded-full bg-black px-2 py-1 text-[10px] font-black not-italic text-white dark:bg-white dark:text-black">{badge}</em> : null}<b className="text-sm">{amount}</b>{action}</div></div>;
}
