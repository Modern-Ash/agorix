import { spawn } from "node:child_process"; // agora-allowlist: server runs a fixed Ori evidence CLI with shell disabled and bounded output
import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parseOriDebugPlan, type OriDebugGuidance } from "./oriDebugGuidance.js";

export interface TrustedOriEvidence {
  readonly intent: "help" | "repeat" | "turn" | "move" | "debug";
  readonly programRevision: string;
  readonly expectedSteps: number;
  readonly hostContext: {
    readonly sessionId: string;
    readonly learningStage: "explore" | "connect" | "translate";
    readonly capabilities: readonly ("inspectProgram" | "inspectTrace")[];
    readonly grants: readonly ("inspectProgram" | "inspectTrace")[];
    readonly attempts: number;
    readonly hintsUsed: number;
  };
  readonly snapshot: { readonly allowedBlocks: readonly string[] };
  readonly trace: {
    readonly steps: readonly { readonly index: number; readonly description: string }[];
  };
}
export interface OriHostEvidenceResult {
  readonly status: "ready" | "unavailable";
  readonly proposal?: unknown;
  readonly debugGuidance?: OriDebugGuidance;
  readonly evidenceReceipt?: {
    readonly programRevision: string;
    readonly digest: string;
    readonly complete: true;
  };
  readonly requiresLearnerApproval: true;
  readonly appliedChanges: false;
}
const unavailable: OriHostEvidenceResult = Object.freeze({
  status: "unavailable",
  requiresLearnerApproval: true,
  appliedChanges: false,
});
const HEX = /^[a-f0-9]{64}$/;
export interface OriHostProposalConfig {
  readonly provider: "ollama" | "compatible" | "auto" | "cli-auto" | "codex" | "opencode";
  readonly timeoutMs: number;
  readonly totalBudgetMs: number;
  readonly ollamaEndpoint: string;
  readonly compatibleEndpoint: string;
  readonly ollamaModel: string;
  readonly compatibleModel: string;
  readonly codexBin: string;
  readonly opencodeBin: string;
  readonly codexModel: string;
}

