import type { ProjectSceneGoal } from "@agorix/persistence";
import type { Locale } from "../i18n.js";
import { ORI_BROWSER_TIMEOUT_MS } from "./oriRequestBudget.js";

/**
 * Asks the model to rank the goals the child could already pick. The reply is one index into the
 * list this browser sent, so the goal and its wording stay local and nothing free-form crosses the
 * wire. Any failure returns null and the caller keeps the local deterministic ranking (#1135).
 */
export async function requestSceneGoal(
  locale: Locale,
  choices: readonly ProjectSceneGoal[],
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<ProjectSceneGoal | null> {
  if (choices.length === 0) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORI_BROWSER_TIMEOUT_MS);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });
  try {
    const response = await fetchImpl("/api/tutor/scene-goals", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ locale, choices }),
    });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.length > 256) return null;
    const raw: unknown = JSON.parse(text);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    if (
      Object.keys(value).join(",") !== "choice" ||
      !Number.isInteger(value.choice) ||
      (value.choice as number) < 0 ||
      (value.choice as number) >= choices.length
    )
      return null;
    return choices[value.choice as number]!;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
