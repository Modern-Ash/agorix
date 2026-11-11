import {
  evaluateOriStudioOutput,
  rebaseRedactedProposal,
  redactProgramForOri,
  validateOriStudioProposal,
  type OriStudioContext,
} from "@agorix/ori-agent";
import type { ProgramProposal } from "@agorix/proposals";
import { ORI_BROWSER_TIMEOUT_MS } from "./oriRequestBudget.js";

export interface StudioOriOffer {
  readonly message: string;
  readonly proposal?: ProgramProposal;
}

/**
 * Same-origin model call; every response is revalidated against the current selected actor.
 *
 * The service is sent the program's shape, not what the child wrote: the text of bubbles, words
 * typed into blocks and the names of variables, lists and blocks are replaced before the request
 * leaves the browser (`redactProgramForOri`). The idea that comes back was made for that form, so
 * it is put back on the child's own program, and checked against it, before anything is shown.
 */
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
    const sent = {
      actorId: context.actorId,
      locale: context.locale,
      program: redactProgramForOri(context.program),
    };
    const response = await fetchImpl("/api/tutor/studio/ori", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(sent),
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
    const proposal = rebaseRedactedProposal(context.program, value.proposal as ProgramProposal);
    validateOriStudioProposal(context, proposal);
    return { message: value.message, proposal };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
