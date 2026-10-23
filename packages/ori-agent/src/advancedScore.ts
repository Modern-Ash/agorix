import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import type { OriTextModel } from "./index.js";
import type { OriAdvancedDecision } from "./advanced.js";

export const ORI_ADVANCED_SCORE_VERSION = "agorix/ori-advanced-score/v1";
export interface OriScoreContext {
  readonly stage: "score";
  readonly actorId: "actor:ori" | "actor:friend";
  readonly locale: "es" | "en";
  readonly program: ProjectProgram;
}

const SCORE = "score";
const LIST = "items";
const MAX_OUTPUT_CHARS = 4096;
type ScoreStatement = Extract<Statement, { type: "setVariable" | "changeVariable" }>;

function allowed(statement: Statement): boolean {
  return (
    (statement.type === "setVariable" &&
      statement.variableId === SCORE &&
      statement.value.type === "numericLiteral" &&
      Number.isInteger(statement.value.value) &&
      statement.value.value >= 0 &&
      statement.value.value <= 10) ||
    (statement.type === "changeVariable" &&
      statement.variableId === SCORE &&
      statement.delta.type === "numericLiteral" &&
      Number.isInteger(statement.delta.value) &&
      statement.delta.value >= 1 &&
      statement.delta.value <= 3)
  );
}

/** Existing child-authored data blocks are context only; Ori still proposes score blocks above. */
function allowedExisting(statement: Statement, hasList: boolean): boolean {
  if (allowed(statement)) return true;
  if (statement.type === "setVariable" && statement.variableId === SCORE) {
    const value = statement.value;
    if (
      (value.type === "add" || value.type === "subtract") &&
      value.left.type === "variable" &&
      value.left.variableId === SCORE &&
      value.right.type === "numericLiteral" &&
      Number.isInteger(value.right.value) &&
      value.right.value >= 1 &&
      value.right.value <= 5
    )
      return true;
    if (!hasList) return false;
    if (value.type === "listLength") return value.listId === LIST;
    if (value.type === "listItem")
      return (
        value.listId === LIST &&
        value.index.type === "numericLiteral" &&
        Number.isInteger(value.index.value)
      );
  }
  if (!hasList) return false;
  if (statement.type === "listAdd")
    return (
      statement.listId === LIST &&
      statement.value.type === "numericLiteral" &&
      Number.isInteger(statement.value.value)
    );
  if (statement.type === "listRemoveAt")
    return (
      statement.listId === LIST &&
      statement.index.type === "numericLiteral" &&
      Number.isInteger(statement.index.value)
    );
  return false;
}

function checked(context: OriScoreContext) {
  if (
    context.stage !== "score" ||
    context.actorId !== "actor:ori" ||
    !["es", "en"].includes(context.locale)
  )
    throw new Error("invalid score context");
  const program = validateProgram(context.program);
  const variable = program.variables?.[0];
  const script = program.scripts[0];
  const hasList =
    program.lists?.length === 1 && program.lists[0]?.id === LIST && program.lists[0].visible;
  if (
    program.variables?.length !== 1 ||
    variable?.id !== SCORE ||
    variable.initialValue !== 0 ||
    variable.visible !== true ||
    program.scripts.length !== 1 ||
    script?.id !== "advanced-score" ||
    script.trigger.type !== "greenFlag" ||
    (program.lists !== undefined && !hasList) ||
    script.statements.length > 200 ||
    script.statements.filter(allowed).length > 24 ||
    script.statements.some((statement) => !allowedExisting(statement, hasList))
  )
    throw new Error("program is outside stage 3");
  return { program, script };
}

export function createOriScoreInput(context: OriScoreContext) {
  const { script } = checked(context);
  return {
    version: ORI_ADVANCED_SCORE_VERSION,
    stage: "score",
    actorId: context.actorId,
    locale: context.locale,
    variable: SCORE,
    blocks: script.statements
      .filter(allowed)
      .map((statement) =>
        statement.type === "setVariable" && statement.value.type === "numericLiteral"
          ? { type: statement.type, value: statement.value.value }
          : statement.type === "changeVariable" && statement.delta.type === "numericLiteral"
            ? { type: statement.type, delta: statement.delta.value }
            : { type: "invalid" },
      ),
    allowedBlocks: [
      { type: "setVariable", variableId: SCORE, value: 2 },
      { type: "changeVariable", variableId: SCORE, delta: 1 },
    ],
  } as const;
}

export function getOriScoreInstructions(locale: "es" | "en"): string {
  const contract = `Contract ${ORI_ADVANCED_SCORE_VERSION}. Return one JSON object only: {"version":"${ORI_ADVANCED_SCORE_VERSION}","kind":"data-suggestion","actorId":"actor:ori","block":{"type":"setVariable","variableId":"score","value":2}} or the same with {"type":"changeVariable","variableId":"score","delta":1}, or {"version":"${ORI_ADVANCED_SCORE_VERSION}","kind":"refusal"}. No other keys, free text, links, tools or personal data. Never claim the program ran. The child reviews before any change.`;
  return locale === "es"
    ? `Sos Ori. Sugerí solo un bloque para el puntaje visible. La niña o el niño decide; el programa prueba. ${contract}`
    : `You are Ori. Suggest only one block for the visible score. The child decides; the program proves. ${contract}`;
}

