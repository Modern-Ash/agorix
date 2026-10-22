import {
  evaluateKidsRun,
  KIDS_GRID,
  KIDS_MISSION_IDS,
  kidsMoveSteps,
  worldToCell,
  type MissionDefinition,
} from "@agorix/curriculum";
import {
  createProgramProposal,
  createProposalReview,
  type ProgramProposal,
} from "@agorix/proposals";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";
import {
  createLearningCompanionRequest,
  createLearningCompanionResponse,
  validateLearningCompanionSafety,
} from "@agorix/tutor-contract";
import { computeKidsOri } from "./deterministic.js";

export { computeKidsOri, type KidsOriKind, type KidsOriOffer } from "./deterministic.js";
export const ORI_AGENT_VERSION = "agorix/ori-agent/v1";
export const ORI_FIXED_REFUSAL = Object.freeze({
  es: "Solo puedo ayudarte con tus bloques, metas y cosas de Agorix.",
  en: "I can only help with your blocks, goals, and things in Agorix.",
});

export type OriLocale = "es" | "en";
export type OriMissionIndex = 0 | 1 | 2;
export type OriHintLevel = 1 | 2 | 3 | 4 | 5;
export type OriReason = "toward-goal" | "turn-to-goal" | "practice-repeat";
export type OriBlock =
  | { readonly type: "move"; readonly count: number }
  | { readonly type: "turn"; readonly direction: "left" | "right" }
  | {
      readonly type: "repeat";
      readonly count: number;
      readonly blocks: readonly [{ readonly type: "move"; readonly count: number }];
    };

export interface OriAgentContext {
  readonly mission: MissionDefinition;
  readonly missionIndex: OriMissionIndex;
  readonly program: ProjectProgram;
  readonly locale: OriLocale;
  readonly hintLevel: OriHintLevel;
}

/** Only structured, authored mission facts and canonical runtime evidence reach the model. */
export function createOriAgentInput(context: OriAgentContext) {
  assertContext(context);
  const { mission, program } = context;
  const result = evaluateKidsRun({
    mission,
    result: runProgram(program, createWorldState(mission.starterStage)),
  });
  return {
    version: ORI_AGENT_VERSION,
    locale: context.locale,
    mission: {
      id: mission.id,
      index: context.missionIndex,
      start: worldToCell(mission.starterStage.sprite as { x: number; y: number }),
      goal: worldToCell(mission.starterStage.goal as { x: number; y: number }),
    },
    grid: { cols: KIDS_GRID.cols, rows: KIDS_GRID.rows },
    program: program.scripts[0]?.statements.map(safeProgramBlock) ?? [],
    lastResult: { outcome: result.outcome, final: result.final, heading: result.heading },
    hintLevel: context.hintLevel,
    allowedBlocks: allowedBlocks(context.missionIndex),
  } as const;
}

export function getOriAgentInstructions(locale: OriLocale): string {
  const common =
    `Contract ${ORI_AGENT_VERSION}. Return one JSON object only; no Markdown, tools, links or extra keys.\n` +
    `Allowed output: {"version":"${ORI_AGENT_VERSION}","kind":"program-suggestion","reason":"toward-goal|turn-to-goal|practice-repeat","blocks":[...]} or {"version":"${ORI_AGENT_VERSION}","kind":"refusal"}.\n` +
    `Blocks: move {"type":"move","count":1..5}; turn {"type":"turn","direction":"left|right"}; repeat {"type":"repeat","count":2..6,"blocks":[{"type":"move","count":1..5}]}. Use only input.allowedBlocks and 1..3 top-level blocks. Never invent runtime evidence. No free text in output. Never request personal data or perform an action.`;
  return locale === "es"
    ? `Sos Ori, un compañero de Agorix para niñas y niños. Sugerí solo movimientos y comportamientos del programa. Las metas del mundo libre y la ayuda sobre la app serán capacidades separadas. Para cualquier otro tema, devolvé kind=refusal. La niña o el niño decide; el runtime prueba.\n${common}`
    : `You are Ori, an Agorix companion for children. Suggest only program movements and behaviours. Free-world goals and app help are separate capabilities. For any other topic, return kind=refusal. The child decides; the runtime proves.\n${common}`;
}

