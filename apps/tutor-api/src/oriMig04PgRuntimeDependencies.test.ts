import { describe, expect, it } from "vitest";
import { assertOriMig04RuntimeDependencies } from "./oriMig04PgRuntimeDependencies.js";

const valid = () => ({
  deploymentId: "ori",
  auth: {
    resolveSession: async () => {
      throw Error("unused");
    },
  },
  sessionToken: () => null,
  repository: {
    get: async () => {
      throw Error("unused");
    },
  },
  activeProject: async () => null,
  learningContext: async () => null,
  rolloutDecide: () => ({ learnerVisible: false }),
  oriRoot: "/trusted/ori",
  world: {},
});

describe("MIG-04 runtime dependency integrity", () => {
  it("accepts a complete trusted provider contract without side effects", () => {
    expect(() => assertOriMig04RuntimeDependencies(valid() as never)).not.toThrow();
  });

  it("rejects absent repository lookup and incomplete project selection", () => {
    const base = valid();
    for (const override of [
      { repository: {} },
      { repository: null },
      { activeProject: undefined },
      { learningContext: undefined },
      { rolloutDecide: undefined },
    ]) {
      expect(() => assertOriMig04RuntimeDependencies({ ...base, ...override } as never)).toThrow(
        "Missing trusted Ori runtime dependencies",
      );
    }
  });

  it("rejects invalid runtime context and missing authentication", () => {
    const base = valid();
    for (const override of [
      { oriRoot: "" },
      { world: null },
      { auth: null },
      { sessionToken: undefined },
    ]) {
      expect(() =>
        assertOriMig04RuntimeDependencies({ ...base, ...override } as never),
      ).toThrow("Missing trusted Ori runtime dependencies");
    }
  });
});
