import { useEffect, useState } from "react";

/**
 * How many pixels the on-screen keyboard covers at the bottom of the layout viewport (issue #1231).
 * A floating panel adds it to its bottom offset so a numeric field being edited is not hidden.
 * Without `visualViewport` (or without a keyboard) it is 0.
 */
export function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!active || !viewport) {
      setInset(0);
      return;
    }
    const update = () =>
      setInset(Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop)));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      setInset(0);
    };
  }, [active]);
  return inset;
}