export interface OriAgentDecision {
  readonly source: "model" | "fallback" | "refusal";
  readonly message: string;
  readonly proposal?: ProgramProposal;
  readonly reason?: OriReason;
}

export interface OriTextModel {
  generate(systemInstructions: string, inputJson: string): Promise<unknown> | unknown;
}

/** Model transport is injected by the host in Kids 10; this module never opens a connection. */
export async function runOriAgent(
  context: OriAgentContext,
  model: OriTextModel,
): Promise<OriAgentDecision> {
  const input = createOriAgentInput(context);
  try {
    const raw = await model.generate(
      getOriAgentInstructions(context.locale),
      JSON.stringify(input),
    );
    return evaluateOriAgentOutput(context, raw);
  } catch {
    return evaluateOriAgentOutput(context, undefined);
  }
}

/** All model bytes cross this validator before a proposal can be shown. */
export function evaluateOriAgentOutput(context: OriAgentContext, raw: unknown): OriAgentDecision {
  try {
    createOriAgentInput(context);
    const parsed = parseOutput(raw, context.missionIndex);
    if (parsed.kind === "refusal") {
      return { source: "refusal", message: ORI_FIXED_REFUSAL[context.locale] };
    }
    const statements = parsed.blocks.map(toStatement);
    const script = context.program.scripts[0];
    if (!script) throw new Error("missing script");
    const affectedNodeIds = statements.map(
      (_, offset) => `scripts[0]/statements[${script.statements.length + offset}]`,
    );
    const purpose = context.locale === "es" ? "Una idea de Ori" : "An idea from Ori";
    const rationale = reasonMessage(parsed.reason, context.locale);
    const proposal = createProgramProposal({
      id: `ori-${context.mission.id}-${script.statements.length}`,
      baseProgram: context.program,
      source: { kind: "learning-companion", capability: "builder" },
      purpose,
      rationale,
      affectedNodeIds,
      operations: statements.map((statement) => ({
        type: "appendStatement" as const,
        scriptIndex: 0,
        statement,
      })),
    });
    createProposalReview(context.program, proposal);
    const request = createLearningCompanionRequest({
      capability: "builder",
      mission: {
        id: context.mission.id,
        version: context.mission.version,
        concepts: context.mission.concepts,
        learningObjective: context.mission.goal.learnerFacing,
      },
      program: context.program,
      selectedNodeIds: [],
      runtimeFacts: [],
      scaffoldHistory: [],
    });
    const response = createLearningCompanionResponse({
      capability: "builder",
      message: purpose,
      nodeIds: affectedNodeIds,
      concepts: context.mission.concepts.slice(0, 1),
      metadata: {
        capability: "builder",
        scaffoldLevel: 4,
        provenance: "local-provider",
        uncertainty: "medium",
      },
      payload: {
        kind: "program-proposal",
        proposal,
        reviewState: "proposed",
        validation: { status: "valid", errors: [] },
        preview: { summary: purpose, affectedNodeIds },
      },
    });
    validateLearningCompanionSafety(request, response);
    return { source: "model", message: rationale, proposal, reason: parsed.reason };
  } catch {
    const offer = computeKidsOri(
      context.program,
      context.mission,
      context.missionIndex,
      context.locale,
    );
    return {
      source: "fallback",
      message:
        context.locale === "es"
          ? "Ori tiene una idea para mirar y decidir."
          : "Ori has an idea to inspect and decide.",
      ...(offer.proposal === undefined ? {} : { proposal: offer.proposal }),
    };
  }
}

type ParsedOutput =
  | { readonly kind: "refusal" }
  | {
      readonly kind: "program-suggestion";
      readonly reason: OriReason;
      readonly blocks: readonly OriBlock[];
    };

