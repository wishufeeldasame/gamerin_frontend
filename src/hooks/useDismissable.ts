'use client';

import { useEffect, type RefObject } from 'react';

interface DismissableOptions {
  open: boolean;
  onDismiss: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
}

export function useDismissable({ open, onDismiss, triggerRef, panelRef }: DismissableOptions) {
  useEffect(() => {
    if (!open) return;
    let searchOwnedEvent: KeyboardEvent | null = null;
    const captureKeyDown = (event: KeyboardEvent) => {
      // Snapshot before Header's unchanged handler closes the mobile search.
      searchOwnedEvent = event.key === 'Escape' && event.target instanceof Element &&
        event.target.closest('[data-escape-owner="search"]') ? event : null;
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      // Existing dialogs and Header's search input own their Escape event.
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]')) return;
      if (searchOwnedEvent === event) return;
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      triggerRef.current?.focus();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (triggerRef.current?.contains(event.target) || panelRef.current?.contains(event.target)) return;
      onDismiss();
    };

    document.addEventListener('keydown', captureKeyDown, true);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => {
      document.removeEventListener('keydown', captureKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown, true);
    };
  }, [onDismiss, open, panelRef, triggerRef]);
}
