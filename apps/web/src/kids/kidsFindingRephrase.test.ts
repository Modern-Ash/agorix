import { describe, expect, it } from "vitest";
import type { Finding } from "@agorix/run-evidence";
import { neutralSentence, requestFindingRephrase } from "./kidsFindingRephrase.js";

const finding: Finding = {
  id: "neverStarted:s",
  kind: "neverStarted",
  actorId: "actor:studio-2-nova",
  nodeIds: ["scripts[1]"],
  counts: { senders: 0 },
  event: { type: "message", name: "vamos", senders: 0 },
  confidence: 0.9,
};
const reply = (status: number, body: unknown = {}) =>
  (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

describe("asking for another way to say it", () => {
  it("takes the learner's names out of the sentence it sends", () => {
    for (const locale of ["es", "en"] as const)
      expect(neutralSentence(finding, locale, "9-12")).not.toContain("vamos");
    expect(neutralSentence(finding, "es", "9-12")).toMatch(/mensaje, pero/);
  });

  it("sends the closed request: no program, no ids", async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ text: "Otra forma." }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await requestFindingRephrase(finding, "es", "6-8", fetchImpl)).toEqual({
      status: "ok",
      text: "Otra forma.",
    });
    expect(Object.keys(body).sort()).toEqual(["band", "finding", "local", "locale", "version"]);
    expect(body.finding).toEqual({
      kind: "neverStarted",
      counts: { senders: 0 },
      eventType: "message",
    });
  });

  it("tells no host or model from a failed answer", async () => {
    for (const status of [404, 502, 503, 504])
      expect(await requestFindingRephrase(finding, "es", "9-12", reply(status))).toEqual({
        status: "unavailable",
      });
    for (const status of [400, 429, 500])
      expect(await requestFindingRephrase(finding, "es", "9-12", reply(status))).toEqual({
        status: "failed",
      });
    expect(await requestFindingRephrase(finding, "es", "9-12", reply(200, { text: 5 }))).toEqual({
      status: "failed",
    });
    expect(
      await requestFindingRephrase(finding, "es", "9-12", reply(200, { text: "x".repeat(300) })),
    ).toEqual({
      status: "failed",
    });
    const broken = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await requestFindingRephrase(finding, "es", "9-12", broken)).toEqual({
      status: "failed",
    });
  });
});
