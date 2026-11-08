import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../i18n.js";
import { TIP_CONTROLS, tipFor } from "../kidsTips.js";

const SHOW_AFTER_MS = 450;
const TOUCH_HOLD_MS = 600;
const TOUCH_SHOWN_MS = 3200;
const MARGIN = 8;

interface Shown {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly placement: "below" | "above";
}

/**
 * The tooltip layer (issue #1246): one element for the whole app. It listens for the pointer and
 * the keyboard focus on a control, asks `tipFor` what it does and shows it below it (or above, when
 * there is no room). A mouse waits a moment so it does not flicker; focus shows it at once; touch
 * shows it on a long press, except where a long press already means dragging or the block menu.
 * It stays while the pointer is over the tip, closes with Escape or a press, and gives the control
 * `aria-describedby` while it is open, so a screen reader reads it too.
 */
export function KidsTipLayer({ locale }: { readonly locale: Locale }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const control = useRef<HTMLElement | null>(null);
  const tip = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const clear = () => window.clearTimeout(timer.current);
    const hide = () => {
      clear();
      control.current?.removeAttribute("aria-describedby");
      control.current = null;
      setShown(null);
    };
    const find = (target: EventTarget | null): HTMLElement | null =>
      target instanceof Element ? target.closest<HTMLElement>(TIP_CONTROLS) : null;
    const open = (element: HTMLElement) => {
      const text = tipFor(element, locale);
      if (!text) return;
      control.current?.removeAttribute("aria-describedby");
      control.current = element;
      element.setAttribute("aria-describedby", "kids-tip");
      const rect = element.getBoundingClientRect();
      setShown({ text, left: rect.left + rect.width / 2, top: rect.bottom, placement: "below" });
      // Place it once it is measured, in the next frame.
      window.requestAnimationFrame(() => {
        const box = tip.current?.getBoundingClientRect();
        if (!box) return;
        const width = box.width;
        const height = box.height;
        const left = Math.max(
          MARGIN,
          Math.min(
            rect.left + rect.width / 2 - width / 2,
            document.documentElement.clientWidth - width - MARGIN,
          ),
        );
        const fitsBelow = rect.bottom + 8 + height <= window.innerHeight - MARGIN;
        const placement = fitsBelow || rect.top - 8 - height < MARGIN ? "below" : "above";
        setShown({
          text,
          left,
          top: placement === "below" ? rect.bottom + 8 : rect.top - 8 - height,
          placement,
        });
      });
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const element = find(event.target);
      if (!element || element === control.current) return;
      if (event.target instanceof Element && event.target.closest("#kids-tip")) return;
      clear();
      timer.current = window.setTimeout(() => open(element), SHOW_AFTER_MS);
    };
    const onOut = (event: PointerEvent) => {
      const to = event.relatedTarget;
      if (to instanceof Element && (to.closest("#kids-tip") || find(to) === control.current))
        return;
      hide();
    };
    const onFocus = (event: FocusEvent) => {
      const element = find(event.target);
      if (element?.matches(":focus-visible")) open(element);
    };
    let touch: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        hide();
        return;
      }
      const element = find(event.target);
      if (
        !element ||
        element.matches("[data-kids-add], .kids-block-handle, .kids-studio-stage-actor") ||
        element.closest(".kids-program-block")
      )
        return;
      touch = { x: event.clientX, y: event.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        open(element);
        timer.current = window.setTimeout(hide, TOUCH_SHOWN_MS);
      }, TOUCH_HOLD_MS);
    };
    const onMove = (event: PointerEvent) => {
      if (touch && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) > 10) {
        touch = null;
        clear();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    document.addEventListener("pointerover", onOver, true);
    document.addEventListener("pointerout", onOut, true);
    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("focusout", hide, true);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", () => (touch = null), true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", hide, true);
    // Says the listeners are attached, so a test (or a tool) does not act a moment too early.
    document.documentElement.dataset.kidsTips = "on";
    return () => {
      delete document.documentElement.dataset.kidsTips;
      clear();
      document.removeEventListener("pointerover", onOver, true);
      document.removeEventListener("pointerout", onOut, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("focusout", hide, true);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", hide, true);
    };
  }, [locale]);

  return shown ? (
    <div
      id="kids-tip"
      ref={tip}
      role="tooltip"
      className="kids-tip"
      data-placement={shown.placement}
      style={{ left: shown.left, top: shown.top }}
    >
      {shown.text}
    </div>
  ) : null;
}
