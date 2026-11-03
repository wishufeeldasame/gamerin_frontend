'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';

export function createPopupStore() {
  let openId: string | null = null;
  const listeners = new Map<string, Set<() => void>>();
  const change = (nextId: string | null) => {
    if (nextId === openId) return;
    const previousId = openId;
    openId = nextId;
    for (const id of [previousId, nextId]) {
      if (id) listeners.get(id)?.forEach((listener) => listener());
    }
  };

  return {
    isOpen: (id: string) => openId === id,
    subscribe: (id: string, listener: () => void) => {
      const subscribers = listeners.get(id) ?? new Set<() => void>();
      subscribers.add(listener);
      listeners.set(id, subscribers);
      return () => {
        subscribers.delete(listener);
        if (subscribers.size === 0) listeners.delete(id);
      };
    },
    toggle: (id: string) => change(openId === id ? null : id),
    close: (id: string) => {
      if (openId === id) change(null);
    },
    closeAll: () => change(null),
  };
}

const PopupContext = createContext<ReturnType<typeof createPopupStore> | null>(null);
const getClosedSnapshot = () => false;

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(createPopupStore);
  return <PopupContext.Provider value={store}>{children}</PopupContext.Provider>;
}

export function usePopup(id: string) {
  const store = useContext(PopupContext);
  if (!store) throw new Error('usePopup must be used within PopupProvider');
  const subscribe = useCallback((listener: () => void) => store.subscribe(id, listener), [id, store]);
  const getSnapshot = useCallback(() => store.isOpen(id), [id, store]);
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, getClosedSnapshot);
  const toggle = useCallback(() => store.toggle(id), [id, store]);
  const close = useCallback(() => store.close(id), [id, store]);

  useEffect(() => () => store.close(id), [id, store]);
  return { isOpen, toggle, close, closeAll: store.closeAll };
}
