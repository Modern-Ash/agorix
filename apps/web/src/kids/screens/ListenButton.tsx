import type { Locale } from "../../i18n.js";
import { speak } from "../speak.js";
import type { KidsText } from "../useKidsText.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly enabled: boolean;
  /** Only pass localized, visible interface copy. Never pass project or child text. */
  readonly text: string;
}

export function ListenButton({ t, locale, enabled, text }: Props) {
  if (!enabled) return null;
  return (
    <button
      type="button"
      className="kids-button kids-listen"
      aria-label={t("listen")}
      onClick={() => speak(text, locale)}
    >
      <span aria-hidden="true">🔊</span> {t("listen")}
    </button>
  );
}
