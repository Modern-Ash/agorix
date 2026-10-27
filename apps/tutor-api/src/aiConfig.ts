import { chmodSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  ORI_INTERVENTION_DEFAULT,
  validateOriInterventionPolicy,
  type OriInterventionPolicy,
} from "@agorix/ori-agent";
import type { TutorAdapterConfig } from "./index.js";
import type { OriCliConfig } from "./oriCli.js";

export const AI_CONFIG_SCHEMA = "agorix/ai-config/v3" as const;
/** Stored revisions and older admin clients may still carry v1 or v2: they are migrated when read. */
export const AI_CONFIG_SCHEMA_V2 = "agorix/ai-config/v2" as const;
export const AI_CONFIG_SCHEMA_V1 = "agorix/ai-config/v1" as const;
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

export const GROUP_BLOCK_CATEGORIES = [
  "violence",
  "sexual",
  "hate",
  "self-harm",
  "personal-data",
  "other",
] as const;
export const GROUP_PII_PATTERNS = ["phone", "email", "address", "url"] as const;
/** Same fixed ids as `REACTION_IDS` in `@agorix/team-project`; the admin picks a subset per locale. */
export const GROUP_REACTION_IDS = ["like", "party", "think", "heart"] as const;
export type GroupBlockCategory = (typeof GROUP_BLOCK_CATEGORIES)[number];
export type GroupPiiPattern = (typeof GROUP_PII_PATTERNS)[number];
export type GroupReactionId = (typeof GROUP_REACTION_IDS)[number];

/**
 * Closed-group settings (ADR 0010, issue #567). Everything is on-device or limits: no credential
 * lives here. `onUnavailable` is fixed to "block": a weaker policy would need its own ADR.
 */
export interface GroupConfig {
  readonly moderation: {
    readonly image: {
      readonly enabled: boolean;
      readonly modelId: string;
      /** Score at or above this is unsafe. */
      readonly unsafeThreshold: number;
      /** Score at or above this (and below unsafe) is uncertain, which also blocks. */
      readonly uncertainThreshold: number;
      readonly blockedCategories: readonly GroupBlockCategory[];
      readonly onUnavailable: "block";
    };
    readonly text: {
      readonly enabled: boolean;
      readonly ruleSet: string;
      readonly blockedTerms: { readonly es: readonly string[]; readonly en: readonly string[] };
      readonly piiPatterns: readonly GroupPiiPattern[];
      readonly onUnavailable: "block";
    };
  };
  readonly approvalQueue: {
    /** True: every shared item waits for the organizer, whatever the model says. */
    readonly holdAll: boolean;
    /** Minutes a coarse rejection reason is kept; never the content. */
    readonly reasonRetentionMinutes: number;
  };
  readonly reactions: {
    readonly es: readonly GroupReactionId[];
    readonly en: readonly GroupReactionId[];
  };
  readonly limits: {
    readonly maxChildren: number;
    readonly maxSessionMinutes: number;
    readonly joinCodeMinutes: number;
    /** The optional signalling mailbox and TURN. Off until the privacy review. */
    readonly relayEnabled: boolean;
  };
}

/**
 * Typed behaviour sections (issue #613). Each one has its own validator, defaults and safety
 * floor; the administrator moves values inside the floor and never past it.
 */
export interface BehaviorConfig {
  readonly intervention: OriInterventionPolicy;
  /**
   * Share of devices that get this revision's behaviour (issue #620); the rest keep the last
   * revision that reached everyone. A device's place is a random number from 0 to 99 it makes for
   * itself, so no child, account or group is identified. 100 means everyone.
   */
  readonly rolloutPercent: number;
}

export function defaultBehaviorConfig(): BehaviorConfig {
  return { intervention: { ...ORI_INTERVENTION_DEFAULT }, rolloutPercent: 100 };
}

export function validateBehaviorConfig(raw: unknown): BehaviorConfig {
  const root = plain(raw);
  // Revisions published before the rollout existed carry only the intervention: they reach everyone.
  const keyList = keys(root);
  if (keyList !== "intervention" && keyList !== "intervention,rolloutPercent") {
    throw new AiConfigError("invalid-config");
  }
  const rolloutPercent = root.rolloutPercent === undefined ? 100 : root.rolloutPercent;
  if (
    typeof rolloutPercent !== "number" ||
    !Number.isInteger(rolloutPercent) ||
    rolloutPercent < 1 ||
    rolloutPercent > 100
  ) {
    throw new AiConfigError("invalid-config");
  }
  try {
    return { intervention: validateOriInterventionPolicy(root.intervention), rolloutPercent };
  } catch {
    throw new AiConfigError("invalid-config");
  }
}

/**
 * The behaviour a device gets: this revision's if the device is inside the rollout, otherwise the
 * last earlier revision that reached everyone (or the defaults if there is none).
 */
