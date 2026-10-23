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

export const ORI_ADVANCED_REACT_VERSION = "agorix/ori-advanced-react/v1";
export type OriReactActorId = "actor:ori" | "actor:friend";
export interface OriReactContext {
  readonly stage: "react";
  readonly actorId: OriReactActorId;
  readonly locale: "es" | "en";
  readonly program: ProjectProgram;
}

const LOOK = "asset:costume.spark";
const SOUND = "asset:sound.beacon";
const MAX_OUTPUT_CHARS = 4096;

function allowed(statement: Statement): boolean {
  return (
    (statement.type === "switchCostume" &&
      ["asset:costume.default", LOOK].includes(statement.costumeId)) ||
    (statement.type === "playSound" && statement.soundId === SOUND) ||
    (statement.type === "turn" && Math.abs(statement.degrees) === 90)
  );
}

function targetScript(context: OriReactContext) {
  if (
    context.stage !== "react" ||
    !["actor:ori", "actor:friend"].includes(context.actorId) ||
    (context.locale !== "es" && context.locale !== "en")
  )
    throw new Error("invalid stage-2 context");
  const program = validateProgram(context.program);
  if (
    program.scripts.length < 1 ||
    program.scripts.length > 2 ||
    program.scripts[0]?.id !== "advanced-react" ||
    program.scripts.some(
      (script, index) =>
        (index === 1 && script.id !== "advanced-react-friend") ||
        script.trigger.type !== "onActorClicked" ||
        script.statements.length > 24 ||
        script.statements.some((statement) => !allowed(statement)),
    )
  )
    throw new Error("program is outside stage 2");
  const index = context.actorId === "actor:ori" ? 0 : 1;
  const script = program.scripts[index];
  if (index === 1 && script?.id !== "advanced-react-friend") return null;
  return script ? { program, script, index } : null;
}

function assetId(statement: Statement): string | undefined {
  if (statement.type === "switchCostume") return statement.costumeId;
  if (statement.type === "playSound") return SOUND;
  return undefined;
}

export function createOriReactInput(context: OriReactContext) {
  const target = targetScript(context);
  if (!target) throw new Error("selected actor has no event script");
  return {
    version: ORI_ADVANCED_REACT_VERSION,
    stage: "react",
    event: "actorClicked",
    actorId: context.actorId,
    locale: context.locale,
    program: target.program.scripts.map((script) => ({
      actorId: script.id === "advanced-react" ? "actor:ori" : "actor:friend",
      event: "actorClicked",
      blocks: script.statements.map((statement) =>
        statement.type === "switchCostume"
          ? { type: statement.type, costumeId: statement.costumeId }
          : statement.type === "playSound"
            ? { type: statement.type, soundId: SOUND }
            : {
                type: "turn",
                degrees: (statement as Extract<Statement, { type: "turn" }>).degrees,
              },
      ),
    })),
    allowedBlocks: [
      { type: "switchCostume", costumeId: LOOK },
      { type: "playSound", soundId: SOUND },
      { type: "turn", degrees: 90 },
    ],
  } as const;
}

export function getOriReactInstructions(locale: "es" | "en"): string {
  const contract = `Contract ${ORI_ADVANCED_REACT_VERSION}. Return one JSON object only: {"version":"${ORI_ADVANCED_REACT_VERSION}","kind":"event-suggestion","actorId":"actor:ori|actor:friend","event":"actorClicked","block":{"type":"switchCostume","costumeId":"${LOOK}"}} or the same with {"type":"playSound","soundId":"${SOUND}"} or {"type":"turn","degrees":90}, or {"version":"${ORI_ADVANCED_REACT_VERSION}","kind":"refusal"}. Use only the selected input.actorId. No other keys, free text, links, tools or personal data. Never claim the program ran. The child must review before any change.`;
  return locale === "es"
    ? `Sos Ori. Sugerí solo una acción para el evento de tocar al personaje. La niña o el niño decide; el programa prueba. ${contract}`
    : `You are Ori. Suggest only one action for the actor-click event. The child decides; the program proves. ${contract}`;
}

