import { describe, expect, it } from "vitest";
import { DEFAULT_GROUP_SETTINGS, loadGroupSettings, parseGroupSettings } from "./groupSettings.js";

// Issue #567: the organizer's device follows the admin registry, and falls back to the strictest values.
const good = {
  revision: 7,
  group: {
    moderation: {
      image: { enabled: true, unsafeThreshold: 0.6, uncertainThreshold: 0.3 },
      text: {
        enabled: true,
        blockedTerms: { es: ["tonto"], en: [] },
        piiPatterns: ["phone", "url"],
      },
    },
    approvalQueue: { holdAll: false },
    reactions: { es: ["like", "party"], en: ["like"] },
  },
};

const respond = (status: number, body: string) => async () =>
  ({ status, text: async () => body }) as never;

describe("parseGroupSettings", () => {
  it("reads the parts the device acts on", () => {
    expect(parseGroupSettings(good)).toEqual({
      revision: 7,
      image: { enabled: true, unsafe: 0.6, uncertain: 0.3 },
      text: {
        enabled: true,
        blockedTerms: { es: ["tonto"], en: [] },
        piiPatterns: ["phone", "url"],
      },
      holdAll: false,
      reactions: { es: ["like", "party"], en: ["like"] },
    });
  });

  it("rejects the whole response if any part is malformed", () => {
    const clone = () => structuredClone(good) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const bad: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    let c = clone();
    c.group.moderation.image.unsafeThreshold = 0;
    bad.push(c);
    c = clone();
    c.group.moderation.image.uncertainThreshold = 0.9;
    bad.push(c);
    c = clone();
    c.group.moderation.text.piiPatterns = ["ssn"];
    bad.push(c);
    c = clone();
    c.group.moderation.text.blockedTerms.es = ["x".repeat(33)];
    bad.push(c);
    c = clone();
    c.group.reactions.es = ["like", "<script>"];
    bad.push(c);
    c = clone();
    c.group.approvalQueue.holdAll = "no";
    bad.push(c);
    c = clone();
    delete c.group.reactions;
    bad.push(c);
    c = clone();
    c.revision = "7";
    bad.push(c);
    for (const value of [...bad, null, "x", [], {}]) {
      expect(parseGroupSettings(value), JSON.stringify(value)?.slice(0, 60)).toBeUndefined();
    }
  });
});

describe("loadGroupSettings", () => {
  it("returns the registry values when the read works", async () => {
    expect((await loadGroupSettings(respond(200, JSON.stringify(good)))).revision).toBe(7);
  });

  it("falls back to the strictest defaults on any failure", async () => {
    expect(await loadGroupSettings(respond(503, "{}"))).toBe(DEFAULT_GROUP_SETTINGS);
    expect(await loadGroupSettings(respond(200, "{not json"))).toBe(DEFAULT_GROUP_SETTINGS);
    expect(await loadGroupSettings(respond(200, JSON.stringify({ revision: 1 })))).toBe(
      DEFAULT_GROUP_SETTINGS,
    );
    expect(
      await loadGroupSettings(async () => {
        throw new Error("offline");
      }),
    ).toBe(DEFAULT_GROUP_SETTINGS);
  });

  it("defaults are the strict ones", () => {
    expect(DEFAULT_GROUP_SETTINGS.holdAll).toBe(true);
    expect(DEFAULT_GROUP_SETTINGS.image.enabled).toBe(true);
    expect(DEFAULT_GROUP_SETTINGS.text.piiPatterns).toHaveLength(4);
  });
});
