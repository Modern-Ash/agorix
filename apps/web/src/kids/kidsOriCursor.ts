import { useEffect, useSyncExternalStore } from "react";
import type { Locale } from "../i18n.js";
import { contextFromTarget, describeContext, type OriContext } from "./kidsOriContext.js";
import type { KidsScreen } from "./kidsState.js";

/** Ori's own controls: moving onto them to click must not replace what the learner was looking at. */
const ORI_SURFACE =
  ".kids-ori-guide-zone, .kids-ori-float-zone, .kids-ori-panel-layer, .kids-studio-ori-rail, .kids-studio-ori";

let current: OriContext | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function publish(next: OriContext | null) {
  const same = JSON.stringify(next) === JSON.stringify(current);
  current = next;
  if (!same) for (const listener of listeners) listener();
}

/**
 * Keeps Ori's context current while the pointer moves (issue #1209, part b). It lives in memory in
 * this tab only: it is read by the Ori controls and never stored, logged or sent.
 */
export function useOriCursorTracking(screen: KidsScreen): void {
  useEffect(() => {
    publish(contextFromTarget(null, screen));
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(ORI_SURFACE)) return;
      publish(contextFromTarget(target, screen));
    };
    const onLeave = () => publish(contextFromTarget(null, screen));
    document.addEventListener("pointerover", onOver, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointerover", onOver);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      publish(null);
    };
  }, [screen]);
}

/** The sentence describing what Ori would use if the learner asked for help right now. */
export function useOriContextText(locale: Locale): string | undefined {
  const context = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return context ? describeContext(context, locale) : undefined;
}

/** What Ori is looking at right now; read once, when the learner taps Ori, never on a timer. */
export function getOriContext(): OriContext | null {
  return current;
}