function makeProposal(context: OriReactContext, statement: Statement): ProgramProposal {
  const target = targetScript(context);
  if (!target || !allowed(statement)) throw new Error("invalid stage-2 proposal");
  const nodeId = `scripts[${target.index}]/statements[${target.script.statements.length}]`;
  const asset = assetId(statement);
  const proposal = createProgramProposal({
    id: `ori-react-${target.index}-${target.script.statements.length}`,
    baseProgram: target.program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose:
      context.locale === "es" ? "Una idea para cuando lo toques" : "An idea for when you tap",
    rationale:
      context.locale === "es"
        ? "Mirá el bloque y decidí si querés usarlo."
        : "Look at the block and decide whether to use it.",
    affectedActorIds: [context.actorId],
    affectedScriptIds: [target.script.id],
    ...(asset ? { affectedAssetIds: [asset] } : {}),
    affectedNodeIds: [nodeId],
    operations: [{ type: "appendStatement", scriptIndex: target.index, statement }],
  });
  validateOriReactProposal(context, proposal);
  return proposal;
}

export function validateOriReactProposal(context: OriReactContext, raw: unknown): ProposalReview {
  const target = targetScript(context);
  if (!target) throw new Error("selected actor has no event script");
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
    (proposal.affectedAssetIds?.join() ?? "") !== (assetId(operation.statement) ?? "") ||
    proposal.affectedNodeIds.join() !==
      `scripts[${target.index}]/statements[${target.script.statements.length}]`
  )
    throw new Error("proposal outside stage-2 event allow-list");
  return createProposalReview(target.program, proposal, {
    actors: [
      { id: "actor:ori", scripts: ["advanced-react"] },
      { id: "actor:friend", scripts: target.program.scripts[1] ? ["advanced-react-friend"] : [] },
    ],
  });
}

function fallback(context: OriReactContext): OriAdvancedDecision {
  const target = targetScript(context);
  if (!target)
    return {
      source: "fallback",
      message:
        context.locale === "es"
          ? "Agregá una acción para este personaje y después miramos ideas."
          : "Add an action for this character, then we can look at ideas.",
    };
  const statement: Statement = target.script.statements.some(
    (item) => item.type === "switchCostume" && item.costumeId === LOOK,
  )
    ? { type: "turn", degrees: 90 }
    : { type: "switchCostume", costumeId: LOOK };
  return {
    source: "fallback",
    message:
      context.locale === "es"
        ? "Ori tiene una idea para cuando toques al personaje. Mirala y decidí vos."
        : "Ori has an idea for when you tap the character. Look and decide.",
    proposal: makeProposal(context, statement),
  };
}

export function evaluateOriReactOutput(
  context: OriReactContext,
  raw: unknown,
): OriAdvancedDecision {
  targetScript(context);
  try {
    const parsed =
      typeof raw === "string" && raw.length <= MAX_OUTPUT_CHARS ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("invalid output");
    const value = parsed as Record<string, unknown>;
    if (value.version !== ORI_ADVANCED_REACT_VERSION) throw new Error("invalid version");
    if (value.kind === "refusal" && Object.keys(value).sort().join() === "kind,version")
      return {
        source: "refusal",
        message:
          context.locale === "es"
            ? "Solo puedo ayudarte con tu programa en Agorix."
            : "I can only help with your Agorix program.",
      };
    if (
      value.kind !== "event-suggestion" ||
      Object.keys(value).sort().join() !== "actorId,block,event,kind,version" ||
      value.actorId !== context.actorId ||
      value.event !== "actorClicked" ||
      !value.block ||
      typeof value.block !== "object" ||
      Array.isArray(value.block)
    )
      throw new Error("invalid event output");
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
    else if (
      block.type === "turn" &&
      Object.keys(block).sort().join() === "degrees,type" &&
      block.degrees === 90
    )
      statement = { type: "turn", degrees: 90 };
    else throw new Error("unsupported event block");
    return {
      source: "model",
      message:
        context.locale === "es"
          ? "Ori tiene una idea para cuando lo toques. Mirala y decidí vos."
          : "Ori has an idea for when you tap. Look and decide.",
      proposal: makeProposal(context, statement),
    };
  } catch {
    return fallback(context);
  }
}

export async function runOriReact(
  context: OriReactContext,
  model?: OriTextModel,
): Promise<OriAdvancedDecision> {
  if (!targetScript(context)) return fallback(context);
  if (!model) return fallback(context);
  try {
    const output = await model.generate(
      getOriReactInstructions(context.locale),
      JSON.stringify(createOriReactInput(context)),
    );
    return evaluateOriReactOutput(context, output);
  } catch {
    return fallback(context);
  }
}
