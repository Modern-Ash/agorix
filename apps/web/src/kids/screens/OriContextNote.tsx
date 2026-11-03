import type { Locale } from "../../i18n.js";
import { describeContext, type OriContext } from "../kidsOriContext.js";

const COPY = {
  es: {
    wrong: "No es eso",
    local: "Esto se queda en tu navegador y solo se usa cuando tocás a Ori.",
  },
  en: {
    wrong: "That's not it",
    local: "This stays in your browser and is only used when you tap Ori.",
  },
} as const;

/**
 * Tells the learner what Ori understood they were pointing at, so they can correct it before
 * anything is asked (issue #1209, part c). `onCorrect` falls back to the whole screen.
 */
export function OriContextNote({
  context,
  locale,
  onCorrect,
}: {
  readonly context: OriContext;
  readonly locale: Locale;
  readonly onCorrect: () => void;
}) {
  const copy = COPY[locale];
  const narrowed = Boolean(context.panel ?? context.block ?? context.sprite);
  return (
    <div className="kids-ori-context-note" role="status">
      <p>{describeContext(context, locale)}</p>
      {narrowed ? (
        <button type="button" className="kids-button" onClick={onCorrect}>
          {copy.wrong}
        </button>
      ) : null}
      <small>{copy.local}</small>
    </div>
  );
}
