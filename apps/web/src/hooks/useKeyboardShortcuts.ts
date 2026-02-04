import { useEffect, useCallback, useRef } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  enabled?: boolean;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

function normalizeKey(key: string): string {
  return key.toLowerCase();
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const eventKey = normalizeKey(event.key);
  const shortcutKey = normalizeKey(shortcut.key);

  // Check if the key matches
  if (eventKey !== shortcutKey) return false;

  // Check modifier keys
  if (shortcut.ctrl && !event.ctrlKey) return false;
  if (!shortcut.ctrl && event.ctrlKey && shortcutKey !== 'control') return false;

  if (shortcut.shift && !event.shiftKey) return false;
  if (!shortcut.shift && event.shiftKey && shortcutKey !== 'shift') return false;

  if (shortcut.alt && !event.altKey) return false;
  if (!shortcut.alt && event.altKey && shortcutKey !== 'alt') return false;

  return true;
}

function isInputElement(element: EventTarget | null): boolean {
  if (!element) return false;
  const tagName = (element as HTMLElement).tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    (element as HTMLElement).isContentEditable
  );
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if typing in an input (except for function keys and Escape)
      const isFunctionKey = event.key.startsWith('F') && event.key.length <= 3;
      const isEscape = event.key === 'Escape';

      if (isInputElement(event.target) && !isFunctionKey && !isEscape) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        if (matchesShortcut(event, shortcut)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          return;
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}

// POS-specific keyboard shortcuts hook
interface POSShortcutActions {
  onFocusSearch?: () => void;
  onOpenCustomerSelector?: () => void;
  onOpenPaymentModal?: () => void;
  onClearCart?: () => void;
  onHoldSale?: () => void;
  onCloseModal?: () => void;
  onConfirmPayment?: () => void;
  onPrintLastReceipt?: () => void;
}

export function usePOSKeyboardShortcuts(
  actions: POSShortcutActions,
  options: { hasCartItems?: boolean; isPaymentModalOpen?: boolean; enabled?: boolean } = {}
) {
  const { hasCartItems = false, isPaymentModalOpen = false, enabled = true } = options;

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'F1',
      action: () => actions.onFocusSearch?.(),
      description: 'Focus search/barcode input',
      enabled: !!actions.onFocusSearch,
    },
    {
      key: 'F2',
      action: () => actions.onOpenCustomerSelector?.(),
      description: 'Open customer selector',
      enabled: !!actions.onOpenCustomerSelector,
    },
    {
      key: 'F3',
      action: () => actions.onOpenPaymentModal?.(),
      description: 'Open payment modal',
      enabled: !!actions.onOpenPaymentModal && hasCartItems,
    },
    {
      key: 'F4',
      action: () => actions.onClearCart?.(),
      description: 'Clear cart',
      enabled: !!actions.onClearCart && hasCartItems,
    },
    {
      key: 'F8',
      action: () => actions.onHoldSale?.(),
      description: 'Hold sale (save for later)',
      enabled: !!actions.onHoldSale && hasCartItems,
    },
    {
      key: 'Escape',
      action: () => actions.onCloseModal?.(),
      description: 'Close modals',
      enabled: !!actions.onCloseModal,
    },
    {
      key: 'Enter',
      action: () => actions.onConfirmPayment?.(),
      description: 'Confirm payment',
      enabled: !!actions.onConfirmPayment && isPaymentModalOpen,
    },
    {
      key: 'p',
      ctrl: true,
      action: () => {
        actions.onPrintLastReceipt?.();
      },
      description: 'Print last receipt',
      enabled: !!actions.onPrintLastReceipt,
    },
  ];

  useKeyboardShortcuts({ shortcuts, enabled });

  // Return shortcuts for display in help
  return shortcuts.filter((s) => s.enabled !== false);
}

// Get human-readable shortcut label
export function getShortcutLabel(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];

  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');

  parts.push(shortcut.key.toUpperCase());

  return parts.join('+');
}