function parseOutput(raw: unknown, missionIndex: OriMissionIndex): ParsedOutput {
  if (typeof raw === "string") {
    if (raw.length > 4_096) throw new Error("output too large");
    raw = JSON.parse(raw) as unknown;
  }
  const value = exactObject(raw, ["version", "kind", "reason", "blocks"]);
  if (value.version !== ORI_AGENT_VERSION) throw new Error("version mismatch");
  if (value.kind === "refusal") {
    if (Object.keys(value).length !== 2) throw new Error("invalid refusal");
    return { kind: "refusal" };
  }
  if (value.kind !== "program-suggestion" || Object.keys(value).length !== 4)
    throw new Error("invalid kind");
  if (!["toward-goal", "turn-to-goal", "practice-repeat"].includes(String(value.reason)))
    throw new Error("invalid reason");
  if (!Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > 3)
    throw new Error("invalid blocks");
  const allowed = new Set(allowedBlocks(missionIndex));
  const blocks = value.blocks.map((block: unknown) => parseBlock(block, allowed));
  return { kind: "program-suggestion", reason: value.reason as OriReason, blocks };
}

function parseBlock(raw: unknown, allowed: ReadonlySet<string>): OriBlock {
  const value = exactObject(raw, ["type", "count", "direction", "blocks"]);
  if (!allowed.has(String(value.type))) throw new Error("block not allowed for level");
  if (value.type === "move" && Object.keys(value).length === 2 && boundedInt(value.count, 1, 5))
    return { type: "move", count: value.count as number };
  if (
    value.type === "turn" &&
    Object.keys(value).length === 2 &&
    (value.direction === "left" || value.direction === "right")
  )
    return { type: "turn", direction: value.direction };
  if (
    value.type === "repeat" &&
    Object.keys(value).length === 3 &&
    boundedInt(value.count, 2, 6) &&
    Array.isArray(value.blocks) &&
    value.blocks.length === 1
  ) {
    const inner = parseBlock(value.blocks[0], new Set(["move"]));
    if (inner.type !== "move") throw new Error("repeat needs move");
    return { type: "repeat", count: value.count as number, blocks: [inner] };
  }
  throw new Error("invalid block shape or range");
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("expected object");
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !keys.includes(key))) throw new Error("unexpected field");
  return record;
}

function boundedInt(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function allowedBlocks(index: OriMissionIndex): readonly ("move" | "turn" | "repeat")[] {
  return index === 0 ? ["move"] : index === 1 ? ["move", "turn"] : ["move", "turn", "repeat"];
}

function toStatement(block: OriBlock): Statement {
  switch (block.type) {
    case "move":
      return { type: "move", steps: kidsMoveSteps(block.count) };
    case "turn":
      return { type: "turn", degrees: block.direction === "left" ? -90 : 90 };
    case "repeat":
      return { type: "repeat", count: block.count, body: [toStatement(block.blocks[0])] };
  }
}

function safeProgramBlock(statement: Statement): unknown {
  switch (statement.type) {
    case "move":
      return { type: "move", count: statement.steps / KIDS_GRID.cellSize };
    case "turn":
      return { type: "turn", degrees: statement.degrees };
    case "repeat":
      return {
        type: "repeat",
        count: statement.count,
        blocks: statement.body.map(safeProgramBlock),
      };
    default:
      return { type: "other" };
  }
}

function reasonMessage(reason: OriReason, locale: OriLocale): string {
  const messages = {
    es: {
      "toward-goal": "Podés probar este movimiento. Ori puede equivocarse.",
      "turn-to-goal": "Podés probar este giro. Ori puede equivocarse.",
      "practice-repeat": "Podés probar esta repetición. Ori puede equivocarse.",
    },
    en: {
      "toward-goal": "You can try this move. Ori can be wrong.",
      "turn-to-goal": "You can try this turn. Ori can be wrong.",
      "practice-repeat": "You can try this repeat. Ori can be wrong.",
    },
  } as const;
  return messages[locale][reason];
}

function assertContext(context: OriAgentContext): void {
  if (KIDS_MISSION_IDS[context.missionIndex] !== context.mission.id)
    throw new Error("mission mismatch");
  if (![1, 2, 3, 4, 5].includes(context.hintLevel)) throw new Error("invalid hint level");
  if (context.locale !== "es" && context.locale !== "en") throw new Error("invalid locale");
  validateProgram(context.program);
}
