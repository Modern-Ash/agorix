import {
  evaluateKidsRun,
  kidsMoveSteps,
  worldToCell,
  type MissionDefinition,
} from "@agorix/curriculum";
import {
  createProgramProposal,
  createProposalReview,
  type ProgramProposal,
} from "@agorix/proposals";
import type { ProjectProgram, Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "@agorix/runtime";
import { EMPTY_PROACTIVE_MEMORY, type ProactiveMemory } from "@agorix/learning-decision-plane";
import type {
  LearningCompanionProviderRuntime,
  ProviderRuntimeDiagnostics,
  ProviderRuntimeResult,
} from "@agorix/provider-runtime";
import {
  createLearningCompanionResponse,
  validateLearningCompanionRequest,
  validateLearningCompanionSafety,
} from "@agorix/tutor-contract";

export type KidsOriKind = "move" | "turn" | "repeat" | "done" | "wall" | "passed";

export interface KidsOriOffer {
  readonly kind: KidsOriKind;
  readonly amount?: number;
  readonly proposal?: ProgramProposal;
}

const DIRECTIONS = ["E", "S", "W", "N"] as const;
const VECTORS = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] } as const;
const MEMORY_KEY = "agorix.kids.ori.memory.v1";

interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function sessionStorageOrUndefined(): SessionStorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function loadKidsOriMemory(
  storage: SessionStorageLike | undefined = sessionStorageOrUndefined(),
): ProactiveMemory {
  try {
    const parsed = JSON.parse(storage?.getItem(MEMORY_KEY) ?? "null") as ProactiveMemory | null;
    if (
      !parsed ||
      !Number.isInteger(parsed.sessionDeclines) ||
      parsed.sessionDeclines < 0 ||
      !Number.isInteger(parsed.ignoredInRow) ||
      parsed.ignoredInRow < 0 ||
      typeof parsed.programs !== "object" ||
      parsed.programs === null
    )
      return EMPTY_PROACTIVE_MEMORY;
    return parsed;
  } catch {
    return EMPTY_PROACTIVE_MEMORY;
  }
}

export function saveKidsOriMemory(
  memory: ProactiveMemory,
  storage: SessionStorageLike | undefined = sessionStorageOrUndefined(),
): void {
  try {
    storage?.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // Proposals still work in a private session without storage.
  }
}

/** Deterministic provider over the canonical runtime, using the same ProgramProposal boundary as AI. */
export function computeKidsOri(
  program: ProjectProgram,
  mission: MissionDefinition,
  missionIndex: number,
  locale: "es" | "en" = "es",
): KidsOriOffer {
  const script = program.scripts[0];
  if (!script) return { kind: "done" };
  const evaluation = evaluateKidsRun({
    mission,
    result: runProgram(program, createWorldState(mission.starterStage)),
  });
  if (evaluation.outcome === "success") return { kind: "done" };
  if (evaluation.outcome === "wall") return { kind: "wall" };
  if (evaluation.outcome === "passed") return { kind: "passed" };

  const goal = worldToCell(mission.starterStage.goal as { x: number; y: number });
  const dx = goal.cx - evaluation.final.cx;
  const dy = goal.cy - evaluation.final.cy;
  const [fx, fy] = VECTORS[evaluation.heading];
  let distance = 0;
  if (fx !== 0 && Math.sign(dx) === fx) distance = Math.abs(dx);
  else if (fy !== 0 && Math.sign(dy) === fy) distance = Math.abs(dy);

  let kind: KidsOriKind;
  let statement: Statement;
  let amount: number | undefined;
  if (distance >= 3 && missionIndex === 2) {
    kind = "repeat";
    amount = Math.min(6, distance);
    statement = {
      type: "repeat",
      count: amount,
      body: [{ type: "move", steps: kidsMoveSteps(1) }],
    };
  } else if (distance > 0) {
    kind = "move";
    amount = Math.min(5, distance);
    statement = { type: "move", steps: kidsMoveSteps(amount) };
  } else {
    kind = "turn";
    const target = dx !== 0 ? (dx > 0 ? "E" : "W") : dy > 0 ? "S" : "N";
    const index = DIRECTIONS.indexOf(evaluation.heading);
    statement = {
      type: "turn",
      degrees: DIRECTIONS[(index + 3) % 4] === target ? -90 : 90,
    };
  }

  const nodeId = `scripts[0]/statements[${script.statements.length}]`;
  const proposal = createProgramProposal({
    id: `kids-ori-${missionIndex}-${script.statements.length}`,
    baseProgram: program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: locale === "es" ? "Una idea de Ori" : "An idea from Ori",
    rationale:
      locale === "es"
        ? "Mirá el bloque y decidí si querés probarlo. Ori puede equivocarse."
        : "Look at the block and decide whether to try it. Ori can be wrong.",
    affectedNodeIds: [nodeId],
    operations: [{ type: "appendStatement", scriptIndex: 0, statement }],
  });
  // A provider result must be reviewable before the UI can present it.
  createProposalReview(program, proposal);
  return { kind, ...(amount === undefined ? {} : { amount }), proposal };
}

