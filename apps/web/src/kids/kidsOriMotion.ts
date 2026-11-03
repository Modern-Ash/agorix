import { useEffect, useState } from "react";

export type OriMotionState =
  "idle" | "listening" | "thinking" | "proposal" | "observing" | "fallback";

export function useOriPageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

export function oriMotionStatus(state: OriMotionState, locale: "es" | "en"): string {
  const labels = {
    es: {
      idle: "Ori está acá",
      listening: "Ori te escucha",
      thinking: "Ori está pensando",
      proposal: "Ori tiene una idea para revisar",
      observing: "Ori mira lo que pasó",
      fallback: "Ori tiene un mensaje",
    },
    en: {
      idle: "Ori is here",
      listening: "Ori is listening",
      thinking: "Ori is thinking",
      proposal: "Ori has an idea to review",
      observing: "Ori is watching what happened",
      fallback: "Ori has a message",
    },
  } as const;
  return labels[locale][state];
}

/** True when the system asks for less movement. Ori's open/close and typing then happen at once. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Reveals `text` one letter at a time, like a chat; with reduced motion it is shown whole. */
export function useTypewriter(text: string, active: boolean, msPerLetter = 18): string {
  const [count, setCount] = useState(() => (active && !prefersReducedMotion() ? 0 : text.length));
  useEffect(() => {
    if (!active || prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const timer = window.setInterval(() => {
      setCount((value) => {
        if (value + 1 >= text.length) window.clearInterval(timer);
        return Math.min(text.length, value + 1);
      });
    }, msPerLetter);
    return () => window.clearInterval(timer);
  }, [text, active, msPerLetter]);
  return text.slice(0, count);
}
