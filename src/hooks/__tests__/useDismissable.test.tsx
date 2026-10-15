import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createPopupStore, PopupProvider, usePopup } from '@/app/context/PopupContext';
import { useDismissable } from '../useDismissable';

function Popup({ id, rendered }: { id: string; rendered?: () => void }) {
  rendered?.();
  const { isOpen, toggle, close } = usePopup(id);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useDismissable({ open: isOpen, onDismiss: close, triggerRef, panelRef });
  return <>
    <button ref={triggerRef} onClick={toggle} aria-expanded={isOpen}>{id}</button>
    {isOpen ? <div ref={panelRef}><button>{id} 내용</button></div> : null}
  </>;
}

describe('shared popup dismissal', () => {
  it('notifies only the previous and next ID subscriptions', () => {
    const store = createPopupStore();
    const a = vi.fn(), b = vi.fn(), c = vi.fn();
    store.subscribe('a', a); store.subscribe('b', b); store.subscribe('c', c);
    store.toggle('a'); store.toggle('b');
    expect(a).toHaveBeenCalledTimes(2); expect(b).toHaveBeenCalledTimes(1);
    expect(c).not.toHaveBeenCalled();
    store.close('a');
    expect(store.isOpen('b')).toBe(true);
  });
  it('opens only one popup and does not rerender unrelated items', () => {
    const untouched = vi.fn();
    render(<PopupProvider><Popup id="a" /><Popup id="b" /><Popup id="c" rendered={untouched} /></PopupProvider>);
    const baseline = untouched.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'a' }));
    fireEvent.click(screen.getByRole('button', { name: 'b' }));
    expect(screen.queryByText('a 내용')).not.toBeInTheDocument();
    expect(screen.getByText('b 내용')).toBeInTheDocument();
    expect(untouched).toHaveBeenCalledTimes(baseline);
  });
  it('closes on Escape and returns focus, but not for composing Escape', () => {
    render(<PopupProvider><Popup id="a" /></PopupProvider>);
    const trigger = screen.getByRole('button', { name: 'a' });
    fireEvent.click(trigger);
    screen.getByText('a 내용').focus();
    fireEvent.keyDown(document, { key: 'Escape', isComposing: true });
    expect(screen.getByText('a 내용')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('a 내용')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
  it('keeps inside clicks open and closes outside without stealing focus', () => {
    render(<PopupProvider><Popup id="a" /><button>바깥</button></PopupProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'a' }));
    fireEvent.pointerDown(screen.getByText('a 내용'));
    expect(screen.getByText('a 내용')).toBeInTheDocument();
    const outside = screen.getByText('바깥');
    outside.focus(); fireEvent.pointerDown(outside);
    expect(screen.queryByText('a 내용')).not.toBeInTheDocument();
    expect(outside).toHaveFocus();
  });
  it('yields Escape to dialogs and the existing search handler', () => {
    const view = render(<PopupProvider><Popup id="a" /><form role="search" data-escape-owner="search"><input aria-label="검색" /></form></PopupProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'a' }));
    fireEvent.keyDown(screen.getByLabelText('검색'), { key: 'Escape' });
    expect(screen.getByText('a 내용')).toBeInTheDocument();
    view.rerender(<PopupProvider><Popup id="a" /><div role="dialog" aria-modal="true" /></PopupProvider>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('a 내용')).toBeInTheDocument();
    view.rerender(<PopupProvider><Popup id="a" /></PopupProvider>);
    act(() => fireEvent.keyDown(document, { key: 'Escape' }));
    expect(screen.queryByText('a 내용')).not.toBeInTheDocument();
  });
  it('does not swallow Escape in an already closed desktop search', () => {
    render(<PopupProvider><Popup id="a" /><form role="search"><input aria-label="검색" /></form></PopupProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'a' }));
    fireEvent.keyDown(screen.getByLabelText('검색'), { key: 'Escape' });
    expect(screen.queryByText('a 내용')).not.toBeInTheDocument();
  });
});
