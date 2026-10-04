export const AGENT_TASK_IDS = ["first-step", "repeat-pattern"] as const;
export type AgentTaskId = (typeof AGENT_TASK_IDS)[number];

export interface AgentTask {
  readonly id: AgentTaskId;
  readonly title: string;
}

export const MAX_INTENT_LENGTH = 140;

const TITLES: Record<AgentTaskId, string> = {
  "first-step": "Try one visible movement step",
  "repeat-pattern": "Write the repeated steps once with repeat",
};

const KEYWORDS: Record<AgentTaskId, RegExp> = {
  "first-step": /\b(move|moves|walk|go|step|forward|mover|avanzar|caminar|paso|adelante)\b/,
  "repeat-pattern": /\b(repeat|repeats|loop|times|again|repetir|repite|veces|bucle)\b/,
};

/** Bounds free text. The result selects tasks only; callers must not store or echo it. */
export function normalizeIntent(text: unknown): string | undefined {
  if (typeof text !== "string") {
    return undefined;
  }
  const cleaned = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0 || cleaned.length > MAX_INTENT_LENGTH) {
    return undefined;
  }
  return cleaned;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Keyword hits among available tasks; with no hit, offer what the agent can do. */
export function planTasks(intent: string, available: readonly AgentTaskId[]): AgentTask[] {
  const folded = fold(intent);
  const hits = available.filter((id) => KEYWORDS[id].test(folded));
  const chosen = hits.length > 0 ? hits : available;
  return chosen.map((id) => ({ id, title: TITLES[id] }));
}
