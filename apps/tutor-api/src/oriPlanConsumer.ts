import type { OriExternalShadowInput } from "./oriExternalShadow.js";
import { validateOriShadowPlan, type OriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Experimental read-only plan consumer. No child-facing responses or writes.
 * The caller must opt in, supply a trusted fetch and enforce host policy.
 */
export interface OriPlanConsumer {
  readonly evaluate: (input: OriExternalShadowInput) => Promise<OriShadowPlan | null>;
}
export function createOriPlanConsumer(
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 750,
): OriPlanConsumer {
  const url = new URL(endpoint);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/v1/plan" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new TypeError("Ori plan consumer requires loopback /v1/plan");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2000) {
    throw new RangeError("Invalid Ori plan timeout");
  }
  return Object.freeze({
    async evaluate(input: OriExternalShadowInput): Promise<OriShadowPlan | null> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url.href, {
          method: "POST",
          redirect: "error",
          credentials: "omit",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            missionIndex: input.missionIndex,
            hintLevel: input.hintLevel,
            scriptCount: input.scriptCount,
          }),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) return null;
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > 4096) return null;
            chunks.push(part.value);
          }
          const raw = new Uint8Array(bytes);
          let offset = 0;
          for (const chunk of chunks) {
            raw.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const plan = validateOriShadowPlan(
            JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(raw)),
          );
          if (!plan || plan.stage !== input.hintLevel || plan.context.missionStage !== input.missionIndex)
            return null;
          // Return only the whitelisted validated schema. Never trust extra fields.
          return Object.freeze({
            schema: plan.schema,
            kind: plan.kind,
            stage: plan.stage,
            steps: Object.freeze([...plan.steps]) as unknown as readonly [string, string, string],
            hint: plan.hint,
            requiresLearnerApproval: false,
            appliedChanges: false,
            context: Object.freeze({ missionStage: plan.context.missionStage }),
          });
        } finally {
          void reader.cancel().catch(() => undefined);
        }
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
  });
}
