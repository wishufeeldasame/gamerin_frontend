'use client';

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useConfirmationOpen } from './ConfirmContext';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };
type ToastActions = Record<ToastKind, (message: string) => void>;
const ToastContext = createContext<ToastActions | null>(null);

function ToastItem({ toast, onDismiss, paused }: { toast: Toast; onDismiss: (id: number) => void; paused: boolean }) {
  const itemRef = useRef<HTMLDivElement>(null);
  const [fullyVisible, setFullyVisible] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remainingRef = useRef(toast.kind === 'error' ? 6000 : 4000);
  useEffect(() => {
    const element = itemRef.current;
    // Without visibility detection, keep the notification until manually dismissed.
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setFullyVisible(entry.isIntersecting && entry.intersectionRatio >= 1);
    }, { root: element.parentElement, threshold: 1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    // Mounted notifications may still be clipped by the scrollable stack.
    if (!fullyVisible || paused || hovered || focused) return;
    const startedAt = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remainingRef.current);
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAt));
    };
  }, [focused, fullyVisible, hovered, onDismiss, paused, toast.id]);
  const Icon = toast.kind === 'error' ? CircleAlert : toast.kind === 'success' ? CircleCheck : Info;
  const palette = toast.kind === 'error'
    ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100'
    : toast.kind === 'success'
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100'
      : 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100';
  return (
    <div
      ref={itemRef}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
      aria-atomic='true'
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${palette}`}
    >
      <Icon size={20} className='mt-0.5 shrink-0' aria-hidden='true' />
      <p className='min-w-0 flex-1 whitespace-pre-wrap break-words text-sm font-semibold leading-6'>{toast.message}</p>
      <button type='button' aria-label='알림 닫기' onClick={() => onDismiss(toast.id)} className='shrink-0 rounded-lg p-1 focus-visible:outline-2 focus-visible:outline-offset-2'>
        <X size={18} aria-hidden='true' />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Toast[]>([]);
  const nextIdRef = useRef(0);
  const paused = useConfirmationOpen();
  const enqueue = useCallback((kind: ToastKind, message: string) => {
    const id = ++nextIdRef.current;
    setQueue((current) => current.some((item) => item.kind === kind && item.message === message)
      ? current : [...current, { id, kind, message }]);
  }, []);
  const dismiss = useCallback((id: number) => setQueue((current) => current.filter((item) => item.id !== id)), []);
  const actions = useMemo(() => ({
    success: (message: string) => enqueue('success', message),
    error: (message: string) => enqueue('error', message),
    info: (message: string) => enqueue('info', message),
  }), [enqueue]);
  return (
    <ToastContext.Provider value={actions}>
      {children}
      {queue.length > 0 ? (
        <div
          aria-label='알림'
          className='pointer-events-none fixed left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] z-[150] grid max-h-[50dvh] gap-3 overflow-y-auto lg:left-auto lg:w-96'
          style={{
            bottom: 'calc(max(var(--tab-bar-height, 0px), env(safe-area-inset-bottom)) + 1rem)',
          }}
        >
          {queue.slice(0, 3).map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} paused={paused} />)}
        </div>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
