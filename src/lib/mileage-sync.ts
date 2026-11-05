const MILEAGE_INVALIDATED_EVENT = 'gamerin:mileage-invalidated';

// 내 동작으로 잔액이 바뀌었음을 알린다(사이드바 계정 카드가 다시 읽는다). notification-sync와 같은 방식이다.
export function invalidateMileage() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MILEAGE_INVALIDATED_EVENT));
}

export function subscribeToMileageInvalidation(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(MILEAGE_INVALIDATED_EVENT, listener);
  return () => window.removeEventListener(MILEAGE_INVALIDATED_EVENT, listener);
}

// 요청이 성공했을 때만 알린다. 실패하면 잔액이 그대로라 다시 읽을 필요가 없다.
export function invalidateMileageAfter<T>(request: Promise<T>): Promise<T> {
  return request.then((result) => {
    invalidateMileage();
    return result;
  });
}
