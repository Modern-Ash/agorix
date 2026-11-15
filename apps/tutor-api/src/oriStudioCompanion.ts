import {
  createDeterministicLearningCompanionResponse,
  validateLearningCompanionRequest,
  validateLearningCompanionSafety,
  type LearningCompanionRequest,
  type LearningCompanionResponse,
} from "@agorix/tutor-contract";

export interface OriStudioCompanionModel {
  generate(instructions: string, inputJson: string): Promise<string>;
}

const MAX_MODEL_OUTPUT = 2_048;

/** Only bounded structural context reaches the model; full program values stay in Agorix. */
export function studioCompanionModelInput(request: LearningCompanionRequest): string {
  const valid = validateLearningCompanionRequest(request);
  return JSON.stringify({
    capability: valid.capability,
    locale: valid.reading?.locale ?? "en",
    mission: {
      id: valid.mission.id,
      concepts: valid.mission.concepts,
    },
    program: valid.program.scripts.slice(0, 12).map((script) => ({
      trigger: script.trigger.type,
      statementTypes: script.statements.slice(0, 60).map((statement) => statement.type),
    })),
    selectedNodeCount: Math.min(valid.selectedNodeIds.length, 8),
    runtime: valid.runtime
      ? { outcome: valid.runtime.outcome, stepsUsed: valid.runtime.stepsUsed }
      : undefined,
    runtimeFactCount: Math.min(valid.runtimeFacts.length, 8),
  });
}

/** Ori may supply teaching text; Agorix owns facts, structure, and proposal validation. */
export async function runOriStudioCompanion(
  request: LearningCompanionRequest,
  model?: OriStudioCompanionModel,
): Promise<LearningCompanionResponse> {
  const valid = validateLearningCompanionRequest(request);
  const fallback = createDeterministicLearningCompanionResponse(valid);
  if (!model || valid.capability === "builder") return fallback;
  try {
    const raw = await model.generate(
      "You are Ori, a programming learning companion for children. Reply in the input locale. Return exactly one JSON object with only a message string. Ask or explain from the supplied structural facts. Never claim the program ran unless the outcome says it ran. Never request personal information, produce code, links, markup or instructions to change the program directly.",
      studioCompanionModelInput(valid),
    );
    if (raw.length > MAX_MODEL_OUTPUT) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback;
    const value = parsed as Record<string, unknown>;
    if (Object.keys(value).join() !== "message" || typeof value.message !== "string")
      return fallback;
    const message = value.message.trim();
    if (message.length < 1 || message.length > 500) return fallback;
    const response: LearningCompanionResponse = {
      ...fallback,
      message,
      metadata: { ...fallback.metadata, provenance: "local-provider" },
      payload: replaceText(fallback, message),
    } as LearningCompanionResponse;
    return validateLearningCompanionSafety(valid, response);
  } catch {
    return fallback;
  }
}

function replaceText(response: LearningCompanionResponse, message: string) {
  switch (response.capability) {
    case "coach":
      return { ...response.payload, question: message };
    case "explainer":
      return { ...response.payload, explanation: message };
    case "challenger":
    case "reflector":
      return { ...response.payload, prompt: message };
    case "debugger":
      return { ...response.payload, suggestions: [message] };
    case "builder":
      return response.payload;
  }
}