/** Same builder response boundary used by model providers; all content is generated locally. */
export function createKidsOriProviderRuntime(
  mission: MissionDefinition,
  missionIndex: number,
  locale: "es" | "en",
): LearningCompanionProviderRuntime & { propose(program: ProjectProgram): KidsOriOffer } {
  const capability = {
    capability: "builder" as const,
    structuredOutput: true,
    streaming: false,
    toolCalling: false,
  };
  const descriptor = {
    runtimeId: "kids-deterministic",
    providerId: "kids-rules",
    modelId: "rules-v1",
    locality: "local" as const,
    features: { structuredJson: true, toolCalling: false, streaming: false },
    contextLimits: {},
    capabilities: [capability],
  };
  const diagnostics: ProviderRuntimeDiagnostics = {
    runtimeId: descriptor.runtimeId,
    providerId: descriptor.providerId,
    modelId: descriptor.modelId,
    locality: "local",
    capability: "builder",
  };
  return {
    descriptor,
    propose: (program) => computeKidsOri(program, mission, missionIndex, locale),
    health: () => ({ status: "available", checkedAt: new Date().toISOString() }),
    negotiate: (requested) =>
      requested === "builder"
        ? { supported: true, capability: requested, descriptor: capability }
        : { supported: false, capability: requested, missingReason: "capability-not-advertised" },
    request: (raw): ProviderRuntimeResult => {
      if (raw.capability !== "builder") {
        return {
          ok: false,
          error: {
            code: "unsupported-capability",
            message: "Builder only",
            retryable: false,
            capability: raw.capability,
          },
          diagnostics: { ...diagnostics, capability: raw.capability },
        };
      }
      try {
        const request = validateLearningCompanionRequest(raw);
        if (request.mission.id !== mission.id) throw new Error("mission mismatch");
        const offer = computeKidsOri(request.program, mission, missionIndex, locale);
        if (!offer.proposal) throw new Error("no program change needed");
        const proposal = offer.proposal;
        const response = createLearningCompanionResponse({
          capability: "builder",
          message:
            locale === "es"
              ? "Ori tiene una idea para mirar y decidir."
              : "Ori has an idea to inspect and decide.",
          nodeIds: proposal.affectedNodeIds,
          concepts: mission.concepts.slice(0, 1),
          metadata: {
            capability: "builder",
            scaffoldLevel: 4,
            provenance: "deterministic-fake",
            uncertainty: "low",
          },
          payload: {
            kind: "program-proposal",
            proposal,
            reviewState: "proposed",
            validation: { status: "valid", errors: [] },
            preview: { summary: proposal.purpose, affectedNodeIds: proposal.affectedNodeIds },
          },
        });
        return {
          ok: true,
          response: validateLearningCompanionSafety(request, response),
          diagnostics,
        };
      } catch {
        return {
          ok: false,
          error: {
            code: "invalid-response",
            message: "No safe proposal available",
            retryable: false,
            capability: "builder",
          },
          diagnostics,
        };
      }
    },
  };
}
