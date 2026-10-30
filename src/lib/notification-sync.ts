export type NotificationInvalidationReason =
  | 'conversation-read'
  | 'message-created';

const NOTIFICATION_INVALIDATED_EVENT = 'gamerin:notifications-invalidated';

export function invalidateNotifications(reason: NotificationInvalidationReason) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<NotificationInvalidationReason>(NOTIFICATION_INVALIDATED_EVENT, {
      detail: reason,
    }),
  );
}

export function subscribeToNotificationInvalidation(
  listener: (reason: NotificationInvalidationReason) => void,
) {
  if (typeof window === 'undefined') return () => undefined;

  const handleInvalidation = (event: Event) => {
    listener((event as CustomEvent<NotificationInvalidationReason>).detail);
  };

  window.addEventListener(NOTIFICATION_INVALIDATED_EVENT, handleInvalidation);
  return () => window.removeEventListener(NOTIFICATION_INVALIDATED_EVENT, handleInvalidation);
}
