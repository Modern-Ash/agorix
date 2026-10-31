import type { Expression, ProjectProgram, Statement } from "@agorix/program-model";
import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import type { Locale } from "../i18n.js";
import {
  STUDIO_EDGE_CONDITION,
  actorOfScript,
  studioActorId,
  validateStudioProgram,
} from "./kidsStudioModel.js";

export type OriCompoundJoin = "and" | "or";

function scriptIndex(program: ProjectProgram, actorId: string): number {
  const index = program.scripts.findIndex((script) => {
    const actor = actorOfScript(script.id);
    return actor !== null && studioActorId(actor.index, actor.characterId) === actorId;
  });
  if (index < 0) throw new Error("selected actor is absent");
  return index;
}

/** A small closed idea: the child can change AND to OR before accepting it. */
export function oriCompoundStatement(join: OriCompoundJoin): Statement {
  const key: Expression = { type: "keyDown", key: "Space" };
  const edge: Expression = STUDIO_EDGE_CONDITION;
  return {
    type: "if",
    condition: { type: join, left: key, right: edge },
    then: [{ type: "move", steps: 40 }],
  };
}

export function explainOriCompound(join: OriCompoundJoin, locale: Locale): string {
  if (locale === "es")
    return join === "and"
      ? "Con «y», moverá solo si se pulsa Espacio y el personaje toca el borde."
      : "Con «o», moverá si se pulsa Espacio o el personaje toca el borde.";
  return join === "and"
    ? "With ‘and’, it moves only when Space is pressed and the character touches the edge."
    : "With ‘or’, it moves when Space is pressed or the character touches the edge.";
}

export function proposeOriCompound(
  program: ProjectProgram,
  actorId: string,
  join: OriCompoundJoin,
  locale: Locale,
): ProgramProposal {
  const current = validateStudioProgram(program);
  const index = scriptIndex(current, actorId);
  const script = current.scripts[index]!;
  if (script.statements.length >= 60) throw new Error("script is full");
  const proposal = createProgramProposal({
    id: `ori-compound-${index}-${script.statements.length}-${join}`,
    baseProgram: current,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: locale === "es" ? "Combinar dos condiciones" : "Combine two conditions",
    rationale: explainOriCompound(join, locale),
    affectedActorIds: [actorId],
    affectedScriptIds: [script.id],
    affectedNodeIds: [`scripts[${index}]/statements[${script.statements.length}]`],
    operations: [
      { type: "appendStatement", scriptIndex: index, statement: oriCompoundStatement(join) },
    ],
  });
  reviewOriCompound(current, actorId, proposal);
  return proposal;
}

/** Recheck actor, append position and exact closed statement before showing or accepting bytes. */
export function reviewOriCompound(
  program: ProjectProgram,
  actorId: string,
  raw: ProgramProposal,
): ProposalReview {
  const current = validateStudioProgram(program);
  const index = scriptIndex(current, actorId);
  const script = current.scripts[index]!;
  const proposal = validateProgramProposal(raw);
  const operation = proposal.operations[0];
  const expected = [oriCompoundStatement("and"), oriCompoundStatement("or")];
  if (
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "appendStatement" ||
    operation.scriptIndex !== index ||
    !expected.some(
      (statement) => JSON.stringify(statement) === JSON.stringify(operation.statement),
    ) ||
    proposal.affectedActorIds?.join() !== actorId ||
    proposal.affectedScriptIds?.join() !== script.id ||
    proposal.affectedNodeIds.join() !== `scripts[${index}]/statements[${script.statements.length}]`
  )
    throw new Error("Ori compound idea is outside the closed scene contract");
  return createProposalReview(current, proposal);
}
