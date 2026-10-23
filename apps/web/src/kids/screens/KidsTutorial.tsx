import { speak } from "../speak.js";
import type { Locale } from "../../i18n.js";
import type { TutorialStep } from "../kidsTutorial.js";
import type { KidsText } from "../useKidsText.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly step: TutorialStep;
  readonly onSkip: () => void;
}

const KEYS = {
  add: "tutorialAdd",
  number: "tutorialNumber",
  predict: "tutorialPredict",
  run: "tutorialRun",
} as const;

/** A non-blocking coach note. It never traps focus and never covers the controls it points at. */
export function KidsTutorial({ t, locale, step, onSkip }: Props) {
  const text = t(KEYS[step]);
  return (
    <aside className="kids-tutorial" aria-label={t("tutorialTitle")}>
      <p role="status" aria-live="polite">
        {text}
      </p>
      <button type="button" className="kids-button" onClick={() => speak(text, locale)}>
        🔊 <span className="kids-visually-hidden">{t("listen")}</span>
      </button>
      <button type="button" className="kids-button" onClick={onSkip}>
        {t("tutorialSkip")}
      </button>
    </aside>
  );
}
