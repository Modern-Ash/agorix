import type { Locale } from "../../i18n.js";
import type { Divergence } from "../kidsRunCompare.js";

const WORDS: Readonly<Record<string, readonly [string, string]>> = {
  move: ["Mover", "Move"],
  turn: ["Girar", "Turn"],
  goTo: ["Ir a posición", "Go to position"],
  say: ["Decir", "Say"],
  think: ["Pensar", "Think"],
  wait: ["Esperar", "Wait"],
  setVariable: ["Fijar valor", "Set value"],
  changeVariable: ["Cambiar valor", "Change value"],
  repeat: ["Repetir", "Repeat"],
  forever: ["Siempre", "Forever"],
  if: ["Si", "If"],
  playSound: ["Sonido", "Sound"],
};

/**
 * The last run next to this one: where they stop agreeing, said in one sentence from the two
 * traces. Pressing the button goes to that step of this run.
 */
export function KidsRunCompare({
  divergence,
  locale,
  onSeek,
}: {
  readonly divergence: Divergence;
  readonly locale: Locale;
  readonly onSeek: (traceIndex: number) => void;
}) {
  const es = locale === "es";
  const name = (type: string) => WORDS[type]?.[es ? 0 : 1] ?? type;
  let sentence: string;
  let at: number | null = null;
  if (divergence.kind === "same") {
    sentence = es
      ? `Igual que la vez anterior: los ${divergence.steps} pasos son los mismos.`
      : `Same as last time: all ${divergence.steps} steps are the same.`;
  } else if (divergence.kind === "longer") {
    at = divergence.index;
    sentence = es
      ? `Igual hasta el paso ${divergence.index}; antes eran ${divergence.before} pasos y ahora ${divergence.after}.`
      : `Same up to step ${divergence.index}; it was ${divergence.before} steps and now it is ${divergence.after}.`;
  } else {
    at = divergence.index;
    const n = divergence.index + 1;
    const { before, after } = divergence;
    sentence =
      divergence.what === "block"
        ? es
          ? `Igual hasta el paso ${n - 1}. En el paso ${n} antes era «${name(before.statementType)}» y ahora «${name(after.statementType)}».`
          : `Same up to step ${n - 1}. At step ${n} it was “${name(before.statementType)}” and now “${name(after.statementType)}”.`
        : divergence.what === "position"
          ? es
            ? `Igual hasta el paso ${n - 1}. En el paso ${n} (${name(after.statementType)}) antes terminaba en (${before.x}, ${before.y}) y ahora en (${after.x}, ${after.y}).`
            : `Same up to step ${n - 1}. At step ${n} (${name(after.statementType)}) it used to end at (${before.x}, ${before.y}) and now at (${after.x}, ${after.y}).`
          : es
            ? `Igual hasta el paso ${n - 1}. En el paso ${n} (${name(after.statementType)}) un valor cambió distinto.`
            : `Same up to step ${n - 1}. At step ${n} (${name(after.statementType)}) a value came out different.`;
  }
  return (
    <details className="kids-run-history kids-run-compare">
      <summary>{es ? "Comparar con la vez anterior" : "Compare with last time"}</summary>
      <p className="kids-note" role="status">
        {sentence}
      </p>
      {at !== null ? (
        <button type="button" className="kids-button" onClick={() => onSeek(at)}>
          {es ? "Ir a ese paso" : "Go to that step"}
        </button>
      ) : null}
    </details>
  );
}
