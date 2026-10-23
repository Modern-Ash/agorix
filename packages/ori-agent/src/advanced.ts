import {
  createProgramProposal,
  createProposalReview,
  validateProgramProposal,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import type { OriTextModel } from "./index.js";

export const ORI_ADVANCED_VERSION = "agorix/ori-advanced/v1";
export type OriAdvancedActorId = "actor:ori" | "actor:friend";
export interface OriAdvancedContext {
  readonly stage: "scene";
  readonly actorId: OriAdvancedActorId;
  readonly locale: "es" | "en";
  readonly program: ProjectProgram;
}
export interface OriAdvancedDecision {
  readonly source: "model" | "fallback" | "refusal";
  readonly message: string;
  readonly proposal?: ProgramProposal;
}

const LOOK = "asset:costume.spark";
const SOUND = "asset:sound.beacon";
const MAX_OUTPUT_CHARS = 4096;

function sceneScript(context: OriAdvancedContext) {
  if (context.stage !== "scene" || !["actor:ori", "actor:friend"].includes(context.actorId))
    throw new Error("unsupported advanced stage or actor");
  if (context.locale !== "es" && context.locale !== "en") throw new Error("invalid locale");
  const program = validateProgram(context.program);
  if (
    program.scripts.length < 1 ||
    program.scripts.length > 2 ||
    program.scripts[0]?.id !== "advanced-scene" ||
    program.scripts.some(
      (script, index) =>
        (index === 1 && script.id !== "advanced-scene-friend") ||
        script.trigger.type !== "greenFlag" ||
        script.statements.length > 24 ||
        script.statements.some((statement) => !allowed(statement)),
    )
  )
    throw new Error("program is outside stage 1");
  const index = context.actorId === "actor:ori" ? 0 : 1;
  const script = program.scripts[index];
  if (index === 1 && script?.id !== "advanced-scene-friend") return null;
  return script === undefined ? null : { program, script, index };
}

function allowed(statement: Statement): boolean {
  return (
    (statement.type === "switchCostume" &&
      ["asset:costume.default", LOOK].includes(statement.costumeId)) ||
    (statement.type === "playSound" && statement.soundId === SOUND)
  );
}

export function createOriAdvancedInput(context: OriAdvancedContext) {
  const target = sceneScript(context);
  if (!target) throw new Error("selected actor has no scene script");
  return {
    version: ORI_ADVANCED_VERSION,
    stage: context.stage,
    actorId: context.actorId,
    locale: context.locale,
    program: target.program.scripts.map((script) => ({
      actorId: script.id === "advanced-scene" ? "actor:ori" : "actor:friend",
      blocks: script.statements.map((statement) =>
        statement.type === "switchCostume"
          ? { type: statement.type, costumeId: statement.costumeId }
          : { type: "playSound", soundId: SOUND },
      ),
    })),
    allowedBlocks: [
      { type: "switchCostume", costumeId: LOOK },
      { type: "playSound", soundId: SOUND },
    ],
  } as const;
}

export function getOriAdvancedInstructions(locale: "es" | "en"): string {
  const contract = `Contract ${ORI_ADVANCED_VERSION}. Return one JSON object only: {"version":"${ORI_ADVANCED_VERSION}","kind":"program-suggestion","actorId":"actor:ori|actor:friend","block":{"type":"switchCostume","costumeId":"${LOOK}"}} or the same with {"type":"playSound","soundId":"${SOUND}"}, or {"version":"${ORI_ADVANCED_VERSION}","kind":"refusal"}. Use only the selected input.actorId. No other keys, free text, links, tools or personal data. Never claim the program ran. The child must review before any change.`;
  return locale === "es"
    ? `Sos Ori. Sugerí solo un bloque de disfraz o sonido para la escena avanzada. La niña o el niño decide; el programa prueba. ${contract}`
    : `You are Ori. Suggest only one costume or sound block for the advanced scene. The child decides; the program proves. ${contract}`;
}

function makeProposal(context: OriAdvancedContext, statement: Statement): ProgramProposal {
  const target = sceneScript(context);
  if (!target || !allowed(statement)) throw new Error("invalid stage 1 proposal");
  const nodeId = `scripts[${target.index}]/statements[${target.script.statements.length}]`;
  const assetId = statement.type === "switchCostume" ? statement.costumeId : SOUND;
  const proposal = createProgramProposal({
    id: `ori-scene-${target.index}-${target.script.statements.length}`,
    baseProgram: target.program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: context.locale === "es" ? "Una idea para la escena" : "An idea for the scene",
    rationale:
      context.locale === "es"
        ? "Mirá el bloque y decidí si querés usarlo."
        : "Look at the block and decide whether to use it.",
    affectedActorIds: [context.actorId],
    affectedScriptIds: [target.script.id],
    affectedAssetIds: [assetId],
    affectedNodeIds: [nodeId],
    operations: [{ type: "appendStatement", scriptIndex: target.index, statement }],
  });
  validateOriAdvancedProposal(context, proposal);
  return proposal;
}

/** Both host and browser repeat the stage/actor/asset checks before displaying a proposal. */
export function validateOriAdvancedProposal(
  context: OriAdvancedContext,
  raw: unknown,
): ProposalReview {
  const target = sceneScript(context);
  if (!target) throw new Error("selected actor has no scene script");
  const proposal = validateProgramProposal(raw as ProgramProposal);
  const operation = proposal.operations[0];
  if (
    proposal.source.kind !== "learning-companion" ||
    proposal.source.capability !== "builder" ||
    proposal.operations.length !== 1 ||
    operation?.type !== "appendStatement" ||
    operation.scriptIndex !== target.index ||
    !allowed(operation.statement) ||
    proposal.affectedActorIds?.join() !== context.actorId ||
    proposal.affectedScriptIds?.join() !== target.script.id ||
    proposal.affectedAssetIds?.join() !==
      (operation.statement.type === "switchCostume" ? operation.statement.costumeId : SOUND) ||
    proposal.affectedNodeIds.join() !==
      `scripts[${target.index}]/statements[${target.script.statements.length}]`
  )
    throw new Error("proposal outside stage 1 allow-list");
  return createProposalReview(target.program, proposal, {
    actors: [
      { id: "actor:ori", scripts: ["advanced-scene"] },
      { id: "actor:friend", scripts: target.program.scripts[1] ? ["advanced-scene-friend"] : [] },
    ],
  });
}

function fallback(context: OriAdvancedContext): OriAdvancedDecision {
  const target = sceneScript(context);
  if (!target) {
    return {
      source: "fallback",
      message:
        context.locale === "es"
          ? "Agregá un bloque para este personaje y después miramos ideas."
          : "Add a block for this character, then we can look at ideas.",
    };
  }
  const statements = target.script.statements;
  const statement: Statement | undefined = !statements.some(
    (item) => item.type === "switchCostume" && item.costumeId === LOOK,
  )
    ? { type: "switchCostume", costumeId: LOOK }
    : !statements.some((item) => item.type === "playSound" && item.soundId === SOUND)
      ? { type: "playSound", soundId: SOUND }
      : undefined;
  return {
    source: "fallback",
    message:
      context.locale === "es"
        ? "Ori tiene una idea para mirar y decidir."
        : "Ori has an idea to inspect and decide.",
    ...(statement === undefined ? {} : { proposal: makeProposal(context, statement) }),
  };
}

export function evaluateOriAdvancedOutput(
  context: OriAdvancedContext,
  raw: unknown,
): OriAdvancedDecision {
  sceneScript(context);
  try {
    const parsed =
      typeof raw === "string" && raw.length <= MAX_OUTPUT_CHARS ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid output");
    const value = parsed as Record<string, unknown>;
    if (value.version !== ORI_ADVANCED_VERSION) throw new Error("invalid version");
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
      throw new Error("invalid output");
    const block = value.block as Record<string, unknown>;
    let statement: Statement;
    if (
      block.type === "switchCostume" &&
      Object.keys(block).sort().join() === "costumeId,type" &&
      block.costumeId === LOOK
    )
      statement = { type: "switchCostume", costumeId: LOOK };
    else if (
      block.type === "playSound" &&
      Object.keys(block).sort().join() === "soundId,type" &&
      block.soundId === SOUND
    )
      statement = { type: "playSound", soundId: SOUND };
    else throw new Error("unsupported stage 1 block");
    return {
      source: "model",
      message:
        context.locale === "es"
          ? "Ori tiene una idea para tu escena. Mirala y decidí vos."
          : "Ori has an idea for your scene. Look at it and decide.",
      proposal: makeProposal(context, statement),
    };
  } catch {
    return fallback(context);
  }
}

export async function runOriAdvanced(
  context: OriAdvancedContext,
  model?: OriTextModel,
): Promise<OriAdvancedDecision> {
  if (!sceneScript(context)) return fallback(context);
  const input = createOriAdvancedInput(context);
  if (!model) return fallback(context);
  try {
    const output = await model.generate(
      getOriAdvancedInstructions(context.locale),
      JSON.stringify(input),
    );
    return evaluateOriAdvancedOutput(context, output);
  } catch {
    return fallback(context);
  }
}
