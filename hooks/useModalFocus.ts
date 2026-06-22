import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useModalFocus<T extends HTMLElement>(isOpen: boolean, onClose: () => void) {
  const dialogRef = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const frameId = window.requestAnimationFrame(() => {
      const preferred = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]');
      const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (preferred || first || dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen]);

  return dialogRef;
}
