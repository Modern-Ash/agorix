import { useEffect } from "react";
import { prefersReducedMotion } from "./kidsOriMotion.js";

/** How far a pupil may travel inside the eye, in drawing units. */
const MAX_X = 3.4;
const MAX_Y = 2.6;
/** Pointer distance, in px, at which the gaze reaches its full reach. */
const FULL_REACH = 260;

/**
 * Ori's eyes follow the pointer (issue #1209). It only moves the pupils through two CSS variables on
 * each face; it reads no content and sends nothing anywhere. With reduced motion, or without a
 * mouse, the eyes keep their own gentle glance.
 */
export function useOriGaze(): void {
  useEffect(() => {
    if (typeof window === "undefined" || prefersReducedMotion()) return;
    let frame = 0;
    let last: { x: number; y: number } | null = null;
    const faces = () => [...document.querySelectorAll<SVGElement>(".kids-ori-face")];
    const reset = () => {
      for (const face of faces()) {
        face.style.removeProperty("--ori-look-x");
        face.style.removeProperty("--ori-look-y");
        face.removeAttribute("data-ori-tracking");
      }
    };
    const apply = () => {
      frame = 0;
      if (!last) return;
      for (const face of faces()) {
        const box = face.getBoundingClientRect();
        if (box.width === 0) continue;
        const dx = last.x - (box.left + box.width / 2);
        const dy = last.y - (box.top + box.height / 2);
        const distance = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, distance / FULL_REACH);
        face.style.setProperty("--ori-look-x", ((dx / distance) * reach * MAX_X).toFixed(2));
        face.style.setProperty("--ori-look-y", ((dy / distance) * reach * MAX_Y).toFixed(2));
        face.setAttribute("data-ori-tracking", "true");
      }
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      last = { x: event.clientX, y: event.clientY };
      if (!frame) frame = window.requestAnimationFrame(apply);
    };
    const onLeave = () => {
      last = null;
      reset();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      if (frame) window.cancelAnimationFrame(frame);
      reset();
    };
  }, []);
}
