import { useState } from "react";
import { acceptProposal, rejectProposal } from "@agorix/proposals";
import type { ProjectProgram } from "@agorix/program-model";
import type { MultiActorRunResult } from "@agorix/runtime";
import type { Locale } from "../../i18n.js";
import {
  diagnoseLoop,
  explainTrigger,
  foreverExit,
  proposeForeverExit,
  reviewForeverExit,
} from "../kidsOriLoopDebug.js";

interface Props {
  readonly locale: Locale;
  readonly program: ProjectProgram;
  readonly run: MultiActorRunResult | null;
  readonly actorId: string;
  /** The child accepted Ori's exit: the new canonical program, recorded as one undoable step. */
  readonly onApplyProgram: (program: ProjectProgram, label: string) => void;
}

/**
 * Ori explains a loop that did not end, from the run's own trace, and may offer one visible
 * change the child accepts or declines (issue #1132). Nothing changes until the child accepts.
 */
export function KidsLoopHelp({ locale, program, run, actorId, onApplyProgram }: Props) {
  const [declined, setDeclined] = useState<string | null>(null);
  const es = locale === "es";
  const diagnosis = run ? diagnoseLoop(program, run, actorId, locale) : null;
  if (!diagnosis) return null;
  const script = program.scripts[diagnosis.scriptIndex]!;
  // A "not now" holds for this exact script; changing it asks again.
  const key = JSON.stringify(script.statements);
  const original = script.statements[diagnosis.statementIndex];
  const review = (() => {
    if (declined === key || diagnosis.kind !== "forever" || !original || !foreverExit(original))
      return null;
    try {
      return reviewForeverExit(program, diagnosis, proposeForeverExit(program, diagnosis, locale));
    } catch {
      return null;
    }
  })();
  return (
    <aside className="kids-ori-chat" aria-label={es ? "Ori y el bucle" : "Ori and the loop"}>
      <div className="kids-ori-chat-heading">
        <strong>✦ Ori</strong>
      </div>
      <div className="kids-ori-proposal" data-testid="ori-loop-help">
        {diagnosis.evidence.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="kids-note" data-testid="ori-loop-trigger">
          {explainTrigger(script.trigger, locale)}
        </p>
        {review ? (
          <>
            <p>{review.proposal.rationale}</p>
            <p className="kids-note">
              {es
                ? "Idea de Ori: todavía no está en tu programa. Revisá el cambio antes de decidir."
                : "Ori's idea is not in your program yet. Review the change before deciding."}
            </p>
            <strong data-testid="ori-loop-diff">
              + {es ? "Si toca el borde → Detener" : "If touching the edge → Stop"}
            </strong>
            <div className="kids-ori-actions">
              <button
                type="button"
                className="kids-button kids-primary"
                onClick={() =>
                  onApplyProgram(acceptProposal(program, review).program, "Ori loop exit")
                }
              >
                {es ? "Usar este cambio" : "Use this change"}
              </button>
              <button
                type="button"
                className="kids-button"
                onClick={() => {
                  rejectProposal(program, review);
                  setDeclined(key);
                }}
              >
                {es ? "Ahora no" : "Not now"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