export function oriHostProposalConfigFromEnv(
  env: Record<string, string | undefined>,
): OriHostProposalConfig | undefined {
  const provider = env["AGORIX_ORI_REVIEW_PROVIDER"] ?? "disabled";
  if (provider === "disabled") return undefined;
  if (!["ollama", "compatible", "auto", "cli-auto", "codex", "opencode"].includes(provider))
    throw new Error("Invalid Ori private review provider");
  const cliMode = ["cli-auto", "codex", "opencode"].includes(provider);
  const timeoutMs = Number(env["AGORIX_ORI_REVIEW_MODEL_TIMEOUT_MS"] ?? (cliMode ? 4500 : 1500));
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > (cliMode ? 5000 : 3000))
    throw new Error("Invalid Ori private review timeout");
  const providerCount = provider === "auto" || provider === "cli-auto" ? 2 : 1;
  const totalBudgetMs = Number(
    env["AGORIX_ORI_REVIEW_TOTAL_BUDGET_MS"] ?? timeoutMs * providerCount,
  );
  if (!Number.isSafeInteger(totalBudgetMs) || totalBudgetMs < 1 || totalBudgetMs > 9000)
    throw new Error("Invalid Ori private review total budget");
  const endpoint = (raw: string) => {
    const url = new URL(raw);
    if (
      url.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !["", "/"].includes(url.pathname)
    )
      throw new Error("Ori private review endpoint must be loopback HTTP");
    return url.origin;
  };
  const model = (raw: string) => {
    if (!/^[a-zA-Z0-9_.:/-]{1,80}$/.test(raw)) throw new Error("Invalid Ori review model");
    return raw;
  };
  const bin = (raw: string) => {
    if (!/^[a-zA-Z0-9_./-]{1,200}$/.test(raw)) throw new Error("Invalid Ori review executable");
    return raw;
  };
  return {
    provider: provider as OriHostProposalConfig["provider"],
    timeoutMs,
    totalBudgetMs,
    ollamaEndpoint: endpoint(env["AGORIX_ORI_REVIEW_OLLAMA_ENDPOINT"] ?? "http://127.0.0.1:11434"),
    compatibleEndpoint: endpoint(
      env["AGORIX_ORI_REVIEW_COMPATIBLE_ENDPOINT"] ?? "http://127.0.0.1:4096",
    ),
    ollamaModel: model(env["AGORIX_ORI_REVIEW_OLLAMA_MODEL"] ?? "qwen2.5:3b"),
    compatibleModel: model(env["AGORIX_ORI_REVIEW_COMPATIBLE_MODEL"] ?? "local-educational"),
    codexBin: bin(env["AGORIX_ORI_REVIEW_CODEX_BIN"] ?? "codex"),
    opencodeBin: bin(env["AGORIX_ORI_REVIEW_OPENCODE_BIN"] ?? "opencode"),
    codexModel: model(env["AGORIX_ORI_REVIEW_CODEX_MODEL"] ?? "gpt-6-luna"),
  };
}
export function validateTrustedOriEvidence(raw: unknown): TrustedOriEvidence | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (
    Object.keys(r).sort().join() !==
      "expectedSteps,hostContext,intent,programRevision,snapshot,trace" ||
    !["help", "repeat", "turn", "move", "debug"].includes(String(r["intent"])) ||
    typeof r["programRevision"] !== "string" ||
    !HEX.test(r["programRevision"]) ||
    !Number.isSafeInteger(r["expectedSteps"]) ||
    (r["expectedSteps"] as number) < 1 ||
    (r["expectedSteps"] as number) > 100
  )
    return null;
  const c = r["hostContext"],
    s = r["snapshot"],
    t = r["trace"];
  if (
    !c ||
    typeof c !== "object" ||
    Array.isArray(c) ||
    !s ||
    typeof s !== "object" ||
    Array.isArray(s) ||
    !t ||
    typeof t !== "object" ||
    Array.isArray(t)
  )
    return null;
  const host = c as Record<string, unknown>;
  const snapshot = s as Record<string, unknown>;
  const trace = t as Record<string, unknown>;
  if (
    Object.keys(host).sort().join() !==
      "attempts,capabilities,grants,hintsUsed,learningStage,sessionId" ||
    typeof host["sessionId"] !== "string" ||
    host["sessionId"].length > 80 ||
    !["explore", "connect", "translate"].includes(String(host["learningStage"])) ||
    ![host["attempts"], host["hintsUsed"]].every(
      (n) => Number.isSafeInteger(n) && (n as number) >= 0 && (n as number) <= 100,
    ) ||
    !Array.isArray(host["grants"]) ||
    !Array.isArray(host["capabilities"]) ||
    !["inspectProgram", "inspectTrace"].every(
      (g) =>
        (host["grants"] as unknown[]).includes(g) &&
        (host["capabilities"] as unknown[]).includes(g),
    ) ||
    (host["grants"] as unknown[]).some(
      (g) => !["inspectProgram", "inspectTrace"].includes(String(g)),
    ) ||
    (host["capabilities"] as unknown[]).some(
      (g) => !["inspectProgram", "inspectTrace"].includes(String(g)),
    )
  )
    return null;
  if (
    Object.keys(snapshot).join() !== "allowedBlocks" ||
    !Array.isArray(snapshot["allowedBlocks"]) ||
    (snapshot["allowedBlocks"] as unknown[]).length > 100 ||
    (snapshot["allowedBlocks"] as unknown[]).some(
      (x) => typeof x !== "string" || !/^[a-z][A-Za-z0-9]{0,39}$/.test(x),
    )
  )
    return null;
  if (
    Object.keys(trace).join() !== "steps" ||
    !Array.isArray(trace["steps"]) ||
    (trace["steps"] as unknown[]).length !== r["expectedSteps"] ||
    (trace["steps"] as unknown[]).some(
      (x, i) =>
        !x ||
        typeof x !== "object" ||
        Array.isArray(x) ||
        Object.keys(x).sort().join() !== "description,index" ||
        (x as { index: unknown }).index !== i ||
        typeof (x as { description: unknown }).description !== "string" ||
        (x as { description: string }).description.length > 200,
    )
  )
    return null;
  return raw as TrustedOriEvidence;
}
/**
 * Only invoke from a trusted server-side canonical-runtime adapter, NEVER
 * with a browser-provided envelope. Ori itself cannot attest host execution.
 */
/**
 * Only a one-block, host-allowlisted, review-only proposal may leave the
 * server adapter. Reject extra fields rather than forwarding model output.
 */
