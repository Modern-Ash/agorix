import type { ProjectSceneGoal } from "@agorix/persistence";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import type { Locale } from "../i18n.js";
import { usedBlockKinds } from "./kidsPaletteCatalog.js";
import { actorOfScript, studioActorId, validateStudioProgram } from "./kidsStudioModel.js";

/** Blocks Ori may suggest for a goal; each one is a closed, valid scene statement. */
export type OriGoalBlockKind = "move" | "pointTowards" | "repeat";

function scriptIndex(program: ProjectProgram, actorId: string): number {
  const index = program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  if (index < 0) throw new Error("goal character is absent");
  return index;
}

export function oriGoalStatement(kind: OriGoalBlockKind, goal: ProjectSceneGoal): Statement {
  if (kind === "move") return { type: "move", steps: 40 };
  if (kind === "repeat") return { type: "repeat", count: 5, body: [{ type: "move", steps: 40 }] };
  if (goal.kind !== "touchActor") throw new Error("only a touch goal points at someone");
  return { type: "pointTowards", actorId: goal.targetId };
}

/**
 * Blocks that would help this goal and that the goal character's script has not used yet, best
 * first. Local and deterministic: it reads the program, never the child's text.
 */
export function goalBlockCandidates(
  program: ProjectProgram,
  goal: ProjectSceneGoal,
): readonly OriGoalBlockKind[] {
  const script = program.scripts[scriptIndex(program, goal.actorId)]!;
  const used = usedBlockKinds(script.statements);
  const moves = used.has("move") || used.has("glideTo");
  const wanted: OriGoalBlockKind[] = [];
  if (!moves) wanted.push("move");
  if (goal.kind === "touchActor" && !used.has("pointTowards")) wanted.push("pointTowards");
  if (!used.has("repeat")) wanted.push("repeat");
  return wanted;
}

export function explainOriGoalBlock(
  kind: OriGoalBlockKind,
  goal: ProjectSceneGoal,
  names: (actorId: string) => string,
  locale: Locale,
): string {
  const who = names(goal.actorId);
  const es = locale === "es";
  if (kind === "move")
    return es
      ? `${who} todavía no se mueve. Un bloque «Mover» lo acerca a la meta.`
      : `${who} does not move yet. A “Move” block takes it toward the goal.`;
  if (kind === "pointTowards")
    return es
      ? `Para tocar a ${names(goal.kind === "touchActor" ? goal.targetId : goal.actorId)}, ${who} puede mirar hacia allá antes de moverse.`
      : `To touch ${names(goal.kind === "touchActor" ? goal.targetId : goal.actorId)}, ${who} can face that way before moving.`;
  return es
    ? "«Repetir» mueve varias veces con un solo bloque, así llegás más lejos."
    : "“Repeat” moves several times with one block, so it goes farther.";
}

export function proposeOriGoalBlock(
  program: ProjectProgram,
  goal: ProjectSceneGoal,
  kind: OriGoalBlockKind,
  names: (actorId: string) => string,
  locale: Locale,
): ProgramProposal {
  const current = validateStudioProgram(program);
  const index = scriptIndex(current, goal.actorId);
  const script = current.scripts[index]!;
  if (script.statements.length >= 60) throw new Error("script is full");
  if (!goalBlockCandidates(current, goal).includes(kind)) throw new Error("block is not needed");
  const proposal = createProgramProposal({
    id: `ori-goal-block-${index}-${script.statements.length}-${kind}`,
    baseProgram: current,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: locale === "es" ? "Un bloque para tu meta" : "A block for your goal",
    rationale: explainOriGoalBlock(kind, goal, names, locale),
    affectedActorIds: [goal.actorId],
    affectedScriptIds: [script.id],
    affectedNodeIds: [`scripts[${index}]/statements[${script.statements.length}]`],
    operations: [
      { type: "appendStatement", scriptIndex: index, statement: oriGoalStatement(kind, goal) },
    ],
  });
  reviewOriGoalBlock(current, goal, proposal);
  return proposal;
}

/** Recheck character, position and exact closed statement before showing or accepting bytes. */
export function reviewOriGoalBlock(
  program: ProjectProgram,
  goal: ProjectSceneGoal,
  raw: ProgramProposal,
): ProposalReview {
  const current = validateStudioProgram(program);
  const index = scriptIndex(current, goal.actorId);
  const script = current.scripts[index]!;
  const proposal = validateProgramProposal(raw);
  const operation = proposal.operations[0];
  const allowed = (["move", "pointTowards", "repeat"] as const).flatMap((kind) => {
    try {
      return [JSON.stringify(oriGoalStatement(kind, goal))];
    } catch {
      return [];
    }
  });
  if (
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "appendStatement" ||
    operation.scriptIndex !== index ||
    !allowed.includes(JSON.stringify(operation.statement)) ||
    proposal.affectedActorIds?.join() !== goal.actorId ||
    proposal.affectedScriptIds?.join() !== script.id ||
    proposal.affectedNodeIds.join() !== `scripts[${index}]/statements[${script.statements.length}]`
  )
    throw new Error("Ori goal block is outside the closed scene contract");
  return createProposalReview(current, proposal);
}
