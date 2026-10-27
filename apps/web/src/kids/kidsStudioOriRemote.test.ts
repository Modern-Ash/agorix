import { describe, expect, it } from "vitest";
import {
  evaluateOriStudioOutput,
  ORI_STUDIO_VERSION,
  type OriStudioContext,
} from "@agorix/ori-agent";
import { SCHEMA_VERSION } from "@agorix/program-model";
import { createStudioProgram } from "./kidsStudioModel.js";
import { requestStudioOri } from "./kidsStudioOriRemote.js";

const context = {
  actorId: "actor:studio-1-nova",
  locale: "es" as const,
  program: createStudioProgram("nova"),
};

const numbered: OriStudioContext = {
  ...context,
  program: {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "studio-actor-1-nova",
        trigger: { type: "greenFlag" as const },
        statements: [],
        procedures: [
          {
            id: "proc-1-1",
            name: "Paso",
            params: [{ id: "p1" as const, name: "Largo" }],
            body: [{ type: "move" as const, steps: 40, stepsFrom: "p1" as const }],
          },
        ],
      },
    ],
  },
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

  it("accepts numbers for a custom block and rejects a value outside its choices", async () => {
    const decision = evaluateOriStudioOutput(numbered, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: numbered.actorId,
      block: { type: "callProcedure", procedureId: "proc-1-1", args: [100] },
    });
    expect(decision.source).toBe("model");
    const accepted = async () =>
      new Response(JSON.stringify({ message: decision.message, proposal: decision.proposal }), {
        status: 200,
      });
    const offer = await requestStudioOri(numbered, accepted as typeof fetch);
    expect(offer.proposal?.operations[0]).toMatchObject({
      statement: {
        type: "callProcedure",
        procedureId: "proc-1-1",
        args: [{ type: "numericLiteral", value: 100 }],
      },
    });

    const forged = async () =>
      new Response(
        JSON.stringify({
          message: "bad",
          proposal: {
            ...decision.proposal!,
            operations: [
              {
                type: "appendStatement",
                scriptIndex: 0,
                statement: {
                  type: "callProcedure",
                  procedureId: "proc-1-1",
                  args: [{ type: "numericLiteral", value: 45 }],
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    const rejected = await requestStudioOri(numbered, forged as typeof fetch);
    expect(JSON.stringify(rejected.proposal)).not.toContain("callProcedure");
  });
});