export function validateOriHostProposal(
  value: unknown,
  allowedBlocks: readonly string[],
): unknown | null {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (
    Object.keys(p).sort().join() !== "blocks,operation,requiresLearnerApproval,schemaVersion" ||
    p["schemaVersion"] !== "ori/proposal/v0" ||
    p["operation"] !== "append" ||
    p["requiresLearnerApproval"] !== true ||
    !Array.isArray(p["blocks"]) ||
    p["blocks"].length !== 1
  )
    return null;
  const block = p["blocks"][0];
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  const b = block as Record<string, unknown>;
  if (b["kind"] === "move") {
    if (
      Object.keys(b).sort().join() !== "kind,steps" ||
      !Number.isSafeInteger(b["steps"]) ||
      (b["steps"] as number) < 1 ||
      (b["steps"] as number) > 5
    )
      return null;
  } else if (b["kind"] === "turn") {
    if (
      Object.keys(b).sort().join() !== "direction,kind" ||
      !["left", "right"].includes(String(b["direction"]))
    )
      return null;
  } else return null;
  if (!allowedBlocks.includes(b["kind"] as string)) return null;
  return Object.freeze({
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [Object.freeze({ ...b })],
  });
}
export function createOriHostEvidenceAdapter({
  oriRoot,
  proposalConfig,
  timeoutMs = proposalConfig ? 10000 : 3000,
}: {
  oriRoot: string;
  proposalConfig?: OriHostProposalConfig;
  timeoutMs?: number;
}) {
  if (
    !isAbsolute(oriRoot) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 10000
  )
    throw new TypeError("Invalid Ori host configuration");
  const root = realpathSync(oriRoot);
  if (!existsSync(join(root, "examples/host-evidence-cli.mjs")))
    throw new TypeError("Ori host evidence CLI missing");
  return async (raw: unknown): Promise<OriHostEvidenceResult> => {
    const input = validateTrustedOriEvidence(raw);
    if (!input) return unavailable;
    return new Promise((resolve) => {
      const child = spawn(process.execPath, ["examples/host-evidence-cli.mjs"], {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          PATH: process.env["PATH"] ?? "",
          ...(proposalConfig && ["cli-auto", "codex", "opencode"].includes(proposalConfig.provider)
            ? Object.fromEntries(
                [
                  "HOME",
                  "USER",
                  "LANG",
                  "CODEX_HOME",
                  "XDG_CONFIG_HOME",
                  "XDG_DATA_HOME",
                  "XDG_CACHE_HOME",
                ]
                  .filter((name) => process.env[name] !== undefined)
                  .map((name) => [name, process.env[name]!]),
              )
            : {}),
          ...(proposalConfig
            ? {
                ORI_HOST_PROPOSAL_PROVIDER: proposalConfig.provider,
                ORI_HOST_PROPOSAL_TIMEOUT_MS: String(proposalConfig.timeoutMs),
                ORI_HOST_PROPOSAL_TOTAL_BUDGET_MS: String(proposalConfig.totalBudgetMs),
                ORI_HOST_OLLAMA_ENDPOINT: proposalConfig.ollamaEndpoint,
                ORI_HOST_COMPATIBLE_ENDPOINT: proposalConfig.compatibleEndpoint,
                ORI_HOST_OLLAMA_MODEL: proposalConfig.ollamaModel,
                ORI_HOST_COMPATIBLE_MODEL: proposalConfig.compatibleModel,
                ORI_HOST_CODEX_BIN: proposalConfig.codexBin,
                ORI_HOST_OPENCODE_BIN: proposalConfig.opencodeBin,
                ORI_HOST_CODEX_MODEL: proposalConfig.codexModel,
              }
            : {}),
        },
      });
      let done = false,
        output = "";
      const finish = (value: OriHostEvidenceResult) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (child.exitCode === null) child.kill("SIGKILL");
        resolve(value);
      };
      const timer = setTimeout(() => finish(unavailable), timeoutMs);
      child.on("error", () => finish(unavailable));
      child.stdout.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf8");
        if (Buffer.byteLength(output, "utf8") > 8192) finish(unavailable);
      });
      child.on("close", (code) => {
        if (code !== 0) return finish(unavailable);
        try {
          const data: unknown = JSON.parse(output);
          if (!data || typeof data !== "object" || Array.isArray(data)) return finish(unavailable);
          const d = data as Record<string, unknown>;
          const receipt = d["evidenceReceipt"];
          if (
            d["schemaVersion"] !== "ori/host-evidence-response/v1" ||
            d["appliedChanges"] !== false ||
            d["requiresLearnerApproval"] !== true ||
            !receipt ||
            typeof receipt !== "object" ||
            Array.isArray(receipt)
          )
            return finish(unavailable);
          const e = receipt as Record<string, unknown>;
          if (
            e["programRevision"] !== input.programRevision ||
            typeof e["digest"] !== "string" ||
            !HEX.test(e["digest"]) ||
            e["complete"] !== true
          )
            return finish(unavailable);
          if (!Object.hasOwn(d, "proposal")) return finish(unavailable);
          const proposal = validateOriHostProposal(d["proposal"], input.snapshot.allowedBlocks);
          if (d["proposal"] !== null && proposal === null) return finish(unavailable);
          const debugGuidance =
            input.intent === "debug" ? parseOriDebugPlan(d["plan"], input.expectedSteps) : null;
          if (input.intent === "debug" && (proposal !== null || !debugGuidance))
            return finish(unavailable);
          finish({
            status: "ready",
            proposal,
            ...(debugGuidance ? { debugGuidance } : {}),
            evidenceReceipt: {
              programRevision: input.programRevision,
              digest: e["digest"],
              complete: true,
            },
            requiresLearnerApproval: true,
            appliedChanges: false,
          });
        } catch {
          finish(unavailable);
        }
      });
      child.stdin.on("error", () => finish(unavailable));
      child.stdin.end(JSON.stringify(input));
    });
  };
}
