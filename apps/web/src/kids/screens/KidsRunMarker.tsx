import { useState } from "react";
import type { Finding } from "@agorix/run-evidence";
import type { Locale } from "../../i18n.js";
import type { AgeBand } from "../kidsAgeBand.js";
import { findingSentence } from "../kidsRunFindings.js";

/**
 * "Ori vio algo": a quiet marker after a run that looks wrong. Nothing speaks on its own; tapping
 * it shows one sentence of evidence from the run and can point at the block it is about.
 */
export function KidsRunMarker({
  finding,
  locale,
  band,
  onShow,
}: {
  readonly finding: Finding;
  readonly locale: Locale;
  readonly band: AgeBand;
  readonly onShow: (finding: Finding) => void;
}) {
  const [open, setOpen] = useState(false);
  const es = locale === "es";
  return (
    <section className="kids-ori-noticed" data-finding-kind={finding.kind}>
      <button
        type="button"
        className="kids-button kids-ori-noticed-button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">✦</span> {es ? "Ori vio algo" : "Ori noticed something"}
      </button>
      {open ? (
        <div className="kids-ori-noticed-panel" role="status">
          <p>{findingSentence(finding, locale, band)}</p>
          {finding.nodeIds.length > 0 ? (
            <button
              type="button"
              className="kids-button kids-show-in-program"
              onClick={() => onShow(finding)}
            >
              {es ? "Ver en el programa" : "Show in the program"}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
