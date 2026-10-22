import { verifyKidsFreeGoal, type KidsCell, type KidsGoalCheck } from "@agorix/curriculum";
import { describeOriGoal } from "@agorix/ori-agent";

export interface KidsGoalProposal {
  readonly cell: KidsCell;
  readonly successCheck: KidsGoalCheck;
  readonly message: string;
}

/** The browser independently validates server proposals before showing them to a child. */
export async function requestKidsGoal(
  locale: "es" | "en",
  signal?: AbortSignal,
): Promise<KidsGoalProposal | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7_500);
    signal?.addEventListener("abort", () => controller.abort(), { once: true });
    try {
      const response = await fetch("/api/tutor/goals", {
        method: "POST",
        credentials: "same-origin",
        signal: controller.signal,
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) return null;
      const text = await response.text();
      if (text.length > 1024) return null;
      const raw: unknown = JSON.parse(text);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
      const value = raw as Record<string, unknown>;
      if (
        Object.keys(value).sort().join(",") !== "cell,message,successCheck" ||
        !value.cell ||
        typeof value.cell !== "object" ||
        Array.isArray(value.cell)
      )
        return null;
      const cell = value.cell as Record<string, unknown>;
      if (
        Object.keys(cell).sort().join(",") !== "cx,cy" ||
        !Number.isInteger(cell.cx) ||
        !Number.isInteger(cell.cy) ||
        (value.successCheck !== "touches-goal" && value.successCheck !== "touches-goal-after-turn")
      )
        return null;
      const result = {
        cell: { cx: cell.cx as number, cy: cell.cy as number },
        successCheck: value.successCheck as KidsGoalCheck,
      };
      verifyKidsFreeGoal(result.cell, result.successCheck, locale);
      const message = describeOriGoal(result.cell, result.successCheck, locale);
      if (value.message !== message) return null;
      return { ...result, message };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}
