import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  AI_CONFIG_SCHEMA,
  AI_CONFIG_SCHEMA_V1,
  AiConfigError,
  configDiff,
  defaultGroupConfig,
  createMemoryAiConfigRepository,
  defaultAiConfig,
  openSqliteAiConfigRepository,
  validateAiConfig,
} from "./aiConfig.js";

const initial = defaultAiConfig(
  {
    provider: "auto",
    codexBin: "codex",
    codexModel: "gpt-6-luna",
    opencodeBin: "opencode",
    timeoutMs: 7_000,
  },
  { adapter: "fake", timeoutMs: 4_000, capabilities: ["coach"] },
);

describe("durable AI configuration", () => {
  it("validates a complete registry and refuses unknown fields, providers, secrets and limits", () => {
    expect(validateAiConfig(initial)).toEqual(initial);
    const invalid = [
      { ...initial, token: "secret" },
      {
        ...initial,
        capabilities: {
          ...initial.capabilities,
          mission: { ...initial.capabilities.mission, provider: "openai-compatible" },
        },
      },
      {
        ...initial,
        capabilities: {
          ...initial.capabilities,
          chat: { ...initial.capabilities.chat, timeoutMs: 60_000 },
        },
      },
      {
        ...initial,
        capabilities: {
          ...initial.capabilities,
          studio: { ...initial.capabilities.studio, fallback: "none" },
        },
      },
    ];
    for (const value of invalid) expect(() => validateAiConfig(value)).toThrow(AiConfigError);
  });

  it("publishes durable revisions, rejects stale changes and restores an earlier revision", () => {
    const dir = mkdtempSync(join(tmpdir(), "agorix-ai-config-"));
    const path = join(dir, "data", "config.sqlite");
    try {
      let repository = openSqliteAiConfigRepository(path, initial);
      const edited = {
        ...initial,
        capabilities: {
          ...initial.capabilities,
          mission: {
            ...initial.capabilities.mission,
            enabled: false,
            promptTemplate: "Ask one question",
          },
        },
      };
      expect(repository.publish(edited, 1, "operator").revision).toBe(2);
      expect(() => repository.publish(initial, 1, "operator")).toThrow(AiConfigError);
      repository.close();
      repository = openSqliteAiConfigRepository(path, initial);
      expect(repository.current().config.capabilities.mission.enabled).toBe(false);
      expect(repository.current().author).toBe("operator");
      expect(repository.rollback(1, 2, "operator").revision).toBe(3);
      expect(repository.current().config).toEqual(initial);
      expect(repository.history().map((item) => item.action)).toEqual([
        "rollback",
        "publish",
        "seed",
      ]);
      expect(() => repository.rollback(99, 3, "operator")).toThrow(AiConfigError);
      repository.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("memory implementation preserves the same revision contract for tests", () => {
    const repository = createMemoryAiConfigRepository(initial);
    expect(repository.publish(initial, 1, "operator").revision).toBe(2);
    expect(repository.rollback(1, 2, "operator").revision).toBe(3);
  });
});

type DeepMutable<T> = { -readonly [K in keyof T]: DeepMutable<T[K]> };
type Draft = DeepMutable<ReturnType<typeof defaultGroupConfig>>;

describe("group settings in the registry (schema v2)", () => {
  const withGroup = (patch: (group: Draft) => unknown) => {
    const group = structuredClone(initial.group) as Draft;
    return { ...initial, group: patch(group) ?? group };
  };

  it("ships fail-closed defaults: hold everything, block on unavailable, relay off", () => {
    expect(initial.schema).toBe(AI_CONFIG_SCHEMA);
    const group = initial.group;
    expect(group.approvalQueue.holdAll).toBe(true);
    expect(group.moderation.image.onUnavailable).toBe("block");
    expect(group.moderation.text.onUnavailable).toBe("block");
    expect(group.limits.relayEnabled).toBe(false);
    expect(group.limits.maxChildren).toBe(4);
    expect(group.moderation.image.uncertainThreshold).toBeLessThanOrEqual(
      group.moderation.image.unsafeThreshold,
    );
  });

  it("accepts a valid edit and shows the group as changed in a preview diff", () => {
    const edited = validateAiConfig(
      withGroup((g) => {
        g.moderation.text.blockedTerms.es = ["tonto"];
        g.limits.maxSessionMinutes = 60;
      }),
    );
    expect(edited.group.moderation.text.blockedTerms.es).toEqual(["tonto"]);
    expect(configDiff(initial, edited)).toEqual(["group"]);
  });

  it("refuses unknown fields, weaker policies, out-of-range limits and bad lists", () => {
    const bad: ((g: Draft) => unknown)[] = [
      (g) => ({ ...g, secret: "no" }),
      (g) => ((g.moderation.image as { onUnavailable: string }).onUnavailable = "allow"),
      (g) => ((g.moderation.text as { onUnavailable: string }).onUnavailable = "allow"),
      (g) => (g.moderation.image.uncertainThreshold = 0.9),
      (g) => (g.moderation.image.unsafeThreshold = 0),
      (g) => (g.moderation.image.unsafeThreshold = 0.12345),
      (g) => (g.moderation.image.unsafeThreshold = Number.NaN),
      (g) => (g.moderation.image.modelId = "../../etc/passwd "),
      (g) => ((g.moderation.image.blockedCategories as string[]) = ["violence", "violence"]),
      (g) => ((g.moderation.image.blockedCategories as string[]) = ["gore"]),
      (g) => ((g.moderation.text.piiPatterns as string[]) = ["ssn"]),
      (g) => ((g.moderation.text.blockedTerms.es as string[]) = ["a", "A"]),
      (g) => ((g.moderation.text.blockedTerms.es as string[]) = [" x"]),
      (g) => ((g.moderation.text.blockedTerms.en as string[]) = ["x".repeat(33)]),
      (g) => ((g.moderation.text.blockedTerms.en as string[]) = Array(201).fill("x")),
      (g) => ((g.reactions.es as string[]) = ["like", "<script>"]),
      (g) => (g.limits.maxChildren = 5),
      (g) => (g.limits.maxChildren = 0),
      (g) => (g.limits.maxSessionMinutes = 241),
      (g) => (g.limits.joinCodeMinutes = 11),
      (g) => ((g.limits as { relayEnabled: unknown }).relayEnabled = "yes"),
      (g) => (g.approvalQueue.reasonRetentionMinutes = 61),
      (g) => ((g.approvalQueue as { holdAll: unknown }).holdAll = 1),
    ];
    for (const patch of bad) {
      const candidate = withGroup(patch);
      expect(() => validateAiConfig(candidate), patch.toString()).toThrow(AiConfigError);
    }
    expect(() => validateAiConfig({ ...initial, group: undefined })).toThrow(AiConfigError);
  });

  it("reads an old v1 revision as v2 with defaults, without rewriting the database", () => {
    const dir = mkdtempSync(join(tmpdir(), "agorix-ai-config-v1-"));
    const path = join(dir, "data", "config.sqlite");
    try {
      const v1 = { schema: AI_CONFIG_SCHEMA_V1, capabilities: initial.capabilities };
      const seeded = openSqliteAiConfigRepository(path, initial);
      seeded.close();
      // Replace the stored seed with a genuine v1 document, as an older server would have written.
      const db = new DatabaseSync(path);
      db.prepare("UPDATE ai_config_revisions SET config_json = ? WHERE revision = 1").run(
        JSON.stringify(v1),
      );
      db.close();
      const repository = openSqliteAiConfigRepository(path, initial);
      expect(repository.current().config.schema).toBe(AI_CONFIG_SCHEMA);
      expect(repository.current().config.group).toEqual(defaultGroupConfig());
      const raw = new DatabaseSync(path, { readOnly: true });
      const stored = raw.prepare("SELECT config_json FROM ai_config_revisions").get() as {
        config_json: string;
      };
      expect(JSON.parse(stored.config_json).schema).toBe(AI_CONFIG_SCHEMA_V1);
      raw.close();
      repository.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps the current group settings when an older client publishes v1", () => {
    const repository = createMemoryAiConfigRepository(initial);
    const tuned = withGroup((g) => {
      g.limits.maxChildren = 2;
    });
    repository.publish(tuned, 1, "operator");
    const v1 = { schema: AI_CONFIG_SCHEMA_V1, capabilities: initial.capabilities };
    const next = repository.publish(v1, 2, "operator");
    expect(next.config.group.limits.maxChildren).toBe(2);
    expect(next.config.schema).toBe(AI_CONFIG_SCHEMA);
  });

  it("restores an earlier group setting on rollback", () => {
    const repository = createMemoryAiConfigRepository(initial);
    repository.publish(
      withGroup((g) => void (g.limits.relayEnabled = true)),
      1,
      "operator",
    );
    expect(repository.current().config.group.limits.relayEnabled).toBe(true);
    repository.rollback(1, 2, "operator");
    expect(repository.current().config.group.limits.relayEnabled).toBe(false);
  });
});
