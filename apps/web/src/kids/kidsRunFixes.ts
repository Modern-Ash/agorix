import type { ProjectProgram, Statement } from "@agorix/program-model";
import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import type { Finding } from "@agorix/run-evidence";
import type { Locale } from "../i18n.js";
import { actorOfScript, studioActorId, validateStudioProgram } from "./kidsStudioModel.js";

/**
 * The one change Ori can offer for a finding, and only where it is obvious. It is a proposal like
 * any other: not in the program until the learner accepts it, with the exact block shown first.
 * Today: a script waits for a message that nothing sends, so Ori offers to send it from the first
 * character that starts with the green flag.
 */
export interface RunFix {
  readonly scriptIndex: number;
  readonly statement: Statement;
  readonly actorId: string;
}

export function fixFor(finding: Finding, raw: ProjectProgram): RunFix | null {
  let program: ProjectProgram;
  try {
    program = validateStudioProgram(raw);
  } catch {
    return null;
  }
  const place = /^scripts\[(\d+)\]/.exec(finding.nodeIds[0] ?? "");
  const placeIndex = place ? Number(place[1]) : -1;
  let scriptIndex = -1;
  let statement: Statement | null = null;
  if (
    finding.kind === "neverStarted" &&
    finding.event?.type === "message" &&
    finding.event.name !== undefined &&
    (finding.counts["senders"] ?? 0) === 0
  ) {
    // Send the missing message from the first other character that starts with the green flag.
    scriptIndex = program.scripts.findIndex(
      (script, index) => index !== placeIndex && script.trigger.type === "greenFlag",
    );
    statement = { type: "broadcast", message: finding.event.name };
  } else if (finding.kind === "hiddenCharacter" && placeIndex >= 0) {
    // The hide came from this script: show the character again at its end.
    scriptIndex = placeIndex;
    statement = { type: "show" };
  }
  const script = program.scripts[scriptIndex];
  if (script === undefined || statement === null) return null;
  const owner = actorOfScript(script.id);
  if (!owner) return null;
  try {
    validateStudioProgram({
      ...program,
      scripts: program.scripts.map((item, index) =>
        index === scriptIndex ? { ...item, statements: [...item.statements, statement!] } : item,
      ),
    });
  } catch {
    return null;
  }
  return { scriptIndex, statement, actorId: studioActorId(owner.index, owner.characterId) };
}

export function explainFix(finding: Finding, locale: Locale): string {
  if (finding.kind === "hiddenCharacter")
    return locale === "es"
      ? "Si al final agregás «Mostrar», el personaje vuelve a verse."
      : "If you add “Show” at the end, the character is seen again.";
  const name = finding.event?.name ?? "";
  return locale === "es"
    ? `Si otro personaje manda el mensaje «${name}», este programa va a poder empezar.`
    : `If another character sends the message “${name}”, this program can start.`;
}

export function proposeRunFix(
  program: ProjectProgram,
  finding: Finding,
  locale: Locale,
): ProgramProposal {
  const current = validateStudioProgram(program);
  const fix = fixFor(finding, current);
  if (!fix) throw new Error("no fix to offer");
  const script = current.scripts[fix.scriptIndex]!;
  const nodeId = `scripts[${fix.scriptIndex}]/statements[${script.statements.length}]`;
  const proposal = createProgramProposal({
    id: `ori-run-fix-${finding.id}`,
    baseProgram: current,
    source: { kind: "learning-companion", capability: "builder" },
    purpose:
      finding.kind === "hiddenCharacter"
        ? locale === "es"
          ? "Volver a mostrar al personaje"
          : "Show the character again"
        : locale === "es"
          ? "Mandar el mensaje que falta"
          : "Send the missing message",
    rationale: explainFix(finding, locale),
    affectedActorIds: [fix.actorId],
    affectedScriptIds: [script.id],
    affectedNodeIds: [nodeId],
    operations: [
      { type: "appendStatement", scriptIndex: fix.scriptIndex, statement: fix.statement },
    ],
  });
  reviewRunFix(current, finding, proposal);
  return proposal;
}

/** Recheck the finding and the exact block before showing or accepting anything. */
export function reviewRunFix(
  program: ProjectProgram,
  finding: Finding,
  raw: ProgramProposal,
): ProposalReview {
  const current = validateStudioProgram(program);
  const fix = fixFor(finding, current);
  const proposal = validateProgramProposal(raw);
  const operation = proposal.operations[0];
  if (
    !fix ||
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "appendStatement" ||
    operation.scriptIndex !== fix.scriptIndex ||
    JSON.stringify(operation.statement) !== JSON.stringify(fix.statement)
  )
    throw new Error("Ori fix is outside the closed scene contract");
  return createProposalReview(current, proposal);
}
