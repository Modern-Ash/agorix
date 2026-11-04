import { createServer } from "node:http";
import { createAgorixAdapter } from "../../src/agorix-adapter.mjs";
import { createCanonicalAgorixHost } from "../../src/agorix-runtime-bridge.mjs";
import { oriProposalToAgorixOperations } from "../../src/agorix-operations.mjs";

/**
 * Synthetic reference tutor API, not a replacement for Agorix tutor-api.
 * Loopback-only; no child-facing deployment, no model calls or persistence.
 */
const MAX_BODY = 4096;
const MAX_REQUEST_MS = 2500;
export function createReferenceTutorServer({ program, runResult, maxBody = MAX_BODY } = {}) {
  if (!program || !runResult) throw new TypeError("Synthetic program and runResult required");
  const host = createCanonicalAgorixHost({
    readCanonicalProgram: async () => program,
    readRunResult: async () => runResult
  });
  const adapter = createAgorixAdapter(host);
  return createServer(async (req, res) => {
    req.setTimeout(MAX_REQUEST_MS, () => req.destroy());
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(JSON.stringify(payload));
    };
    if (req.url !== "/api/example/ori" || req.method !== "POST") return send(404, { error: "not-found" });
    if (req.headers.origin && !/^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(req.headers.origin)) return send(403, { error: "forbidden" });
    if (!req.headers["content-type"]?.startsWith("application/json")) return send(415, { error: "unsupported-media-type" });
    let body = "";
    try {
      for await (const chunk of req) {
        body += chunk.toString("utf8");
        if (Buffer.byteLength(body, "utf8") > maxBody) return send(413, { error: "too-large" });
      }
      const data = JSON.parse(body);
      if (!data || typeof data !== "object" || Array.isArray(data) ||
          Object.keys(data).some(k => !["message","attempts","hintsUsed","allowProposal"].includes(k)) ||
          typeof data.message !== "string" || data.message.length > 300 ||
          (data.attempts !== undefined && (!Number.isSafeInteger(data.attempts) || data.attempts < 0)) ||
          (data.hintsUsed !== undefined && (!Number.isSafeInteger(data.hintsUsed) || data.hintsUsed < 0)) ||
          (data.allowProposal !== undefined && typeof data.allowProposal !== "boolean")) {
        return send(400, { error: "invalid-request" });
      }
      const answer = await adapter.ask(data.message, {
        attempts: data.attempts ?? 0, hintsUsed: data.hintsUsed ?? 0,
        allowProposal: data.allowProposal ?? false
      });
      const operations = answer.proposal
        ? oriProposalToAgorixOperations(answer.proposal, { allowedBlocks: ["move"] })
        : null;
      return send(200, {
        kind: answer.kind,
        message: answer.message,
        plan: answer.plan ?? null,
        evidence: answer.evidence ?? null,
        operationsPreview: operations,
        requiresLearnerApproval: operations !== null,
        appliedChanges: false
      });
    } catch {
      return send(400, { error: "invalid-request" });
    }
  });
}