export function behaviorForBucket(
  history: readonly AiRevision[],
  bucket: number | undefined,
): BehaviorConfig {
  const latest = history[0];
  if (latest === undefined) return defaultBehaviorConfig();
  const current = latest.config.behavior;
  if (current.rolloutPercent >= 100) return current;
  if (
    bucket !== undefined &&
    Number.isInteger(bucket) &&
    bucket >= 0 &&
    bucket < current.rolloutPercent
  ) {
    return current;
  }
  return (
    history.slice(1).find((revision) => revision.config.behavior.rolloutPercent >= 100)?.config
      .behavior ?? defaultBehaviorConfig()
  );
}

export interface AiConfig {
  readonly schema: typeof AI_CONFIG_SCHEMA;
  readonly capabilities: Readonly<Record<AiCapability, AiPolicy>>;
  readonly group: GroupConfig;
  readonly behavior: BehaviorConfig;
}

/** Safe defaults: fail closed, hold everything for the organizer, relay off. */
export function defaultGroupConfig(): GroupConfig {
  return {
    moderation: {
      image: {
        enabled: true,
        modelId: "local-image-classifier",
        unsafeThreshold: 0.5,
        uncertainThreshold: 0.2,
        blockedCategories: [...GROUP_BLOCK_CATEGORIES],
        onUnavailable: "block",
      },
      text: {
        enabled: true,
        ruleSet: "local-text-rules",
        blockedTerms: { es: [], en: [] },
        piiPatterns: [...GROUP_PII_PATTERNS],
        onUnavailable: "block",
      },
    },
    approvalQueue: { holdAll: true, reasonRetentionMinutes: 10 },
    reactions: { es: [...GROUP_REACTION_IDS], en: [...GROUP_REACTION_IDS] },
    limits: { maxChildren: 4, maxSessionMinutes: 120, joinCodeMinutes: 10, relayEnabled: false },
  };
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
    group: defaultGroupConfig(),
    behavior: defaultBehaviorConfig(),
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

function plain(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiConfigError("invalid-config");
  }
  return value as Record<string, unknown>;
}

function bool(value: unknown): boolean {
  if (typeof value !== "boolean") throw new AiConfigError("invalid-config");
  return value;
}

function integer(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    throw new AiConfigError("invalid-config");
  }
  return value as number;
}

/** A score threshold with at most three decimals, so a revision diff stays readable. */
function threshold(value: unknown, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new AiConfigError("invalid-config");
  }
  if (Math.round(value * 1000) / 1000 !== value) throw new AiConfigError("invalid-config");
  return value;
}

function name(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:@/+-]{1,80}$/.test(value)) {
    throw new AiConfigError("invalid-config");
  }
  return value;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], max: number): T[] {
  if (!Array.isArray(value) || value.length > max) throw new AiConfigError("invalid-config");
  const out: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !(allowed as readonly string[]).includes(item)) {
      throw new AiConfigError("invalid-config");
    }
    if (out.includes(item as T)) throw new AiConfigError("invalid-config");
    out.push(item as T);
  }
  return out;
}

function terms(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 200) throw new AiConfigError("invalid-config");
  const seen = new Set<string>();
  return value.map((item) => {
    if (typeof item !== "string") throw new AiConfigError("invalid-config");
    const term = item.trim();
    const key = term.toLocaleLowerCase();
    if (
      term.length < 1 ||
      term.length > 32 ||
      term !== item ||
      [...term].some((char) => char.charCodeAt(0) < 32) ||
      seen.has(key)
    ) {
      throw new AiConfigError("invalid-config");
    }
    seen.add(key);
    return term;
  });
}

