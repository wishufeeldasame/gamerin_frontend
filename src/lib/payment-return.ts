const RETURN_PREFIXES = ['/mentoring', '/membership', '/wallet'];
const RETURN_KEY = 'gamerin_payment_return_to';

/** 결제 후 돌아갈 내부 경로만 허용한다(08 문서 12-10절). 그 외에는 null. */
export function safeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return RETURN_PREFIXES.some((prefix) => value === prefix || value.startsWith(`${prefix}?`) || value.startsWith(`${prefix}/`))
    ? value
    : null;
}

// 모바일은 카카오페이를 거쳐 같은 탭으로 돌아오므로 주문별 복귀 경로를 탭 저장소에 둔다.
export function rememberPaymentReturnTo(orderId: string, returnTo: string | null) {
  try {
    if (returnTo) window.sessionStorage.setItem(RETURN_KEY, JSON.stringify({ orderId, returnTo }));
    else window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // 저장소를 쓸 수 없으면 복귀 버튼만 생략한다.
  }
}

export function readPaymentReturnTo(orderId: string) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(RETURN_KEY) ?? 'null') as { orderId?: unknown; returnTo?: unknown } | null;
    return saved?.orderId === orderId && typeof saved.returnTo === 'string' ? safeReturnTo(saved.returnTo) : null;
  } catch {
    return null;
  }
}
