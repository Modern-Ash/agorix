import type { OriShadowMetrics } from "./oriShadowMetrics.js";
import { validateOriShadowPlan } from "./oriShadowPlanValidation.js";
import type { OriExternalShadow, OriExternalShadowInput } from "./oriExternalShadow.js";

/**
 * Opt-in loopback transport to Ori's synthetic /v0/shadow endpoint.
 * No child messages, program AST, identifiers, session, credentials or IPs.
 * This is experimental and disabled by default in the Agorix entrypoint.
 */
export function createOriShadowTransport(
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
  metrics?: OriShadowMetrics,
): OriExternalShadow {
  const url = new URL(endpoint);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    !["/v0/shadow", "/v1/plan"].includes(url.pathname) ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error("Ori shadow endpoint must be loopback /v0/shadow");

  return async (input: OriExternalShadowInput): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 750);
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
      // Shadow response must not influence existing tutor output.
      if (!response.ok) {
        metrics?.record("http-error");
        return;
      }
      if (url.pathname === "/v0/shadow") metrics?.record("valid");
      // Experimental plan validation is shadow-only and cannot affect Kids.
      if (url.pathname === "/v1/plan" && !response.body) {
        metrics?.record("invalid-contract");
        return;
      }
      if (url.pathname === "/v1/plan" && response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 4096) {
              metrics?.record("oversized");
              return;
            }
            chunks.push(part.value);
          }
          const body = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) {
            body.set(chunk, offset);
            offset += chunk.byteLength;
          }
          const plan = validateOriShadowPlan(JSON.parse(new TextDecoder().decode(body)));
          metrics?.record(plan === null ? "invalid-contract" : "valid");
        } catch (error) {
          if (controller.signal.aborted) metrics?.record("timeout");
          else metrics?.record("invalid-contract");
          // Reject malformed shadow responses without affecting the tutor.
        } finally {
          void reader.cancel().catch(() => undefined);
        }
      }
    } catch (error) {
      metrics?.record(controller.signal.aborted ? "timeout" : "network-error");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}
