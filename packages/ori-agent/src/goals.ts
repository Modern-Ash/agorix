import {
  KIDS_GRID,
  verifyKidsFreeGoal,
  type KidsCell,
  type KidsGoalCheck,
} from "@agorix/curriculum";
import {
  createLearningCompanionRequest,
  createLearningCompanionResponse,
  validateLearningCompanionSafety,
} from "@agorix/tutor-contract";
import type { OriLocale, OriTextModel } from "./index.js";

export const ORI_GOAL_VERSION = "agorix/ori-goal/v1";
export interface OriGoalDecision {
  readonly source: "model" | "fallback";
  readonly cell: KidsCell;
  readonly successCheck: KidsGoalCheck;
  readonly message: string;
}

export function getOriGoalInstructions(): string {
  return `Contract ${ORI_GOAL_VERSION}. Invent a goal for the Agorix Kids free world. Return one JSON object only: {"version":"${ORI_GOAL_VERSION}","cx":0..5,"cy":0..3,"challenge":"reach|turn"}. No free text, links, tools, personal data, extra keys, conditions or unsupported actions. The child decides whether to accept. The host validates the goal with the canonical runtime.`;
}

export function describeOriGoal(cell: KidsCell, check: KidsGoalCheck, locale: OriLocale): string {
  if (locale === "es")
    return check === "touches-goal-after-turn"
      ? `¿Podés llegar a la meta en columna ${cell.cx + 1}, fila ${cell.cy + 1} usando un giro?`
      : `¿Podés llegar a la meta en columna ${cell.cx + 1}, fila ${cell.cy + 1}?`;
  return check === "touches-goal-after-turn"
    ? `Can you reach the goal in column ${cell.cx + 1}, row ${cell.cy + 1} using a turn?`
    : `Can you reach the goal in column ${cell.cx + 1}, row ${cell.cy + 1}?`;
}

function decision(
  cell: KidsCell,
  check: KidsGoalCheck,
  locale: OriLocale,
  source: "model" | "fallback",
): OriGoalDecision {
  const mission = verifyKidsFreeGoal(cell, check, locale);
  const message = describeOriGoal(cell, check, locale);
  const request = createLearningCompanionRequest({
    capability: "coach",
    mission: {
      id: mission.id,
      version: mission.version,
      concepts: mission.concepts,
      learningObjective: mission.goal.learnerFacing,
    },
    program: mission.starterProject,
    selectedNodeIds: [],
    runtimeFacts: [],
    scaffoldHistory: [],
  });
  const response = createLearningCompanionResponse({
    capability: "coach",
    message,
    nodeIds: [],
    concepts: mission.concepts.slice(0, 1),
    metadata: {
      capability: "coach",
      scaffoldLevel: 1,
      provenance: source === "model" ? "local-provider" : "deterministic-fake",
      uncertainty: source === "model" ? "medium" : "low",
    },
    payload: { kind: "question", question: message },
  });
  validateLearningCompanionSafety(request, response);
  return { source, cell, successCheck: check, message };
}

export async function runOriGoalAgent(
  locale: OriLocale,
  model?: OriTextModel,
): Promise<OriGoalDecision> {
  const fallback = () => decision({ cx: 4, cy: 2 }, "touches-goal", locale, "fallback");
  if (!model) return fallback();
  try {
    const raw = await model.generate(
      getOriGoalInstructions(),
      JSON.stringify({
        version: ORI_GOAL_VERSION,
        locale,
        grid: { cols: KIDS_GRID.cols, rows: KIDS_GRID.rows },
        start: { cx: 0, cy: 2 },
        allowedChallenges: ["reach", "turn"],
      }),
    );
    const value: unknown = typeof raw === "string" && raw.length <= 1024 ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("invalid goal");
    const parsed = value as Record<string, unknown>;
    if (
      Object.keys(parsed).sort().join(",") !== "challenge,cx,cy,version" ||
      parsed.version !== ORI_GOAL_VERSION ||
      !Number.isInteger(parsed.cx) ||
      !Number.isInteger(parsed.cy) ||
      (parsed.challenge !== "reach" && parsed.challenge !== "turn")
    )
      throw new Error("invalid goal");
    return decision(
      { cx: parsed.cx as number, cy: parsed.cy as number },
      parsed.challenge === "turn" ? "touches-goal-after-turn" : "touches-goal",
      locale,
      "model",
    );
  } catch {
    return fallback();
  }
}
