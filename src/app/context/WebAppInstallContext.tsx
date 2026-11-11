'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<unknown>;
}

const WebAppInstallContext = createContext<{
  isInstalled: boolean;
  requestInstall: () => Promise<boolean>;
} | null>(null);

export function WebAppInstallProvider({ children }: { children: ReactNode }) {
  const prompt = useRef<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Chrome can emit this before the user navigates to /demo.
    function capturePrompt(event: Event) {
      if (window.location.pathname === '/demo') event.preventDefault();
      prompt.current = event as InstallPromptEvent;
    }

    function markInstalled() {
      prompt.current = null;
      setIsInstalled(true);
    }

    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', markInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', markInstalled);
    };
  }, []);

  async function requestInstall() {
    const event = prompt.current;
    if (!event) return false;

    prompt.current = null;
    try {
      await event.prompt();
      return true;
    } catch {
      return false;
    }
  }

  return (
    <WebAppInstallContext.Provider value={{ isInstalled, requestInstall }}>
      {children}
    </WebAppInstallContext.Provider>
  );
}

export function useWebAppInstall() {
  const context = useContext(WebAppInstallContext);
  if (!context) throw new Error('useWebAppInstall must be used within WebAppInstallProvider');
  return context;
}
