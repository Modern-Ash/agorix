import { describe, expect, it } from "vitest";
import { evaluateOriStudioOutput, ORI_STUDIO_VERSION } from "@agorix/ori-agent";
import { createStudioProgram } from "./kidsStudioModel.js";
import { requestStudioOri } from "./kidsStudioOriRemote.js";

const context = {
  actorId: "actor:studio-1-nova",
  locale: "es" as const,
  program: createStudioProgram("nova"),
};

describe("free scene Ori browser boundary", () => {
  it("accepts a bounded server proposal and never sends creative media or account data", async () => {
    const decision = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: { type: "turn", degrees: 90 },
    });
    const calls: string[] = [];
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url), String(init?.body));
      return new Response(
        JSON.stringify({ message: decision.message, proposal: decision.proposal }),
        { status: 200 },
      );
    };
    const offer = await requestStudioOri(context, fetchImpl as typeof fetch);
    expect(offer.proposal?.operations[0]).toMatchObject({
      statement: { type: "turn", degrees: 90 },
    });
    expect(calls[0]).toBe("/api/tutor/studio/ori");
    expect(calls[1]).not.toMatch(/assets|account|link|media/);
  });

  it("uses the local reviewable fallback for forged scope or an unavailable server", async () => {
    const valid = evaluateOriStudioOutput(context, undefined).proposal!;
    const forged = async () =>
      new Response(
        JSON.stringify({
          message: "bad",
          proposal: { ...valid, affectedActorIds: ["actor:studio-2-mika"] },
        }),
        { status: 200 },
      );
    expect(
      (await requestStudioOri(context, forged as typeof fetch)).proposal?.affectedActorIds,
    ).toEqual([context.actorId]);
    const unavailable = async () => new Response("", { status: 503 });
    expect(
      (await requestStudioOri(context, unavailable as typeof fetch)).proposal?.operations,
    ).toHaveLength(1);
  });
});
