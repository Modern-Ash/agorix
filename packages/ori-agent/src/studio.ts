import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import type { OriTextModel } from "./index.js";

export const ORI_STUDIO_VERSION = "agorix/ori-studio/v1";
export interface OriStudioContext {
  readonly actorId: string;
  readonly locale: "es" | "en";
  readonly program: ProjectProgram;
}
export interface OriStudioDecision {
  readonly source: "model" | "fallback" | "refusal";
  readonly message: string;
  readonly proposal?: ProgramProposal;
}

const SCRIPT_ID = /^studio-actor-([1-9][0-9]?)-([a-z]+)$/;
const MAX_OUTPUT_CHARS = 4096;
const MAX_SCRIPTS = 12;
const MAX_STATEMENTS = 60;

function actorIdForScript(id: string): string {
  return `actor:${id.replace(/^studio-actor-/, "studio-")}`;
}

function target(context: OriStudioContext) {
  if (context.locale !== "es" && context.locale !== "en") throw new Error("invalid locale");
  const program = validateProgram(context.program);
  if (
    program.scripts.length < 1 ||
    program.scripts.length > MAX_SCRIPTS ||
    (program.variables?.length ?? 0) > 3 ||
    (program.lists?.length ?? 0) > 3 ||
    program.scripts.some((script, index) => {
      const match = SCRIPT_ID.exec(script.id);
      return (
        !match ||
        Number(match[1]) !== index + 1 ||
        !["greenFlag", "onActorClicked", "onKeyPressed", "onMessage"].includes(
          script.trigger.type,
        ) ||
        script.statements.length > MAX_STATEMENTS
      );
    })
  )
    throw new Error("program is outside Kids studio");
  const index = program.scripts.findIndex(
    (script) => actorIdForScript(script.id) === context.actorId,
  );
  if (index < 0) throw new Error("actor is outside Kids studio");
  return { program, index, script: program.scripts[index]! };
}

function allowed(statement: Statement): boolean {
  return (
    (statement.type === "move" && [40, 80, 120, 160, 200].includes(statement.steps)) ||
    (statement.type === "turn" && [-90, 90].includes(statement.degrees))
  );
}

export function createOriStudioInput(context: OriStudioContext) {
  const selected = target(context);
  return {
    version: ORI_STUDIO_VERSION,
    locale: context.locale,
    actorId: context.actorId,
    actorCount: selected.program.scripts.length,
    selectedBlocks: selected.script.statements.map((statement) => statement.type),
    allowedBlocks: [
      { type: "move", steps: 40 },
      { type: "move", steps: 80 },
      { type: "turn", degrees: -90 },
      { type: "turn", degrees: 90 },
    ],
  } as const;
}

export function getOriStudioInstructions(locale: "es" | "en"): string {
  const contract = `Contract ${ORI_STUDIO_VERSION}. Return exactly one JSON object: {"version":"${ORI_STUDIO_VERSION}","kind":"program-suggestion","actorId":"<input.actorId>","block":{"type":"move","steps":40|80|120|160|200}} or use {"type":"turn","degrees":-90|90}; alternatively {"version":"${ORI_STUDIO_VERSION}","kind":"refusal"}. No other keys, prose, links, tools or personal data. Use only the selected actor. Never claim the program ran. The child reviews before any change.`;
  return locale === "es"
    ? `Sos Ori. Sugerí un solo movimiento o giro para el personaje elegido en Agorix. El niño decide y el programa prueba. ${contract}`
    : `You are Ori. Suggest one move or turn for the selected Agorix character. The child decides and the program proves. ${contract}`;
}

function proposalFor(context: OriStudioContext, statement: Statement): ProgramProposal {
  const selected = target(context);
  if (!allowed(statement)) throw new Error("unsupported studio idea");
  const proposal = createProgramProposal({
    id: `ori-studio-${selected.index}-${selected.script.statements.length}`,
    baseProgram: selected.program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: context.locale === "es" ? "Una idea para tu escena" : "An idea for your scene",
    rationale:
      context.locale === "es"
        ? "Mirá el bloque y decidí si querés usarlo."
        : "Look at the block and decide whether to use it.",
    affectedActorIds: [context.actorId],
    affectedScriptIds: [selected.script.id],
    affectedNodeIds: [
      `scripts[${selected.index}]/statements[${selected.script.statements.length}]`,
    ],
    operations: [{ type: "appendStatement", scriptIndex: selected.index, statement }],
  });
  validateOriStudioProposal(context, proposal);
  return proposal;
}

