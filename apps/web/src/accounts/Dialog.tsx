import { useEffect, useId, useRef, type ReactNode } from "react";

/** Open dialogs, top-most last: only the top one reacts to Escape, even if focus was lost. */
const openDialogs: symbol[] = [];

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export interface DialogProps {
  readonly title: string;
  readonly children: ReactNode;
  /** Escape/backdrop close. Omit for dialogs that need an explicit choice. */
  readonly onClose?: (() => void) | undefined;
  readonly role?: "dialog" | "alertdialog";
  readonly testId?: string;
}

/**
 * Modal dialog: focus moves in on open, Tab is trapped, Escape closes when allowed, and focus
 * returns to the element that opened it. Labelled by its title for screen readers.
 */
export function Dialog({ title, children, onClose, role = "dialog", testId }: DialogProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const token = Symbol("dialog");
    openDialogs.push(token);
    function onDocumentKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        openDialogs[openDialogs.length - 1] === token &&
        onCloseRef.current !== undefined
      ) {
        event.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      const index = openDialogs.indexOf(token);
      if (index >= 0) openDialogs.splice(index, 1);
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = ref.current;
    if (node !== null) {
      const first =
        node.querySelector<HTMLElement>("[data-autofocus]") ??
        node.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? node).focus();
    }
    return () => {
      if (opener !== null && opener.isConnected) opener.focus();
    };
  }, []);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const node = ref.current;
    if (node === null) return;
    const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !node.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !node.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="agx-dialog-backdrop">
      <div
        ref={ref}
        className="agx-dialog"
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        data-testid={testId}
      >
        <h2 id={titleId} className="agx-dialog-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
