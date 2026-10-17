// 08 문서 12-6절: PC는 팝업, 모바일 웹은 페이지 이동. 판정은 이 함수 하나로 통일한다.
export function isMobileBrowser() {
  const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  return typeof hint === 'boolean' ? hint : /Mobi|Android|iPhone|iPad/.test(navigator.userAgent);
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

export interface PaymentResultMessage {
  type: typeof PAYMENT_RESULT_MESSAGE;
  orderId: string;
  result: string | null;
  pgToken: string | null;
}
