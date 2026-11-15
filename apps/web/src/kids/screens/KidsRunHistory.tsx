import type { Locale } from "../../i18n.js";
import type { ValueChange } from "../kidsRunHistory.js";

const BLOCK_WORDS: Readonly<Record<string, readonly [string, string]>> = {
  setVariable: ["Fijar valor", "Set value"],
  changeVariable: ["Cambiar valor", "Change value"],
  setText: ["Fijar palabra", "Set word"],
  askText: ["Preguntar", "Ask"],
};

/**
 * What changed during the last run: each number or word that took a new value, with the block that
 * did it. Pressing one goes to that step of the run. All of it comes from the run's own trace.
 */
export function KidsRunHistory({
  changes,
  more,
  frame,
  locale,
  onSeek,
}: {
  readonly changes: readonly ValueChange[];
  readonly more: number;
  /** The step shown, or null for the end of the run. */
  readonly frame: number | null;
  readonly locale: Locale;
  readonly onSeek: (traceIndex: number) => void;
}) {
  if (changes.length === 0) return null;
  const es = locale === "es";
  return (
    <details className="kids-run-history">
      <summary>
        {es ? `Qué cambió (${changes.length + more})` : `What changed (${changes.length + more})`}
      </summary>
      <ol>
        {changes.map((change) => {
          const word = BLOCK_WORDS[change.statementType]?.[es ? 0 : 1] ?? change.statementType;
          return (
            <li key={`${change.traceIndex}:${change.variableId}`}>
              <button
                type="button"
                className="kids-button"
                aria-current={frame === change.traceIndex ? "step" : undefined}
                onClick={() => onSeek(change.traceIndex)}
              >
                {es ? "Paso" : "Step"} {change.traceIndex + 1}: {change.name} {String(change.from)}{" "}
                → {String(change.to)} · {word}
              </button>
            </li>
          );
        })}
      </ol>
      {more > 0 ? (
        <p className="kids-note">
          {es ? `Y ${more} cambio(s) más.` : `And ${more} more change(s).`}
        </p>
      ) : null}
    </details>
  );
}
