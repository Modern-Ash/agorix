import type { MissionDefinition } from "@agorix/curriculum";
import type { ProjectProgram } from "@agorix/program-model";
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

import { computeKidsOri, type KidsOriOffer } from "@agorix/ori-agent";
export { computeKidsOri, type KidsOriOffer } from "@agorix/ori-agent";
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
