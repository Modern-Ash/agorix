import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { TutorAdapterConfig } from "./index.js";
import type { OriCliConfig } from "./oriCli.js";

export const AI_CONFIG_SCHEMA = "agorix/ai-config/v1" as const;
export const AI_CAPABILITIES = [
  "mission",
  "advanced",
  "studio",
  "chat",
  "goals",
  "legacy",
] as const;
export type AiCapability = (typeof AI_CAPABILITIES)[number];
export type AiProvider = "auto" | "codex" | "opencode" | "disabled" | "openai-compatible" | "fake";

export interface AiPolicy {
  readonly enabled: boolean;
  readonly provider: AiProvider;
  readonly model: string;
  readonly timeoutMs: number;
  readonly requestsPerMinute: number;
  /** Additional server-side instruction, never a replacement for the safety contract. */
  readonly promptTemplate: string;
  readonly fallback: "deterministic";
}

export interface AiConfig {
  readonly schema: typeof AI_CONFIG_SCHEMA;
  readonly capabilities: Readonly<Record<AiCapability, AiPolicy>>;
}

export interface AiRevision {
  readonly revision: number;
  readonly author: string;
  readonly createdAt: string;
  readonly action: "seed" | "publish" | "rollback";
  readonly sourceRevision: number | null;
  readonly config: AiConfig;
}

export interface AiConfigRepository {
  current(): AiRevision;
  history(): readonly AiRevision[];
  publish(config: unknown, expectedRevision: number, author: string): AiRevision;
  rollback(sourceRevision: number, expectedRevision: number, author: string): AiRevision;
  close(): void;
}

export class AiConfigError extends Error {
  constructor(readonly code: "invalid-config" | "revision-conflict" | "revision-not-found") {
    super(code);
  }
}

export function defaultAiConfig(ori: OriCliConfig, tutor: TutorAdapterConfig): AiConfig {
  const forOri = (capability: AiCapability): AiPolicy => ({
    enabled: true,
    provider: ori.provider,
    model: ori.codexModel,
    timeoutMs: ori.timeoutMs,
    requestsPerMinute: capability === "chat" || capability === "goals" ? 6 : 60,
    promptTemplate: "",
    fallback: "deterministic",
  });
  return {
    schema: AI_CONFIG_SCHEMA,
    capabilities: {
      mission: forOri("mission"),
      advanced: forOri("advanced"),
      studio: forOri("studio"),
      chat: forOri("chat"),
      goals: forOri("goals"),
      legacy: {
        enabled: true,
        provider: tutor.adapter,
        model: tutor.model ?? "deterministic",
        timeoutMs: tutor.timeoutMs,
        requestsPerMinute: 60,
        promptTemplate: "",
        fallback: "deterministic",
      },
    },
  };
}

function keys(value: Record<string, unknown>): string {
  return Object.keys(value).sort().join(",");
}

export function validateAiConfig(raw: unknown): AiConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new AiConfigError("invalid-config");
  const root = raw as Record<string, unknown>;
  if (
    keys(root) !== "capabilities,schema" ||
    root.schema !== AI_CONFIG_SCHEMA ||
    !root.capabilities ||
    typeof root.capabilities !== "object" ||
    Array.isArray(root.capabilities)
  )
    throw new AiConfigError("invalid-config");
  const capabilities = root.capabilities as Record<string, unknown>;
  if (keys(capabilities) !== [...AI_CAPABILITIES].sort().join(","))
    throw new AiConfigError("invalid-config");
  const result = {} as Record<AiCapability, AiPolicy>;
  for (const capability of AI_CAPABILITIES) {
    const value = capabilities[capability];
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new AiConfigError("invalid-config");
    const policy = value as Record<string, unknown>;
    if (
      keys(policy) !==
        "enabled,fallback,model,promptTemplate,provider,requestsPerMinute,timeoutMs" ||
      typeof policy.enabled !== "boolean" ||
      policy.fallback !== "deterministic" ||
      typeof policy.provider !== "string" ||
      typeof policy.model !== "string" ||
      !/^[A-Za-z0-9._:@/+-]{1,80}$/.test(policy.model) ||
      !Number.isInteger(policy.timeoutMs) ||
      (policy.timeoutMs as number) < 500 ||
      (policy.timeoutMs as number) > 7_000 ||
      !Number.isInteger(policy.requestsPerMinute) ||
      (policy.requestsPerMinute as number) < 1 ||
      (policy.requestsPerMinute as number) > 60 ||
      typeof policy.promptTemplate !== "string" ||
      policy.promptTemplate.length > 2_000 ||
      [...policy.promptTemplate].some((char) => {
        const code = char.charCodeAt(0);
        return code < 32 && code !== 9 && code !== 10;
      })
    )
      throw new AiConfigError("invalid-config");
    const providers =
      capability === "legacy"
        ? ["fake", "openai-compatible", "disabled"]
        : ["auto", "codex", "opencode", "disabled"];
    if (!providers.includes(policy.provider)) throw new AiConfigError("invalid-config");
    result[capability] = {
      enabled: policy.enabled,
      provider: policy.provider as AiProvider,
      model: policy.model,
      timeoutMs: policy.timeoutMs as number,
      requestsPerMinute: policy.requestsPerMinute as number,
      promptTemplate: policy.promptTemplate,
      fallback: "deterministic",
    };
  }
  return { schema: AI_CONFIG_SCHEMA, capabilities: result };
}

