import type { Locale } from "../../i18n.js";

/**
 * A line over the run: drag to any step and the stage shows how things were then. It reads only
 * the frames the run already recorded, so it never changes anything. Marks show where Ori noticed
 * something.
 */
export function KidsTimeline({
  count,
  frame,
  seconds,
  marks,
  locale,
  onSeek,
}: {
  /** How many steps the run recorded. */
  readonly count: number;
  /** The step shown, or null for the end of the run. */
  readonly frame: number | null;
  /** The virtual second of the shown step, when the run recorded it. */
  readonly seconds?: number | undefined;
  readonly marks: readonly number[];
  readonly locale: Locale;
  readonly onSeek: (frame: number | null) => void;
}) {
  if (count < 2) return null;
  const es = locale === "es";
  const shown = frame ?? count - 1;
  const when =
    seconds === undefined
      ? ""
      : ` · ${seconds.toFixed(1).replace(".", es ? "," : ".")} ${es ? "s" : "s"}`;
  const label = es
    ? `Paso ${shown + 1} de ${count}${when}`
    : `Step ${shown + 1} of ${count}${when}`;
  return (
    <div className="kids-timeline">
      <label>
        <span className="kids-visually-hidden">{es ? "Línea de tiempo" : "Timeline"}</span>
        <input
          type="range"
          min={0}
          max={count - 1}
          step={1}
          value={shown}
          aria-valuetext={label}
          onChange={(event) => {
            const next = Number(event.target.value);
            onSeek(next >= count - 1 ? null : next);
          }}
        />
      </label>
      <span className="kids-timeline-marks" aria-hidden="true">
        {marks.map((mark) => (
          <i key={mark} style={{ left: `${(mark / (count - 1)) * 100}%` }} />
        ))}
      </span>
      <small aria-hidden="true">{label}</small>
    </div>
  );
}
