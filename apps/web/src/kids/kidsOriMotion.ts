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
