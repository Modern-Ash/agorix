import {
  evaluateOriStudioOutput,
  validateOriStudioProposal,
  type OriStudioContext,
} from "@agorix/ori-agent";
import type { ProgramProposal } from "@agorix/proposals";
import { ORI_BROWSER_TIMEOUT_MS } from "./oriRequestBudget.js";

export interface StudioOriOffer {
  readonly message: string;
  readonly proposal?: ProgramProposal;
}

/** Same-origin model call; every response is revalidated against the current selected actor. */
export async function requestStudioOri(
  context: OriStudioContext,
  fetchImpl: typeof fetch = fetch,
): Promise<StudioOriOffer> {
  const fallback = (): StudioOriOffer => {
    const decision = evaluateOriStudioOutput(context, undefined);
    return {
      message: decision.message,
      ...(decision.proposal ? { proposal: decision.proposal } : {}),
    };
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORI_BROWSER_TIMEOUT_MS);
  try {
    const response = await fetchImpl("/api/tutor/studio/ori", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(context),
    });
    if (!response.ok) return fallback();
    const raw = await response.text();
    if (raw.length > 16 * 1024) return fallback();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return fallback();
    const value = parsed as Record<string, unknown>;
    if (
      !["message", "message,proposal"].includes(Object.keys(value).sort().join()) ||
      typeof value.message !== "string" ||
      value.message.length < 1 ||
      value.message.length > 200
    )
      return fallback();
    if (value.proposal === undefined) return { message: value.message };
    validateOriStudioProposal(context, value.proposal);
    return { message: value.message, proposal: value.proposal as ProgramProposal };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
