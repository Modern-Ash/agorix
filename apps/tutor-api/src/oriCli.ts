import { spawn } from "node:child_process"; // agora-allowlist: server-only fixed CLI, shell disabled, bounded and tool-denied
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AiCapability, AiPolicy } from "./aiConfig.js";
import type { ProviderRuntimeErrorCode } from "@agorix/provider-runtime";
import {
  evaluateOriAgentOutput,
  runOriAgent,
  type OriAgentContext,
  type OriAgentDecision,
  composeOriInstructions,
  runOriChat,
  type OriChatContext,
  runOriGoalAgent,
  runOriAdvancedStage,
  runOriStudio,
  type OriStudioContext,
  type OriStudioDecision,
  type OriAdvancedStageContext,
  type OriAdvancedDecision,
  type OriGoalDecision,
  type OriLocale,
} from "@agorix/ori-agent";

export type OriCliProvider = "auto" | "codex" | "opencode" | "disabled";
export interface OriCliConfig {
  readonly provider: OriCliProvider;
  readonly codexBin: string;
  readonly codexModel: string;
  readonly opencodeBin: string;
  readonly timeoutMs: number;
}
export interface OriCliProcessOptions {
  readonly input: string;
  readonly timeoutMs: number;
  readonly maxOutputBytes: number;
  readonly cwd: string;
  readonly env?: Record<string, string>;
}
export type OriCliProcess = (
  command: string,
  args: readonly string[],
  options: OriCliProcessOptions,
) => Promise<string>;
export interface OriCliDependencies {
  readonly run?: OriCliProcess;
  readonly now?: () => number;
  readonly policyFor?: (capability: AiCapability) => AiPolicy;
}
export interface OriCliHealth {
  readonly configured: boolean;
  readonly available: boolean;
  readonly providerInUse: "codex" | "opencode" | "deterministic";
}
export interface OriCliService {
  health(): Promise<OriCliHealth>;
  diagnostics(): OriCliDiagnostics;
  respond(context: OriAgentContext): Promise<OriAgentDecision>;
  chat(context: OriChatContext): Promise<string>;
  proposeGoal(locale: OriLocale): Promise<OriGoalDecision>;
  advanced(context: OriAdvancedStageContext): Promise<OriAdvancedDecision>;
  studio(context: OriStudioContext): Promise<OriStudioDecision>;
}

export interface OriCliDiagnostics {
  readonly lastErrorClass: ProviderRuntimeErrorCode | null;
  readonly attempts: number;
  readonly modelResponses: number;
  readonly p50Ms: number | null;
  readonly p95Ms: number | null;
}

const MAX_INPUT_BYTES = 16 * 1024;
const MAX_OUTPUT_BYTES = 16 * 1024;
const PROBE_TTL_MS = 15_000;
const PROBE_TIMEOUT_MS = 1_000;

export class CliProcessError extends Error {
  constructor(readonly code: "unavailable" | "timeout" | "output-too-large" | "failed") {
    super(`Ori CLI ${code}`);
    this.name = "CliProcessError";
  }
}

export function oriCliConfigFromEnv(env: Record<string, string | undefined>): OriCliConfig {
  const provider = env.AGORIX_ORI_PROVIDER ?? "auto";
  if (!["auto", "codex", "opencode", "disabled"].includes(provider)) {
    throw new Error("AGORIX_ORI_PROVIDER: expected auto, codex, opencode or disabled");
  }
  const requested = Number(env.AGORIX_ORI_TIMEOUT_MS ?? 7_000);
  return {
    provider: provider as OriCliProvider,
    codexBin: env.AGORIX_ORI_CODEX_BIN || "codex",
    codexModel: env.AGORIX_ORI_CODEX_MODEL || "gpt-6-luna",
    opencodeBin: env.AGORIX_ORI_OPENCODE_BIN || "opencode",
    timeoutMs: Number.isFinite(requested)
      ? Math.min(7_000, Math.max(500, Math.floor(requested)))
      : 7_000,
  };
}

