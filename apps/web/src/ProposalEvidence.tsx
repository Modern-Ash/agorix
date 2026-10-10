import type { ProposalEvidenceIds, ProposalEvidenceView } from "@agorix/proposals";
import type { Locale } from "./i18n.js";
import { t } from "./i18n.js";

const flatten = (ids: ProposalEvidenceIds): string[] => [
  ...ids.actorIds,
  ...ids.scriptIds,
  ...ids.assetIds,
  ...ids.variableIds,
];

const STATUS_KEY = {
  proved: "proposalProofProved",
  partial: "proposalProofPartial",
  unproven: "proposalProofUnproven",
} as const;

/** The same suggested / accepted / proved rows Studio shows, built from one shared view. */
export function ProposalEvidence({
  view,
  locale,
}: {
  readonly view: ProposalEvidenceView;
  readonly locale: Locale;
}) {
  const missing =
    view.proved === undefined
      ? []
      : [...flatten(view.proved.missing), ...view.proved.missing.nodeIds];
  return (
    <ol className="proposal-evidence-trail" data-testid="proposal-evidence">
      <li>{t(locale, "proposalEvidenceSuggested", { ids: flatten(view.suggested).join(", ") })}</li>
      {view.accepted === undefined ? null : (
        <li>{t(locale, "proposalEvidenceAccepted", { decision: view.accepted.decision })}</li>
      )}
      {view.proved === undefined ? null : (
        <li>
          {t(locale, "proposalEvidenceProved", {
            status: t(locale, STATUS_KEY[view.proved.status]),
          })}
          {missing.length === 0 ? null : (
            <small> {t(locale, "proposalProofMissing", { ids: missing.join(", ") })}</small>
          )}
        </li>
      )}
    </ol>
  );
}
