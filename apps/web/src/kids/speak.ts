import type { Locale } from "../i18n.js";
import { loadAdultSettings } from "./kidsAdults.js";

/**
 * Reads a fixed piece of interface copy aloud with the browser's own speech synthesis
 * (the 🔊 buttons of the prototype). It only runs on a tap, never sends child input anywhere
 * (the text is our own copy) and does nothing where speech is unavailable.
 */
export function speak(text: string, locale: Locale): void {
  try {
    if (!loadAdultSettings().readAloud) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "es" ? "es-AR" : "en-US";
    utterance.rate = 0.92;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech is a convenience.
  }
}

/** Stops an utterance when the learner leaves a screen or changes language. */
export function stopSpeaking(): void {
  try {
    if (typeof window !== "undefined" && "speechSynthesis" in window)
      window.speechSynthesis.cancel();
  } catch {
    // Speech is optional, including when a browser blocks the API.
  }
}