export function createOriCliService(
  config: OriCliConfig,
  dependencies: OriCliDependencies = {},
): OriCliService {
  const run = dependencies.run ?? runBoundedProcess;
  const now = dependencies.now ?? Date.now;
  const cached = new Map<
    string,
    { readonly at: number; readonly provider: "codex" | "opencode" | undefined }
  >();
  const durations: number[] = [];
  let attempts = 0;
  let modelResponses = 0;
  let lastErrorClass: ProviderRuntimeErrorCode | null = null;
  function record(
    duration: number | null,
    source: OriAgentDecision["source"],
    error: ProviderRuntimeErrorCode | null,
  ) {
    attempts += 1;
    if (source === "model") modelResponses += 1;
    if (duration !== null) {
      durations.push(Math.max(0, Math.round(duration)));
      if (durations.length > 32) durations.shift();
    }
    lastErrorClass = error;
  }
  function percentile(fraction: number): number | null {
    if (!durations.length) return null;
    const sorted = [...durations].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * fraction) - 1] ?? null;
  }

  function policyFor(capability: AiCapability): AiPolicy {
    return (
      dependencies.policyFor?.(capability) ?? {
        enabled: true,
        provider: config.provider,
        model: config.codexModel,
        timeoutMs: config.timeoutMs,
        requestsPerMinute: 6,
        promptTemplate: "",
        fallback: "deterministic",
      }
    );
  }

  async function select(policy: AiPolicy): Promise<"codex" | "opencode" | undefined> {
    if (!policy.enabled || policy.provider === "disabled") return undefined;
    const previous = cached.get(policy.provider);
    if (previous && now() - previous.at < PROBE_TTL_MS) return previous.provider;
    const candidates =
      policy.provider === "auto" ? (["codex", "opencode"] as const) : [policy.provider];
    for (const candidate of candidates) {
      if (candidate !== "codex" && candidate !== "opencode") continue;
      const bin = candidate === "codex" ? config.codexBin : config.opencodeBin;
      try {
        await run(bin, ["--version"], {
          input: "",
          timeoutMs: PROBE_TIMEOUT_MS,
          maxOutputBytes: 512,
          cwd: tmpdir(),
          env: safeCliEnv(),
        });
        cached.set(policy.provider, { at: now(), provider: candidate });
        return candidate;
      } catch {
        // An absent or unresponsive CLI is normal. The deterministic provider remains available.
      }
    }
    cached.set(policy.provider, { at: now(), provider: undefined });
    return undefined;
  }

  function textModel(provider: "codex" | "opencode", policy: AiPolicy) {
    return {
      generate: async (systemInstructions: string, inputJson: string) => {
        const bin = provider === "codex" ? config.codexBin : config.opencodeBin;
        const directory = mkdtempSync(join(tmpdir(), "agorix-ori-"));
        try {
          const instructions = composeOriInstructions(systemInstructions, policy.promptTemplate);
          const input =
            provider === "codex" ? `${instructions}\n\nINPUT_JSON:\n${inputJson}\n` : "";
          if (
            Buffer.byteLength(inputJson) > MAX_INPUT_BYTES ||
            Buffer.byteLength(input) > MAX_INPUT_BYTES
          )
            throw new CliProcessError("output-too-large");
          const args =
            provider === "codex"
              ? codexArgs(directory, policy.model)
              : opencodeArgs(inputJson, policy.provider === "auto" ? undefined : policy.model);
          const output = await run(bin, args, {
            input,
            timeoutMs: policy.timeoutMs,
            maxOutputBytes: MAX_OUTPUT_BYTES,
            cwd: directory,
            env: safeCliEnv(
              provider === "opencode"
                ? {
                    OPENCODE_PERMISSION: '"deny"',
                    OPENCODE_DISABLE_DEFAULT_PLUGINS: "1",
                    OPENCODE_DISABLE_CLAUDE_CODE: "1",
                    OPENCODE_CONFIG_CONTENT: JSON.stringify({
                      permission: "deny",
                      tools: { "*": false },
                      agent: {
                        "ori-text": {
                          mode: "primary",
                          prompt: instructions,
                          permission: "deny",
                          tools: { "*": false },
                        },
                      },
                    }),
                  }
                : {},
            ),
          });
          return provider === "opencode" ? parseOpenCodeText(output) : output.trim();
        } finally {
          rmSync(directory, { recursive: true, force: true });
        }
      },
    };
  }

  return {
    diagnostics() {
      return {
        lastErrorClass,
        attempts,
        modelResponses,
        p50Ms: percentile(0.5),
        p95Ms: percentile(0.95),
      };
    },
    async health() {
      const policy = policyFor("mission");
      const provider = await select(policy);
      return {
        configured: policy.enabled && policy.provider !== "disabled",
        available: provider !== undefined,
        providerInUse: provider ?? "deterministic",
      };
    },
    async respond(context) {
      const started = now();
      const policy = policyFor("mission");
      const provider = await select(policy);
      if (!provider) {
        const decision = evaluateOriAgentOutput(context, undefined);
        record(null, decision.source, "provider-unavailable");
        return decision;
      }
      let error: ProviderRuntimeErrorCode | null = null;
      const model = textModel(provider, policy);
      const decision = await runOriAgent(context, {
        generate: async (instructions, input) => {
          try {
            return await model.generate(instructions, input);
          } catch (cause) {
            error =
              cause instanceof CliProcessError && cause.code === "timeout"
                ? "timeout"
                : cause instanceof CliProcessError && cause.code === "output-too-large"
                  ? "invalid-response"
                  : "provider-unavailable";
            throw cause;
          }
        },
      });
      record(
        now() - started,
        decision.source,
        decision.source === "fallback" ? (error ?? "invalid-response") : null,
      );
      return decision;
    },
    async chat(context) {
      const policy = policyFor("chat");
      const provider = await select(policy);
      return runOriChat(context, provider ? textModel(provider, policy) : undefined);
    },
    async proposeGoal(locale) {
      const policy = policyFor("goals");
      const provider = await select(policy);
      return runOriGoalAgent(locale, provider ? textModel(provider, policy) : undefined);
    },
    async advanced(context) {
      const policy = policyFor("advanced");
      const provider = await select(policy);
      return runOriAdvancedStage(context, provider ? textModel(provider, policy) : undefined);
    },
    async studio(context) {
      const policy = policyFor("studio");
      const provider = await select(policy);
      return runOriStudio(context, provider ? textModel(provider, policy) : undefined);
    },
  };
}