export function configDiff(before: AiConfig, after: AiConfig): readonly AiCapability[] {
  return AI_CAPABILITIES.filter(
    (capability) =>
      JSON.stringify(before.capabilities[capability]) !==
      JSON.stringify(after.capabilities[capability]),
  );
}

function assertAuthor(author: string): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(author)) throw new AiConfigError("invalid-config");
}

export function createMemoryAiConfigRepository(
  initial: AiConfig,
  now: () => Date = () => new Date(),
): AiConfigRepository {
  const revisions: AiRevision[] = [
    {
      revision: 1,
      author: "system",
      createdAt: now().toISOString(),
      action: "seed",
      sourceRevision: null,
      config: validateAiConfig(initial),
    },
  ];
  function append(
    config: AiConfig,
    expectedRevision: number,
    author: string,
    action: "publish" | "rollback",
    sourceRevision: number | null,
  ): AiRevision {
    assertAuthor(author);
    if (revisions.at(-1)!.revision !== expectedRevision)
      throw new AiConfigError("revision-conflict");
    const revision: AiRevision = {
      revision: expectedRevision + 1,
      author,
      createdAt: now().toISOString(),
      action,
      sourceRevision,
      config: structuredClone(config),
    };
    revisions.push(revision);
    return structuredClone(revision);
  }
  return {
    current: () => structuredClone(revisions.at(-1)!),
    history: () => structuredClone([...revisions].reverse()),
    publish: (raw, expected, author) =>
      append(validateAiConfig(raw), expected, author, "publish", null),
    rollback: (source, expected, author) => {
      const found = revisions.find((item) => item.revision === source);
      if (!found) throw new AiConfigError("revision-not-found");
      return append(found.config, expected, author, "rollback", source);
    },
    close: () => {},
  };
}

export function openSqliteAiConfigRepository(
  path: string,
  initial: AiConfig,
  now: () => Date = () => new Date(),
): AiConfigRepository {
  if (!path.startsWith("/")) throw new Error("AI config SQLite path must be absolute");
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS ai_config_revisions (revision INTEGER PRIMARY KEY, author TEXT NOT NULL, created_at TEXT NOT NULL, action TEXT NOT NULL, source_revision INTEGER, config_json TEXT NOT NULL)",
  );
  const count = db.prepare("SELECT COUNT(*) AS total FROM ai_config_revisions").get() as {
    total: number;
  };
  if (count.total === 0)
    db.prepare("INSERT INTO ai_config_revisions VALUES (1, 'system', ?, 'seed', NULL, ?)").run(
      now().toISOString(),
      JSON.stringify(validateAiConfig(initial)),
    );
  function row(value: unknown): AiRevision {
    const item = value as Record<string, unknown>;
    return {
      revision: Number(item.revision),
      author: String(item.author),
      createdAt: String(item.created_at),
      action: item.action as AiRevision["action"],
      sourceRevision: item.source_revision === null ? null : Number(item.source_revision),
      config: validateAiConfig(JSON.parse(String(item.config_json))),
    };
  }
  function current(): AiRevision {
    return row(
      db.prepare("SELECT * FROM ai_config_revisions ORDER BY revision DESC LIMIT 1").get(),
    );
  }
  function append(
    config: AiConfig,
    expected: number,
    author: string,
    action: "publish" | "rollback",
    source: number | null,
  ): AiRevision {
    assertAuthor(author);
    db.exec("BEGIN IMMEDIATE");
    try {
      const latest = current();
      if (latest.revision !== expected) throw new AiConfigError("revision-conflict");
      db.prepare("INSERT INTO ai_config_revisions VALUES (?, ?, ?, ?, ?, ?)").run(
        expected + 1,
        author,
        now().toISOString(),
        action,
        source,
        JSON.stringify(config),
      );
      db.exec("COMMIT");
      return current();
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return {
    current,
    history: () =>
      (
        db.prepare("SELECT * FROM ai_config_revisions ORDER BY revision DESC").all() as unknown[]
      ).map(row),
    publish: (raw, expected, author) =>
      append(validateAiConfig(raw), expected, author, "publish", null),
    rollback: (source, expected, author) => {
      const found = db.prepare("SELECT * FROM ai_config_revisions WHERE revision = ?").get(source);
      if (!found) throw new AiConfigError("revision-not-found");
      return append(row(found).config, expected, author, "rollback", source);
    },
    close: () => db.close(),
  };
}
