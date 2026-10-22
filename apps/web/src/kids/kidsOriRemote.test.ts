import { describe, expect, it } from "vitest";
import { getKidsMission, kidsMoveSteps } from "@agorix/curriculum";
import { createProgramProposal } from "@agorix/proposals";
import { requestKidsOriOffer } from "./kidsOriRemote.js";

const mission = getKidsMission("kids.m1.straight", "es");
const program = mission.starterProject;
const proposal = createProgramProposal({
  id: "ori-test-move",
  baseProgram: program,
  source: { kind: "learning-companion", capability: "builder" },
  purpose: "Una idea de Ori",
  rationale: "Mirá y decidí",
  affectedNodeIds: ["scripts[0]/statements[0]"],
  operations: [
    {
      type: "appendStatement",
      scriptIndex: 0,
      statement: { type: "move", steps: kidsMoveSteps(2) },
    },
  ],
});

describe("Kids Ori browser boundary (issue #382)", () => {
  it("accepts only a fresh, canonical, allowed model proposal", async () => {
    const calls: { url: unknown; init: RequestInit | undefined }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ message: "ignored", proposal }), { status: 200 });
    };
    const offer = await requestKidsOriOffer(program, mission.id, "es", 1, 0, { fetchImpl });
    expect(offer).toMatchObject({ kind: "move", amount: 2, proposal });
    expect(calls[0]?.url).toBe("/api/tutor/ori");
    expect(calls[0]?.init?.credentials).toBe("same-origin");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      missionId: mission.id,
      locale: "es",
      hintLevel: 1,
      program,
    });
  });

  it("ignores stale, forbidden and malformed proposals", async () => {
    const forbidden = {
      ...proposal,
      operations: [{ type: "removeStatement", nodeId: "scripts[0]/statements[0]" }],
    };
    for (const candidate of [
      { ...proposal, baseProgramHash: "stale" },
      forbidden,
      {
        ...proposal,
        operations: [{ ...proposal.operations[0], statement: { type: "move", steps: 999 } }],
      },
      { ...proposal, source: { kind: "web" } },
    ]) {
      const fetchImpl: typeof fetch = async () =>
        new Response(JSON.stringify({ message: "ignored", proposal: candidate }), { status: 200 });
      expect(await requestKidsOriOffer(program, mission.id, "es", 1, 0, { fetchImpl })).toBeNull();
    }
  });

  it("falls back on HTTP failure and on a response that misses the budget", async () => {
    const failed: typeof fetch = async () => new Response("offline", { status: 503 });
    expect(
      await requestKidsOriOffer(program, mission.id, "es", 1, 0, { fetchImpl: failed }),
    ).toBeNull();
    const stalled: typeof fetch = () => new Promise(() => {});
    expect(
      await requestKidsOriOffer(program, mission.id, "es", 1, 0, {
        fetchImpl: stalled,
        timeoutMs: 10,
      }),
    ).toBeNull();
  });
});