export function validateGroupConfig(raw: unknown): GroupConfig {
  const root = plain(raw);
  if (keys(root) !== "approvalQueue,limits,moderation,reactions") {
    throw new AiConfigError("invalid-config");
  }
  const moderation = plain(root.moderation);
  if (keys(moderation) !== "image,text") throw new AiConfigError("invalid-config");
  const image = plain(moderation.image);
  if (
    keys(image) !==
    "blockedCategories,enabled,modelId,onUnavailable,uncertainThreshold,unsafeThreshold"
  ) {
    throw new AiConfigError("invalid-config");
  }
  const unsafeThreshold = threshold(image.unsafeThreshold, 0.001, 1);
  const uncertainThreshold = threshold(image.uncertainThreshold, 0, 1);
  if (image.onUnavailable !== "block" || uncertainThreshold > unsafeThreshold) {
    throw new AiConfigError("invalid-config");
  }
  const text = plain(moderation.text);
  if (keys(text) !== "blockedTerms,enabled,onUnavailable,piiPatterns,ruleSet") {
    throw new AiConfigError("invalid-config");
  }
  if (text.onUnavailable !== "block") throw new AiConfigError("invalid-config");
  const blockedTerms = plain(text.blockedTerms);
  if (keys(blockedTerms) !== "en,es") throw new AiConfigError("invalid-config");
  const queue = plain(root.approvalQueue);
  if (keys(queue) !== "holdAll,reasonRetentionMinutes") throw new AiConfigError("invalid-config");
  const reactions = plain(root.reactions);
  if (keys(reactions) !== "en,es") throw new AiConfigError("invalid-config");
  const limits = plain(root.limits);
  if (keys(limits) !== "joinCodeMinutes,maxChildren,maxSessionMinutes,relayEnabled") {
    throw new AiConfigError("invalid-config");
  }
  return {
    moderation: {
      image: {
        enabled: bool(image.enabled),
        modelId: name(image.modelId),
        unsafeThreshold,
        uncertainThreshold,
        blockedCategories: pick(image.blockedCategories, GROUP_BLOCK_CATEGORIES, 6),
        onUnavailable: "block",
      },
      text: {
        enabled: bool(text.enabled),
        ruleSet: name(text.ruleSet),
        blockedTerms: { es: terms(blockedTerms.es), en: terms(blockedTerms.en) },
        piiPatterns: pick(text.piiPatterns, GROUP_PII_PATTERNS, 4),
        onUnavailable: "block",
      },
    },
    approvalQueue: {
      holdAll: bool(queue.holdAll),
      reasonRetentionMinutes: integer(queue.reasonRetentionMinutes, 0, 60),
    },
    reactions: {
      es: pick(reactions.es, GROUP_REACTION_IDS, 4),
      en: pick(reactions.en, GROUP_REACTION_IDS, 4),
    },
    limits: {
      maxChildren: integer(limits.maxChildren, 1, 4),
      maxSessionMinutes: integer(limits.maxSessionMinutes, 15, 240),
      joinCodeMinutes: integer(limits.joinCodeMinutes, 1, 10),
      relayEnabled: bool(limits.relayEnabled),
    },
  };
}

function validateCapabilities(raw: unknown): Record<AiCapability, AiPolicy> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new AiConfigError("invalid-config");
  const capabilities = raw as Record<string, unknown>;
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
  return result;
}

/**
 * Validates a registry and returns it as v3. A v1 document carries no group or behaviour section
 * and a v2 document no behaviour section, so they take `fallback`: the defaults when reading old
 * history, the current settings when an old client publishes, so it cannot reset them.
 */
export function validateAiConfig(
  raw: unknown,
  fallback: { readonly group?: GroupConfig; readonly behavior?: BehaviorConfig } = {},
): AiConfig {
  const root = plain(raw);
  const group = fallback.group ?? defaultGroupConfig();
  const behavior = fallback.behavior ?? defaultBehaviorConfig();
  if (root.schema === AI_CONFIG_SCHEMA_V1) {
    if (keys(root) !== "capabilities,schema") throw new AiConfigError("invalid-config");
    return {
      schema: AI_CONFIG_SCHEMA,
      capabilities: validateCapabilities(root.capabilities),
      group: structuredClone(group),
      behavior: structuredClone(behavior),
    };
  }
  if (root.schema === AI_CONFIG_SCHEMA_V2) {
    if (keys(root) !== "capabilities,group,schema") throw new AiConfigError("invalid-config");
    return {
      schema: AI_CONFIG_SCHEMA,
      capabilities: validateCapabilities(root.capabilities),
      group: validateGroupConfig(root.group),
      behavior: structuredClone(behavior),
    };
  }
  if (root.schema !== AI_CONFIG_SCHEMA || keys(root) !== "behavior,capabilities,group,schema") {
    throw new AiConfigError("invalid-config");
  }
  return {
    schema: AI_CONFIG_SCHEMA,
    capabilities: validateCapabilities(root.capabilities),
    group: validateGroupConfig(root.group),
    behavior: validateBehaviorConfig(root.behavior),
  };
}

export function configDiff(
  before: AiConfig,
  after: AiConfig,
): readonly (AiCapability | "group" | "behavior")[] {
  const changed: (AiCapability | "group" | "behavior")[] = AI_CAPABILITIES.filter(
    (capability) =>
      JSON.stringify(before.capabilities[capability]) !==
      JSON.stringify(after.capabilities[capability]),
  );
  if (JSON.stringify(before.group) !== JSON.stringify(after.group)) changed.push("group");
  if (JSON.stringify(before.behavior) !== JSON.stringify(after.behavior)) changed.push("behavior");
  return changed;
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
      append(validateAiConfig(raw, revisions.at(-1)!.config), expected, author, "publish", null),
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
      append(validateAiConfig(raw, current().config), expected, author, "publish", null),
    rollback: (source, expected, author) => {
      const found = db.prepare("SELECT * FROM ai_config_revisions WHERE revision = ?").get(source);
      if (!found) throw new AiConfigError("revision-not-found");
      return append(row(found).config, expected, author, "rollback", source);
    },
    close: () => db.close(),
  };
}
