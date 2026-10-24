import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AiConfigError,
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
