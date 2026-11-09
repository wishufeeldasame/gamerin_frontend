'use client';

import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect,
  useMemo, useRef, useState, type ReactNode,
} from 'react';

export interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  returnFocusTo?: HTMLElement | null;
}
type Request = {
  owner: symbol;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
  returnFocusTo: HTMLElement | null;
};
type ConfirmActions = {
  request: (owner: symbol, options: ConfirmOptions) => Promise<boolean>;
  cancelOwner: (owner: symbol) => void;
};
const ConfirmContext = createContext<ConfirmActions | null>(null);
const ConfirmOpenContext = createContext(false);

export function restoreFeedbackFocus(target: HTMLElement | null) {
  if (target?.isConnected && !target.closest('[inert]')) {
    target.focus();
    if (document.activeElement === target) return;
  }
  const fallback = document.querySelector<HTMLElement>('main') ?? document.body;
  const previousTabIndex = fallback.getAttribute('tabindex');
  fallback.setAttribute('tabindex', '-1');
  fallback.focus();
  if (previousTabIndex === null) fallback.removeAttribute('tabindex');
  else fallback.setAttribute('tabindex', previousTabIndex);
}

export function ConfirmProvider({ children, scopeKey }: { children: ReactNode; scopeKey?: string | null }) {
  const [active, setActive] = useState<Request | null>(null);
  const activeRef = useRef<Request | null>(null);
  const previousScopeRef = useRef(scopeKey);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const settle = useCallback((value: boolean, updateState = true) => {
    const current = activeRef.current;
    if (!current) return;
    activeRef.current = null;
    if (dialogRef.current?.open) dialogRef.current.close();
    if (updateState) setActive(null);
    restoreFeedbackFocus(current.returnFocusTo);
    current.resolve(value);
  }, []);
  const request = useCallback((owner: symbol, options: ConfirmOptions) => {
    if (activeRef.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const next = {
        owner, options, resolve,
        returnFocusTo: options.returnFocusTo ?? (
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        ),
      };
      activeRef.current = next;
      setActive(next);
    });
  }, []);
  const cancelOwner = useCallback((owner: symbol) => {
    if (activeRef.current?.owner === owner) settle(false);
  }, [settle]);
  const actions = useMemo(() => ({ request, cancelOwner }), [request, cancelOwner]);
  useEffect(() => () => settle(false, false), [settle]);
  useLayoutEffect(() => {
    if (previousScopeRef.current !== scopeKey) {
      previousScopeRef.current = scopeKey;
      settle(false);
    }
  }, [scopeKey, settle]);
  useLayoutEffect(() => {
    if (!active || activeRef.current !== active) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    try {
      dialog.showModal();
      cancelButtonRef.current?.focus();
    } catch {
      // Fail closed: unsupported browsers must never execute the operation.
      settle(false);
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [active, settle]);
  return (
    <ConfirmContext.Provider value={actions}>
      <ConfirmOpenContext.Provider value={active !== null}>
        {children}
        {active ? (
          <dialog
            ref={dialogRef}
            role={active.options.danger ? 'alertdialog' : 'dialog'}
            aria-modal='true'
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={(event) => { event.preventDefault(); settle(false); }}
            onKeyDown={(event) => {
              // Keep underlying modal Escape listeners from receiving this key.
              if (event.key === 'Escape') event.stopPropagation();
              if (event.key === 'Tab') {
                if (event.shiftKey && document.activeElement === cancelButtonRef.current) {
                  event.preventDefault();
                  confirmButtonRef.current?.focus();
                } else if (!event.shiftKey && document.activeElement === confirmButtonRef.current) {
                  event.preventDefault();
                  cancelButtonRef.current?.focus();
                }
              }
            }}
            className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-card border border-line-card bg-surface p-6 text-fg-primary shadow-xl backdrop:bg-black/60'
          >
            <h2 id={titleId} className='text-title'>작업 확인</h2>
            <p id={descriptionId} className='mt-3 whitespace-pre-wrap break-words text-body text-fg-secondary'>{active.options.message}</p>
            <div className='mt-6 flex justify-end gap-3'>
              <button ref={cancelButtonRef} type='button' onClick={() => settle(false)} className='btn-secondary'>
                {active.options.cancelLabel ?? '취소'}
              </button>
              <button ref={confirmButtonRef} type='button' onClick={() => settle(true)} className={`btn-primary ${active.options.danger ? 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-700' : ''}`}>
                {active.options.confirmLabel ?? '확인'}
              </button>
            </div>
          </dialog>
        ) : null}
      </ConfirmOpenContext.Provider>
    </ConfirmContext.Provider>
  );
}

export function useConfirmationOpen() {
  return useContext(ConfirmOpenContext);
}

export function useConfirm(scopeKey?: unknown) {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
  const { request, cancelOwner } = context;
  const ownerRef = useRef(Symbol('confirmation-owner'));
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  useLayoutEffect(() => {
    mountedRef.current = true;
    const owner = ownerRef.current;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      cancelOwner(owner);
    };
  }, [cancelOwner, scopeKey]);
  return useCallback(async (options: ConfirmOptions) => {
    if (!mountedRef.current) return false;
    const generation = generationRef.current;
    const value = await request(ownerRef.current, options);
    return value && mountedRef.current && generation === generationRef.current;
  }, [request]);
}
