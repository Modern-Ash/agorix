import { useEffect, useState } from "react";
import { acceptProposal, rejectProposal } from "@agorix/proposals";
import type { ProjectProgram } from "@agorix/program-model";
import type { Finding } from "@agorix/run-evidence";
import type { Locale } from "../../i18n.js";
import type { AgeBand } from "../kidsAgeBand.js";
import { findingSentence } from "../kidsRunFindings.js";
import { proposeRunFix, reviewRunFix } from "../kidsRunFixes.js";
import { requestFindingRephrase, type RephraseResult } from "../kidsFindingRephrase.js";

/** Once the server says there is no model, the button is not offered again in this session. */
let rephraseUnavailable = false;

/**
 * "Ori vio algo": a quiet marker after a run that looks wrong. Nothing speaks on its own; tapping
 * it shows one sentence of evidence from the run, can point at the block it is about and, where
 * the fix is obvious, offers it as a proposal the learner accepts or declines.
 */
export function KidsRunMarker({
  finding,
  program,
  locale,
  band,
  onShow,
  onShowWhen,
  onApplyProgram,
  onDecision,
  onShown,
  onRephrased,
}: {
  readonly finding: Finding;
  readonly program: ProjectProgram;
  readonly locale: Locale;
  readonly band: AgeBand;
  readonly onShow: (finding: Finding) => void;
  /** Jump the timeline to the moment it happened. */
  readonly onShowWhen: (traceIndex: number) => void;
  /** The learner accepted Ori's change: the new canonical program, recorded as one undoable step. */
  readonly onApplyProgram: (program: ProjectProgram, label: string) => void;
  /** The learner decided on the proposal, for the evidence log and the adult counters. */
  readonly onDecision: (decision: "accept" | "reject") => void;
  /** The marker was shown (once per run). */
  readonly onShown: () => void;
  /** The learner asked for another way to say it and got one. */
  readonly onRephrased: () => void;
}) {
  const [rephrase, setRephrase] = useState<RephraseResult | "loading" | null>(null);
  const [unavailable, setUnavailable] = useState(rephraseUnavailable);
  useEffect(() => {
    onShown();
    // Once, when the marker appears for this run.
  }, []);
  const [open, setOpen] = useState(false);
  const [declined, setDeclined] = useState(false);
  const es = locale === "es";
  const review = (() => {
    if (!open || declined) return null;
    try {
      return reviewRunFix(program, finding, proposeRunFix(program, finding, locale));
    } catch {
      return null;
    }
  })();
  const sent = review?.proposal.operations[0];
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
          {rephrase !== null && rephrase !== "loading" && rephrase.status === "ok" ? (
            <p className="kids-ori-rephrase" data-testid="ori-rephrase">
              <strong>{es ? "Ori lo dice así:" : "Ori puts it this way:"}</strong> {rephrase.text}
            </p>
          ) : null}
          {rephrase !== null && rephrase !== "loading" && rephrase.status === "failed" ? (
            <p className="kids-note" data-testid="ori-rephrase-failed">
              {es
                ? "Ahora no pude decirlo distinto. La primera frase sigue valiendo."
                : "I could not say it another way right now. The first sentence still holds."}
            </p>
          ) : null}
          {!unavailable &&
          (rephrase === null || rephrase === "loading" || rephrase.status !== "ok") ? (
            <button
              type="button"
              className="kids-button kids-ori-rephrase-button"
              disabled={rephrase === "loading"}
              onClick={() => {
                setRephrase("loading");
                void requestFindingRephrase(finding, locale, band).then((result) => {
                  if (result.status === "unavailable") {
                    rephraseUnavailable = true;
                    setUnavailable(true);
                    setRephrase(null);
                    return;
                  }
                  setRephrase(result);
                  if (result.status === "ok") onRephrased();
                });
              }}
            >
              {es ? "Decímelo de otra forma" : "Say it another way"}
            </button>
          ) : null}
          {finding.traceIndex !== undefined ? (
            <button
              type="button"
              className="kids-button kids-show-when"
              onClick={() => onShowWhen(finding.traceIndex!)}
            >
              {es ? "Ver cuándo pasó" : "See when it happened"}
            </button>
          ) : null}
          {review &&
          sent?.type === "appendStatement" &&
          (sent.statement.type === "broadcast" || sent.statement.type === "show") ? (
            <div className="kids-ori-proposal" data-testid="ori-fix">
              <p>{review.proposal.rationale}</p>
              <p className="kids-note">
                {es
                  ? "Idea de Ori: todavía no está en tu programa. Revisá el cambio antes de decidir."
                  : "Ori's idea is not in your program yet. Review the change before deciding."}
              </p>
              <strong data-testid="ori-fix-diff">
                +{" "}
                {sent.statement.type === "show"
                  ? es
                    ? "Mostrar"
                    : "Show"
                  : `${es ? "Enviar mensaje" : "Broadcast message"}: ${sent.statement.message}`}
              </strong>
              <div className="kids-ori-actions">
                <button
                  type="button"
                  className="kids-button kids-primary"
                  onClick={() => {
                    onDecision("accept");
                    onApplyProgram(acceptProposal(program, review).program, "Ori run fix");
                  }}
                >
                  {es ? "Usar este cambio" : "Use this change"}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() => {
                    rejectProposal(program, review);
                    onDecision("reject");
                    setDeclined(true);
                  }}
                >
                  {es ? "Ahora no" : "Not now"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
