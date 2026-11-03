// 08 문서 12-6절: PC는 팝업, 모바일 웹은 페이지 이동. 판정은 이 함수 하나로 통일한다.
export function isMobileBrowser() {
  const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  return typeof hint === 'boolean' ? hint : /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
}

/** 결제 요청 ID. randomUUID는 보안 컨텍스트(HTTPS·localhost)에서만 있으므로 HTTP 배포용 v4 대체를 둔다. */
export function createRequestId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** 같은 origin 창이 이 창을 팝업으로 열었는지. 다른 origin opener는 접근 시 예외가 난다. */
export function isSameOriginOpener() {
  try {
    return Boolean(window.opener) && window.opener !== window && window.opener.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

export const PAYMENT_RESULT_MESSAGE = 'kakaopay-result';
export const PAYMENT_RESULT_ACK = 'kakaopay-result-ack';
/** 부모 창이 결과를 받지 못해 팝업이 직접 처리하는 모드. */
export const PAYMENT_STANDALONE_PARAM = 'standalone';

/** 결과만 부모 창에 넘기는 팝업 결과 창인지. 이때는 인증 refresh를 하지 않는다. */
export function isPaymentResultRelay() {
  return (
    window.location.pathname === '/payments/result' &&
    !new URLSearchParams(window.location.search).has(PAYMENT_STANDALONE_PARAM) &&
    isSameOriginOpener()
  );
}

export interface PaymentResultMessage {
  type: typeof PAYMENT_RESULT_MESSAGE;
  orderId: string;
  result: string | null;
  pgToken: string | null;
}
