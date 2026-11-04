/**
 * Host-neutral, bounded client for the synthetic Ori reference Tutor API.
 * No credentials, cookies, browser state or provider keys are sent.
 * This is NOT the production Agorix /api/tutor/ori protocol.
 */
export class TutorClientError extends Error {
  constructor(code) { super(code); this.name = "TutorClientError"; this.code = code; }
}
export function createTutorClient({ endpoint, fetchImpl = fetch, timeoutMs = 2500 } = {}) {
  let url;
  try { url = new URL(endpoint); } catch { throw new TutorClientError("invalid-endpoint"); }
  if (url.protocol !== "http:" || !["127.0.0.1","localhost","[::1]"].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== "/api/example/ori") {
    throw new TutorClientError("invalid-endpoint");
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10000) throw new TutorClientError("invalid-timeout");
  if (typeof fetchImpl !== "function") throw new TutorClientError("invalid-transport");
  return Object.freeze({
    async ask({ message, attempts = 0, hintsUsed = 0, allowProposal = false } = {}) {
      if (typeof message !== "string" || message.length > 300 ||
          !Number.isSafeInteger(attempts) || attempts < 0 || attempts > 10000 ||
          !Number.isSafeInteger(hintsUsed) || hintsUsed < 0 || hintsUsed > 10000 ||
          typeof allowProposal !== "boolean") throw new TutorClientError("invalid-request");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(url.href, {
          method: "POST", redirect: "error", credentials: "omit", signal: controller.signal,
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({ message, attempts, hintsUsed, allowProposal })
        });
        if (!response.ok) throw new TutorClientError("server-error");
        const raw = await response.text();
        if (raw.length > 8192) throw new TutorClientError("oversized-response");
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object" || Array.isArray(data) ||
            !["hint","safety"].includes(data.kind) ||
            typeof data.message !== "string" || data.message.length > 300 ||
            data.appliedChanges !== false ||
            typeof data.requiresLearnerApproval !== "boolean") throw new TutorClientError("invalid-response");
        if (data.operationsPreview !== null) {
          if (!data.requiresLearnerApproval || !data.operationsPreview ||
              !Array.isArray(data.operationsPreview.operations) ||
              data.operationsPreview.operations.length !== 1 ||
              data.operationsPreview.operations[0].type !== "appendStatement") {
            throw new TutorClientError("invalid-preview");
          }
        }
        return data;
      } catch (cause) {
        if (cause instanceof TutorClientError) throw cause;
        throw new TutorClientError("unavailable");
      } finally { clearTimeout(timer); }
    }
  });
}
