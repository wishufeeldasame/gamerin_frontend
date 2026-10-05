import { render as renderUI, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { ConfirmProvider } from '@/app/context/ConfirmContext';
import { ToastProvider } from '@/app/context/ToastContext';

// jsdom has no top layer. Real focus containment/inert behavior is covered by Playwright.
export function installDialogMock() {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true, writable: true,
    value: function (this: HTMLDialogElement) { this.open = true; },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true, writable: true,
    value: function (this: HTMLDialogElement) { this.open = false; },
  });
}

function TestFeedbackProviders({ children }: { children: ReactNode }) {
  return <ConfirmProvider><ToastProvider>{children}</ToastProvider></ConfirmProvider>;
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  installDialogMock();
  return renderUI(ui, { ...options, wrapper: TestFeedbackProviders });
}
