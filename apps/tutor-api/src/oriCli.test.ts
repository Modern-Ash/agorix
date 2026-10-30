import { describe, expect, it } from "vitest";
import { getKidsMission, getKidsAdvancedMission } from "@agorix/curriculum";
import {
  ORI_AGENT_VERSION,
  ORI_ADVANCED_VERSION,
  ORI_ADVANCED_SCORE_VERSION,
} from "@agorix/ori-agent";
import {
  CliProcessError,
  createOriCliService,
  oriCliConfigFromEnv,
  runBoundedProcess,
  type OriCliProcess,
} from "./oriCli.js";
import { defaultAiConfig } from "./aiConfig.js";
import { configFromEnv } from "./index.js";

const mission = getKidsMission("kids.m1.straight", "es");
const context = {
  mission,
  missionIndex: 0 as const,
  program: mission.starterProject,
  locale: "es" as const,
  hintLevel: 1 as const,
};
const validOutput = JSON.stringify({
  version: ORI_AGENT_VERSION,
  kind: "program-suggestion",
  reason: "toward-goal",
  blocks: [{ type: "move", count: 4 }],
});

describe("Ori host CLI adapter (issue #381)", () => {
  it("applies a published model and instruction without losing deterministic fallback", async () => {
    const calls: Parameters<OriCliProcess>[] = [];
    let policy = defaultAiConfig(
      oriCliConfigFromEnv({}),
      configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }),
    ).capabilities.mission;
    const service = createOriCliService(oriCliConfigFromEnv({}), {
      policyFor: () => policy,
      run: async (...args) => {
        calls.push(args);
        return args[1].includes("--version") ? "version" : validOutput;
      },
    });
    policy = {
      ...policy,
      provider: "codex",
      model: "custom-model",
      promptTemplate: "Ask for a prediction first.",
    };
    const model = await service.respond(context);
    expect(model.source).toBe("model");
    const call = calls.find(([, args]) => args.includes("exec"))!;
    expect(call[1].slice(call[1].indexOf("--model"), call[1].indexOf("--model") + 2)).toEqual([
      "--model",
      "custom-model",
    ]);
    expect(call[2].input).toContain("Ask for a prediction first.");
    policy = { ...policy, enabled: false };
    const count = calls.length;
    expect((await service.respond(context)).source).toBe("fallback");
    expect(calls).toHaveLength(count);
  });
  it("sends only a fixed stage-1 scene summary to the real CLI boundary", async () => {
    const calls: Parameters<OriCliProcess>[] = [];
    const run: OriCliProcess = async (...args) => {
      calls.push(args);
      return args[1].includes("--version")
        ? "version"
        : JSON.stringify({
            version: ORI_ADVANCED_VERSION,
            kind: "program-suggestion",
            actorId: "actor:ori",
            block: { type: "playSound", soundId: "asset:sound.beacon" },
          });
    };
    const service = createOriCliService(oriCliConfigFromEnv({}), { run });
    const decision = await service.advanced({
      stage: "scene",
      actorId: "actor:ori",
      locale: "es",
      program: getKidsAdvancedMission("scene", "es").starterProgram,
    });
    expect(decision.source).toBe("model");
    expect(decision.proposal?.affectedAssetIds).toEqual(["asset:sound.beacon"]);
    const input = calls.find(([, args]) => args.includes("exec"))?.[2].input ?? "";
    expect(input).toContain(ORI_ADVANCED_VERSION);
    expect(input).toContain("actor:ori");
    expect(input).not.toContain("learnerIntent");
  });
  it("sends a bounded stage-3 score summary to the model boundary", async () => {
    const calls: Parameters<OriCliProcess>[] = [];
    const run: OriCliProcess = async (...args) => {
      calls.push(args);
      return args[1].includes("--version")
        ? "version"
        : JSON.stringify({
            version: ORI_ADVANCED_SCORE_VERSION,
            kind: "data-suggestion",
            actorId: "actor:ori",
            block: { type: "changeVariable", variableId: "score", delta: 1 },
          });
    };
    const service = createOriCliService(oriCliConfigFromEnv({}), { run });
    const decision = await service.advanced({
      stage: "score",
      actorId: "actor:ori",
      locale: "es",
      program: getKidsAdvancedMission("score", "es").starterProgram,
    });
    expect(decision.source).toBe("model");
    expect(decision.proposal?.operations[0]).toMatchObject({
      statement: { type: "changeVariable" },
    });
    const input = calls.find(([, args]) => args.includes("exec"))?.[2].input ?? "";
    expect(input).toContain(ORI_ADVANCED_SCORE_VERSION);
    expect(input).toContain('"variable":"score"');
    expect(input).not.toContain("learnerIntent");
  });
  it("selects Codex before OpenCode and disables every model tool", async () => {
    const calls: Parameters<OriCliProcess>[] = [];
    const run: OriCliProcess = async (...args) => {
      calls.push(args);
      return args[1].includes("--version") ? "version" : validOutput;
    };
    const service = createOriCliService(oriCliConfigFromEnv({}), { run });
    expect(await service.health()).toMatchObject({
      configured: true,
      available: true,
      providerInUse: "codex",
    });
    expect((await service.respond(context)).source).toBe("model");
    const invocation = calls.find(([, args]) => args.includes("exec"));
    expect(invocation?.[0]).toBe("codex");
    expect(invocation?.[1]).toContain("read-only");
    expect(invocation?.[1]).toContain("shell_tool");
    expect(invocation?.[1]).toContain("--ignore-user-config");
    expect(invocation?.[1]).toContain("--ephemeral");
    expect(invocation?.[1]).toContain("gpt-6-luna");
    expect(invocation?.[2].input).toContain(ORI_AGENT_VERSION);
    expect(invocation?.[2].input).not.toContain("learnerIntent");
  });

  it("selects OpenCode when Codex is absent with all permissions denied", async () => {
    const calls: Parameters<OriCliProcess>[] = [];
    const run: OriCliProcess = async (...args) => {
      calls.push(args);
      if (args[1].includes("--version")) {
        if (args[0] === "codex") throw new CliProcessError("unavailable");
        return "version";
      }
      return JSON.stringify({ type: "text", part: { text: validOutput } });
    };
    const service = createOriCliService(oriCliConfigFromEnv({}), { run });
    expect(await service.health()).toMatchObject({ providerInUse: "opencode" });
    expect((await service.respond(context)).source).toBe("model");
    const invocation = calls.find(([, args]) => args.includes("run"));
    expect(invocation?.[0]).toBe("opencode");
    expect(invocation?.[1]).toContain("--pure");
    expect(invocation?.[2].env?.OPENCODE_PERMISSION).toBe('"deny"');
    expect(invocation?.[2].env?.OPENCODE_DISABLE_DEFAULT_PLUGINS).toBe("1");
  });

  it("switches to OpenCode when a healthy Codex fails during generation", async () => {
    const calls: string[] = [];
    let alternateTimeout = 0;
    const run: OriCliProcess = async (bin, args, options) => {
      if (args.includes("--version")) return "version";
      calls.push(bin);
      if (bin === "codex") {
        await new Promise((resolve) => setTimeout(resolve, 10));
        throw new CliProcessError("failed");
      }
      alternateTimeout = options.timeoutMs;
      return JSON.stringify({ type: "text", part: { text: validOutput } });
    };
    const service = createOriCliService(oriCliConfigFromEnv({}), { run });
    expect((await service.respond(context)).source).toBe("model");
    expect(calls).toEqual(["codex", "opencode"]);
    expect(alternateTimeout).toBeLessThan(7_000);
    expect(service.diagnostics()).toMatchObject({
      attempts: 1,
      modelResponses: 1,
      lastErrorClass: null,
    });
    expect(await service.health()).toMatchObject({ providerInUse: "opencode" });
    expect((await service.respond(context)).source).toBe("model");
    expect(calls).toEqual(["codex", "opencode", "opencode"]);
  });

  it("does not switch providers when policy selects Codex explicitly", async () => {
    const calls: string[] = [];
    const policy = {
      ...defaultAiConfig(oriCliConfigFromEnv({}), configFromEnv({ AGORIX_TUTOR_ADAPTER: "fake" }))
        .capabilities.mission,
      provider: "codex" as const,
      enabled: true,
    };
    const service = createOriCliService(oriCliConfigFromEnv({}), {
      policyFor: () => policy,
      run: async (bin, args) => {
        if (args.includes("--version")) return "version";
        calls.push(bin);
        throw new CliProcessError("timeout");
      },
    });
    expect((await service.respond(context)).source).toBe("fallback");
    expect(calls).toEqual(["codex"]);
  });

  it("returns the exact Kids 08 fallback on timeout, bad output and no installed CLI", async () => {
    for (const result of ["timeout", "invalid", "missing"] as const) {
      const run: OriCliProcess = async (_bin, args) => {
        if (args.includes("--version")) {
          if (result === "missing") throw new CliProcessError("unavailable");
          return "version";
        }
        if (result === "timeout") throw new CliProcessError("timeout");
        return "not JSON";
      };
      const service = createOriCliService(oriCliConfigFromEnv({}), { run });
      const decision = await service.respond(context);
      expect(decision.source).toBe("fallback");
      expect(service.diagnostics()).toMatchObject({
        attempts: 1,
        modelResponses: 0,
        lastErrorClass:
          result === "timeout"
            ? "timeout"
            : result === "invalid"
              ? "invalid-response"
              : "provider-unavailable",
      });
      expect(decision.proposal?.operations).toEqual([
        { type: "appendStatement", scriptIndex: 0, statement: { type: "move", steps: 160 } },
      ]);
    }
  });

  it("keeps bounded aggregate timing and no child content in diagnostics", async () => {
    let clock = 0;
    const service = createOriCliService(oriCliConfigFromEnv({}), {
      now: () => clock,
      run: async (_bin, args) => {
        if (args.includes("--version")) return "version";
        clock += 120;
        return validOutput;
      },
    });
    expect((await service.respond(context)).source).toBe("model");
    expect((await service.respond(context)).source).toBe("model");
    expect(service.diagnostics()).toEqual({
      lastErrorClass: null,
      attempts: 2,
      modelResponses: 2,
      p50Ms: 120,
      p95Ms: 120,
    });
    expect(JSON.stringify(service.diagnostics())).not.toContain(mission.title);
  });

  it("bounds process output and kills an overlong or slow child", async () => {
    await expect(
      runBoundedProcess(process.execPath, ["-e", "process.stdout.write('x'.repeat(5000))"], {
        input: "",
        timeoutMs: 1000,
        maxOutputBytes: 100,
        cwd: process.cwd(),
      }),
    ).rejects.toMatchObject({ code: "output-too-large" });
    await expect(
      runBoundedProcess(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
        input: "",
        timeoutMs: 50,
        maxOutputBytes: 100,
        cwd: process.cwd(),
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("bounds the host response window and permits an explicit Codex model", () => {
    expect(oriCliConfigFromEnv({}).timeoutMs).toBe(7_000);
    expect(oriCliConfigFromEnv({ AGORIX_ORI_TIMEOUT_MS: "99999" }).timeoutMs).toBe(7_000);
    expect(oriCliConfigFromEnv({ AGORIX_ORI_CODEX_MODEL: "test-model" }).codexModel).toBe(
      "test-model",
    );
  });
});
