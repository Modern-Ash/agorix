import { useCallback, useLayoutEffect, useState, type RefObject } from "react";

export interface AnchoredPosition {
  readonly left: number;
  readonly top: number;
  /** Where the card points at the anchor, measured from the card's left edge. */
  readonly arrow: number;
  readonly placement: "below" | "above";
}

const MARGIN = 8;
const GAP = 10;

/**
 * Places a floating card right below the thing it is about (issue #1242): centred under the
 * anchor, kept inside the window, and flipped above it when there is no room below. On a phone it
 * returns `null`: there the card stays a bottom sheet so the stage remains in view. It follows
 * scrolling, resizing and the card's own size, and `deps` re-places it when the anchor moves.
 */
export function useAnchoredPosition(
  active: boolean,
  resolveAnchor: () => Element | null,
  card: RefObject<HTMLElement | null>,
  deps: readonly unknown[],
): AnchoredPosition | null {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const place = useCallback(() => {
    const anchor = resolveAnchor();
    const element = card.current;
    if (!active || !anchor || !element || window.matchMedia("(max-width: 720px)").matches) {
      setPosition(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const width = element.offsetWidth || 440;
    const height = element.offsetHeight || 320;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const center = rect.left + rect.width / 2;
    const left = Math.max(MARGIN, Math.min(center - width / 2, viewportWidth - width - MARGIN));
    const below = rect.bottom + GAP;
    const fitsBelow = below + height <= viewportHeight - MARGIN;
    const above = rect.top - GAP - height;
    const placement = fitsBelow || above < MARGIN ? "below" : "above";
    const rawTop = placement === "below" ? below : above;
    const top = Math.max(MARGIN, Math.min(rawTop, viewportHeight - height - MARGIN));
    const next: AnchoredPosition = {
      left: Math.round(left),
      top: Math.round(top),
      arrow: Math.round(Math.max(20, Math.min(center - left, width - 20))),
      placement,
    };
    setPosition((current) =>
      current &&
      current.left === next.left &&
      current.top === next.top &&
      current.arrow === next.arrow &&
      current.placement === next.placement
        ? current
        : next,
    );
  }, [active, resolveAnchor, card]);

  useLayoutEffect(() => {
    place();
    if (!active) return undefined;
    const again = () => place();
    window.addEventListener("scroll", again, true);
    window.addEventListener("resize", again);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(again);
    if (card.current) observer?.observe(card.current);
    return () => {
      window.removeEventListener("scroll", again, true);
      window.removeEventListener("resize", again);
      observer?.disconnect();
    };
    // `deps` is the caller's list of things that move the anchor.
  }, [active, place, card, ...deps]);

  return position;
}