function makeProposal(context: OriScoreContext, statement: ScoreStatement): ProgramProposal {
  const { program, script } = checked(context);
  if (!allowed(statement)) throw new Error("invalid score block");
  const proposal = createProgramProposal({
    id: `ori-score-${script.statements.length}`,
    baseProgram: program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: context.locale === "es" ? "Una idea para el puntaje" : "An idea for the score",
    rationale:
      context.locale === "es"
        ? "Mirá el bloque y decidí si querés usarlo."
        : "Look at the block and decide whether to use it.",
    affectedActorIds: ["actor:ori"],
    affectedScriptIds: [script.id],
    affectedNodeIds: [`scripts[0]/statements[${script.statements.length}]`],
    operations: [{ type: "appendStatement", scriptIndex: 0, statement }],
  });
  validateOriScoreProposal(context, proposal);
  return proposal;
}

export function validateOriScoreProposal(context: OriScoreContext, raw: unknown): ProposalReview {
  const { program, script } = checked(context);
  const proposal = validateProgramProposal(raw as ProgramProposal);
  const operation = proposal.operations[0];
  if (
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "appendStatement" ||
    operation.scriptIndex !== 0 ||
    !allowed(operation.statement) ||
    proposal.affectedActorIds?.join() !== "actor:ori" ||
    proposal.affectedScriptIds?.join() !== script.id ||
    (proposal.affectedAssetIds?.length ?? 0) !== 0 ||
    proposal.affectedNodeIds.join() !== `scripts[0]/statements[${script.statements.length}]`
  )
    throw new Error("proposal outside stage-3 data allow-list");
  return createProposalReview(program, proposal, {
    actors: [{ id: "actor:ori", scripts: [script.id] }],
  });
}

function fallback(context: OriScoreContext): OriAdvancedDecision {
  const { script } = checked(context);
  const statement: ScoreStatement =
    script.statements.length === 0
      ? { type: "changeVariable", variableId: SCORE, delta: { type: "numericLiteral", value: 1 } }
      : { type: "setVariable", variableId: SCORE, value: { type: "numericLiteral", value: 2 } };
  return {
    source: "fallback",
    message:
      context.locale === "es"
        ? "Ori tiene una idea para el puntaje. Mirala y decidí vos."
        : "Ori has an idea for the score. Look and decide.",
    proposal: makeProposal(context, statement),
  };
}

export function evaluateOriScoreOutput(
  context: OriScoreContext,
  raw: unknown,
): OriAdvancedDecision {
  checked(context);
  try {
    const parsed =
      typeof raw === "string" && raw.length <= MAX_OUTPUT_CHARS ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid output");
    const value = parsed as Record<string, unknown>;
    if (value.version !== ORI_ADVANCED_SCORE_VERSION) throw new Error("invalid version");
    if (value.kind === "refusal" && Object.keys(value).sort().join() === "kind,version")
      return {
        source: "refusal",
        message:
          context.locale === "es"
            ? "Solo puedo ayudarte con tu programa en Agorix."
            : "I can only help with your Agorix program.",
      };
    if (
      value.kind !== "data-suggestion" ||
      Object.keys(value).sort().join() !== "actorId,block,kind,version" ||
      value.actorId !== "actor:ori" ||
      !value.block ||
      typeof value.block !== "object" ||
      Array.isArray(value.block)
    )
      throw new Error("invalid data output");
    const block = value.block as Record<string, unknown>;
    let statement: ScoreStatement;
    if (
      block.type === "setVariable" &&
      Object.keys(block).sort().join() === "type,value,variableId" &&
      block.variableId === SCORE &&
      Number.isInteger(block.value) &&
      Number(block.value) >= 0 &&
      Number(block.value) <= 10
    )
      statement = {
        type: "setVariable",
        variableId: SCORE,
        value: { type: "numericLiteral", value: Number(block.value) },
      };
    else if (
      block.type === "changeVariable" &&
      Object.keys(block).sort().join() === "delta,type,variableId" &&
      block.variableId === SCORE &&
      Number.isInteger(block.delta) &&
      Number(block.delta) >= 1 &&
      Number(block.delta) <= 3
    )
      statement = {
        type: "changeVariable",
        variableId: SCORE,
        delta: { type: "numericLiteral", value: Number(block.delta) },
      };
    else throw new Error("unsupported score block");
    return {
      source: "model",
      message:
        context.locale === "es"
          ? "Ori tiene una idea para el puntaje. Mirala y decidí vos."
          : "Ori has an idea for the score. Look and decide.",
      proposal: makeProposal(context, statement),
    };
  } catch {
    return fallback(context);
  }
}

export async function runOriScore(
  context: OriScoreContext,
  model?: OriTextModel,
): Promise<OriAdvancedDecision> {
  if (!model) return fallback(context);
  try {
    const output = await model.generate(
      getOriScoreInstructions(context.locale),
      JSON.stringify(createOriScoreInput(context)),
    );
    return evaluateOriScoreOutput(context, output);
  } catch {
    return fallback(context);
  }
}
