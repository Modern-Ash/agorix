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
  if (!model) return fallback;
  try {
    if (valid.capability === "builder" && fallback.capability === "builder") {
      const raw = await model.generate(
        'You are Ori. Return exactly one JSON object: {"type":"move","steps":10|20|40} or {"type":"turn","degrees":-90|90}. Suggest one small step only. The child must inspect and decide; the runtime proves the result. No prose, code, links or other keys.',
        studioCompanionModelInput(valid),
      );
      if (raw.length > MAX_MODEL_OUTPUT) return fallback;
      const statement = parseBoundedStatement(JSON.parse(raw));
      if (!statement) return fallback;
      const index = valid.program.scripts[0]?.statements.length;
      if (index === undefined) return fallback;
      const locale = valid.reading?.locale?.startsWith("es") ? "es" : "en";
      const nodeId = `scripts[0]/statements[${index}]`;
      const proposal = {
        ...fallback.payload.proposal,
        id: `ori-vscode-${index}-${statement.type}`,
        purpose: locale === "es" ? "Una idea de Ori para revisar" : "An Ori idea to review",
        rationale:
          locale === "es"
            ? "Revisá el cambio y decidí si ayuda a tu programa."
            : "Inspect the change and decide whether it helps your program.",
        affectedNodeIds: [nodeId],
        operations: [{ type: "appendStatement" as const, scriptIndex: 0, statement }],
      };
      return validateLearningCompanionSafety(valid, {
        ...fallback,
        message:
          locale === "es"
            ? "Ori propone un paso para que lo revises."
            : "Ori proposes one step for you to inspect.",
        nodeIds: [nodeId],
        metadata: { ...fallback.metadata, provenance: "local-provider" },
        payload: {
          ...fallback.payload,
          proposal,
          preview: {
            summary:
              locale === "es"
                ? "Agregar un bloque como propuesta."
                : "Append one block as a proposal.",
            affectedNodeIds: [nodeId],
          },
        },
      });
    }
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

function parseBoundedStatement(
  raw: unknown,
):
  | { readonly type: "move"; readonly steps: 10 | 20 | 40 }
  | { readonly type: "turn"; readonly degrees: -90 | 90 }
  | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).sort().join() === "steps,type" &&
    value.type === "move" &&
    (value.steps === 10 || value.steps === 20 || value.steps === 40)
  )
    return { type: "move", steps: value.steps };
  if (
    Object.keys(value).sort().join() === "degrees,type" &&
    value.type === "turn" &&
    (value.degrees === -90 || value.degrees === 90)
  )
    return { type: "turn", degrees: value.degrees };
  return undefined;
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
