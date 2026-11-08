import type { ProjectProgram, Statement } from "@agorix/program-model";
import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalOperation,
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
  /** The block the fix puts in the program: the one it adds, or the repeat that replaces a run. */
  readonly statement: Statement;
  readonly actorId: string;
  readonly operations: readonly ProposalOperation[];
  readonly affectedNodeIds: readonly string[];
}

/** The most times a Kids repeat block can hold; a run of four becomes three plus the leftover. */
const REPEAT_COUNTS = [5, 3, 2] as const;

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
  } else if (finding.kind === "repeatedBlocks") {
    // The run is in this script.
    scriptIndex = placeIndex;
  }
  const script = program.scripts[scriptIndex];
  if (script === undefined) return null;
  const owner = actorOfScript(script.id);
  if (!owner) return null;
  const actorId = studioActorId(owner.index, owner.characterId);
  let operations: ProposalOperation[];
  let affectedNodeIds: string[];
  let shown: Statement;
  let after: Statement[];
  if (statement !== null) {
    // One block added at the end of the script.
    operations = [{ type: "appendStatement", scriptIndex, statement }];
    affectedNodeIds = [`scripts[${scriptIndex}]/statements[${script.statements.length}]`];
    shown = statement;
    after = [...script.statements, statement];
  } else if (finding.kind === "repeatedBlocks") {
    const found = repeatFix(finding, script.statements, placeIndex === scriptIndex);
    if (found === null) return null;
    operations = found.operations(scriptIndex);
    affectedNodeIds = found.affected(scriptIndex);
    shown = found.repeat;
    after = found.after;
  } else return null;
  try {
    validateStudioProgram({
      ...program,
      scripts: program.scripts.map((item, index) =>
        index === scriptIndex ? { ...item, statements: after } : item,
      ),
    });
  } catch {
    return null;
  }
  return { scriptIndex, statement: shown, actorId, operations, affectedNodeIds };
}

/** One to three blocks written out in a row become one `repeat`; any leftover copy stays as is. */
function repeatFix(finding: Finding, statements: readonly Statement[], placed: boolean) {
  const place = /^scripts\[\d+\]\/statements\[(\d+)\]/.exec(finding.nodeIds[0] ?? "");
  const period = finding.counts["period"] ?? 0;
  const times = finding.counts["times"] ?? 0;
  if (!placed || !place || period < 1 || period > 3 || times < 3) return null;
  const start = Number(place[1]);
  const count = REPEAT_COUNTS.find((allowed) => allowed <= times);
  if (count === undefined) return null;
  const body = statements.slice(start, start + period);
  // Recheck that the run is really there, copy after copy.
  for (let copy = 1; copy < count; copy += 1)
    for (let offset = 0; offset < period; offset += 1)
      if (
        JSON.stringify(statements[start + copy * period + offset]) !== JSON.stringify(body[offset])
      )
        return null;
  const covered = period * count;
  const repeat: Statement = { type: "repeat", count, body };
  return {
    repeat,
    after: [...statements.slice(0, start), repeat, ...statements.slice(start + covered)],
    operations: (scriptIndex: number): ProposalOperation[] => [
      {
        type: "replaceStatement",
        nodeId: `scripts[${scriptIndex}]/statements[${start}]`,
        statement: repeat,
      },
      ...Array.from({ length: covered - 1 }, () => ({
        type: "removeStatement" as const,
        nodeId: `scripts[${scriptIndex}]/statements[${start + 1}]`,
      })),
    ],
    affected: (scriptIndex: number): string[] =>
      Array.from(
        { length: covered },
        (_, offset) => `scripts[${scriptIndex}]/statements[${start + offset}]`,
      ),
  };
}

export function explainFix(finding: Finding, locale: Locale): string {
  if (finding.kind === "repeatedBlocks")
    return locale === "es"
      ? "Si los metés en un «Repetir», el programa hace lo mismo con menos bloques."
      : "If you put them in a “Repeat”, the program does the same with fewer blocks.";
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
  const proposal = createProgramProposal({
    // A finding id can hold brackets and slashes (a place in the program); a proposal id cannot.
    id: `ori-run-fix-${finding.id.replace(/[^A-Za-z0-9_:-]+/g, "-")}`,
    baseProgram: current,
    source: { kind: "learning-companion", capability: "builder" },
    purpose:
      finding.kind === "repeatedBlocks"
        ? locale === "es"
          ? "Juntar los bloques repetidos"
          : "Join the repeated blocks"
        : finding.kind === "hiddenCharacter"
          ? locale === "es"
            ? "Volver a mostrar al personaje"
            : "Show the character again"
          : locale === "es"
            ? "Mandar el mensaje que falta"
            : "Send the missing message",
    rationale: explainFix(finding, locale),
    affectedActorIds: [fix.actorId],
    affectedScriptIds: [script.id],
    affectedNodeIds: [...fix.affectedNodeIds],
    operations: [...fix.operations],
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
  if (
    !fix ||
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    JSON.stringify(proposal.operations) !== JSON.stringify(fix.operations)
  )
    throw new Error("Ori fix is outside the closed scene contract");
  return createProposalReview(current, proposal);
}