/** Repeat host checks in the browser before showing model bytes to a child. */
export function validateOriStudioProposal(context: OriStudioContext, raw: unknown): ProposalReview {
  const selected = target(context);
  const proposal = validateProgramProposal(raw as ProgramProposal);
  const operation = proposal.operations[0];
  if (
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "appendStatement" ||
    operation.scriptIndex !== selected.index ||
    !allowed(operation.statement) ||
    proposal.affectedActorIds?.join() !== context.actorId ||
    proposal.affectedScriptIds?.join() !== selected.script.id ||
    proposal.affectedNodeIds.join() !==
      `scripts[${selected.index}]/statements[${selected.script.statements.length}]`
  )
    throw new Error("proposal outside studio allow-list");
  return createProposalReview(selected.program, proposal, {
    actors: selected.program.scripts.map((script) => ({
      id: actorIdForScript(script.id),
      scripts: [script.id],
    })),
  });
}

function fallback(context: OriStudioContext): OriStudioDecision {
  const selected = target(context);
  const last = selected.script.statements.at(-1);
  const statement: Statement =
    last?.type === "move" ? { type: "turn", degrees: 90 } : { type: "move", steps: 40 };
  return {
    source: "fallback",
    message:
      context.locale === "es"
        ? "Ori tiene una idea para mirar y decidir."
        : "Ori has an idea to inspect and decide.",
    proposal: proposalFor(context, statement),
  };
}

export function evaluateOriStudioOutput(
  context: OriStudioContext,
  raw: unknown,
): OriStudioDecision {
  target(context);
  try {
    const parsed =
      typeof raw === "string" && raw.length <= MAX_OUTPUT_CHARS ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid output");
    const value = parsed as Record<string, unknown>;
    if (value.version !== ORI_STUDIO_VERSION) throw new Error("invalid version");
    if (value.kind === "refusal" && Object.keys(value).sort().join() === "kind,version")
      return {
        source: "refusal",
        message:
          context.locale === "es"
            ? "Solo puedo ayudarte con tu escena en Agorix."
            : "I can only help with your Agorix scene.",
      };
    if (
      value.kind !== "program-suggestion" ||
      Object.keys(value).sort().join() !== "actorId,block,kind,version" ||
      value.actorId !== context.actorId ||
      !value.block ||
      typeof value.block !== "object" ||
      Array.isArray(value.block)
    )
      throw new Error("invalid suggestion");
    const block = value.block as Record<string, unknown>;
    const statement: Statement =
      block.type === "move" &&
      Object.keys(block).sort().join() === "steps,type" &&
      [40, 80, 120, 160, 200].includes(block.steps as number)
        ? { type: "move", steps: block.steps as number }
        : block.type === "turn" &&
            Object.keys(block).sort().join() === "degrees,type" &&
            [-90, 90].includes(block.degrees as number)
          ? { type: "turn", degrees: block.degrees as number }
          : (() => {
              throw new Error("unsupported block");
            })();
    return {
      source: "model",
      message:
        context.locale === "es"
          ? "Ori tiene una idea para tu escena. Mirala y decidí vos."
          : "Ori has an idea for your scene. Look at it and decide.",
      proposal: proposalFor(context, statement),
    };
  } catch {
    return fallback(context);
  }
}

export async function runOriStudio(
  context: OriStudioContext,
  model?: OriTextModel,
): Promise<OriStudioDecision> {
  createOriStudioInput(context);
  if (!model) return fallback(context);
  try {
    const output = await model.generate(
      getOriStudioInstructions(context.locale),
      JSON.stringify(createOriStudioInput(context)),
    );
    return evaluateOriStudioOutput(context, output);
  } catch {
    return fallback(context);
  }
}
