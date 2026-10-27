import { describe, expect, it } from "vitest";
import { ORI_INTERVENTION_DEFAULT } from "@agorix/ori-agent";
import { deviceBucket, loadInterventionPolicy, ROLLOUT_BUCKET_KEY } from "./kidsBehavior.js";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

describe("device bucket for gradual rollouts (issue #620)", () => {
  it("draws a whole number from 0 to 99 once and keeps it", () => {
    const store = memory();
    expect(deviceBucket(store, () => 0.426)).toBe(42);
    expect(deviceBucket(store, () => 0.9)).toBe(42);
    expect([...store.data.keys()]).toEqual([ROLLOUT_BUCKET_KEY]);
    expect(deviceBucket(memory(), () => 0.9999999)).toBe(99);
    expect(deviceBucket(memory(), () => 0)).toBe(0);
  });

  it("ignores a stored value that is not a bucket, and works without storage", () => {
    for (const bad of ["-3", "100", "abc", "4.5", ""]) {
      const store = memory({ [ROLLOUT_BUCKET_KEY]: bad });
      expect(deviceBucket(store, () => 0.07)).toBe(7);
    }
    expect(deviceBucket(undefined, () => 0.5)).toBe(50);
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(deviceBucket(blocked, () => 0.31)).toBe(31);
  });
});

describe("intervention policy from the server", () => {
  const reply = (body: unknown, ok = true) =>
    (async () => ({ ok, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;

  it("asks with the device bucket and nothing else", async () => {
    let seen = "";
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = `${url} ${JSON.stringify(Object.keys(init))}`;
      return {
        ok: true,
        text: async () =>
          JSON.stringify({ intervention: { minFailedRuns: 2, minHints: 3, maxProposalBlocks: 5 } }),
      };
    }) as unknown as typeof fetch;
    const policy = await loadInterventionPolicy(fetchImpl, 37);
    expect(policy).toEqual({ minFailedRuns: 2, minHints: 3, maxProposalBlocks: 5 });
    expect(seen).toContain("/api/tutor/behavior?bucket=37");
    expect(seen).not.toContain("body");
  });

  it("keeps the safe defaults for anything that is not a valid policy", async () => {
    for (const fetchImpl of [
      reply({ intervention: { minFailedRuns: 0, minHints: 1, maxProposalBlocks: 99 } }),
      reply({ intervention: {} }),
      reply({}, false),
      (async () => {
        throw new Error("offline");
      }) as unknown as typeof fetch,
    ]) {
      expect(await loadInterventionPolicy(fetchImpl, 1)).toEqual(ORI_INTERVENTION_DEFAULT);
    }
  });
});