function codexArgs(directory: string, model: string): readonly string[] {
  const disabled = [
    "shell_tool",
    "apps",
    "browser_use",
    "computer_use",
    "image_generation",
    "view_image",
    "skill_search",
    "tool_suggest",
    "multi_agent",
    "code_mode_host",
  ];
  return [
    "exec",
    "--ignore-user-config",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "read-only",
    "--cd",
    directory,
    "--model",
    model,
    ...disabled.flatMap((feature) => ["--disable", feature]),
    "-",
  ];
}

function opencodeArgs(inputJson: string, model?: string): readonly string[] {
  return [
    "run",
    "--pure",
    "--format",
    "json",
    ...(model ? ["--model", model] : []),
    "--agent",
    "ori-text",
    inputJson,
  ];
}

function parseOpenCodeText(output: string): string {
  let finalText: string | undefined;
  for (const line of output.split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line) as { type?: unknown; part?: { type?: unknown; text?: unknown } };
    if (event.type === "text" && typeof event.part?.text === "string") finalText = event.part.text;
    if (event.type === "tool") throw new CliProcessError("failed");
  }
  if (!finalText) throw new CliProcessError("failed");
  return finalText;
}

function safeCliEnv(extra: Record<string, string> = {}): Record<string, string> {
  const names = [
    "PATH",
    "HOME",
    "USER",
    "LANG",
    "XDG_CONFIG_HOME",
    "XDG_DATA_HOME",
    "XDG_CACHE_HOME",
    "CODEX_HOME",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENCODE_API_KEY",
    "GEMINI_API_KEY",
  ];
  const env: Record<string, string> = {};
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  return { ...env, ...extra };
}

/** No shell, bounded stdin/stdout/stderr, hard kill on timeout or overflow. */
export function runBoundedProcess(
  command: string,
  args: readonly string[],
  options: OriCliProcessOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      env: options.env ?? safeCliEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
      detached: true,
    });
    const stdout: Buffer[] = [];
    let size = 0;
    let failure: CliProcessError | undefined;
    const timer = setTimeout(() => {
      failure = new CliProcessError("timeout");
      killProcessGroup(child.pid);
    }, options.timeoutMs);
    const collect = (chunk: Buffer, keep: boolean) => {
      size += chunk.length;
      if (size > options.maxOutputBytes && !failure) {
        failure = new CliProcessError("output-too-large");
        killProcessGroup(child.pid);
      }
      if (keep && !failure) stdout.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => collect(chunk, true));
    child.stderr.on("data", (chunk: Buffer) => collect(chunk, false));
    child.stdin.on("error", () => {});
    child.stdin.end(options.input);
    child.on("error", () => {
      failure = new CliProcessError("unavailable");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (failure) reject(failure);
      else if (code !== 0) reject(new CliProcessError("failed"));
      else resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

function killProcessGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* already exited */
    }
  }
}
