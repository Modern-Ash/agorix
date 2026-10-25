import type { OriExternalShadow, OriExternalShadowInput } from "./oriExternalShadow.js";

/**
 * Opt-in loopback transport to Ori's synthetic /v0/shadow endpoint.
 * No child messages, program AST, identifiers, session, credentials or IPs.
 * This is experimental and disabled by default in the Agorix entrypoint.
 */
export function createOriShadowTransport(
  endpoint: string,
  fetchImpl: typeof fetch = fetch,
): OriExternalShadow {
  const url = new URL(endpoint);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/v0/shadow" ||
    url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== ""
  ) throw new Error("Ori shadow endpoint must be loopback /v0/shadow");

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
      if (!response.ok) return;
      // Do not consume untrusted response bodies or leak them to the tutor.
    } finally {
      clearTimeout(timer);
    }
  };
}
