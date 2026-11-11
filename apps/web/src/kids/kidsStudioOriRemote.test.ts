import { describe, expect, it } from "vitest";
import {
  evaluateOriStudioOutput,
  ORI_STUDIO_VERSION,
  redactProgramForOri,
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

/**
 * The service as it behaves: it reads the program it was sent (never the child's own) and answers
 * with an idea made for that. `raw` is what its model said.
 */
function service(raw: unknown, seen: string[] = []): typeof fetch {
  return (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as OriStudioContext;
    seen.push(String(init?.body));
    const decision = evaluateOriStudioOutput(body, raw);
    return new Response(
      JSON.stringify({ message: decision.message, proposal: decision.proposal }),
      { status: 200 },
    );
  }) as typeof fetch;
}

describe("free scene Ori browser boundary", () => {
  it("accepts a bounded server proposal and never sends creative media or account data", async () => {
    const calls: string[] = [];
    const sent: string[] = [];
    const inner = service(
      {
        version: ORI_STUDIO_VERSION,
        kind: "program-suggestion",
        actorId: context.actorId,
        block: { type: "turn", degrees: 90 },
      },
      sent,
    );
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push(String(url), String(init?.body));
      return inner(url, init);
    };
    const offer = await requestStudioOri(context, fetchImpl as typeof fetch);
    expect(offer.proposal?.operations[0]).toMatchObject({
      statement: { type: "turn", degrees: 90 },
    });
    expect(calls[0]).toBe("/api/tutor/studio/ori");
    expect(calls[1]).not.toMatch(/assets|account|link|media/);
  });

  it("uses the local reviewable fallback for forged scope or an unavailable server", async () => {
    const valid = evaluateOriStudioOutput(
      { ...context, program: redactProgramForOri(context.program) },
      undefined,
    ).proposal!;
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
    const redactedNumbered = { ...numbered, program: redactProgramForOri(numbered.program) };
    const decision = evaluateOriStudioOutput(redactedNumbered, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: numbered.actorId,
      block: { type: "callProcedure", procedureId: "proc-1-1", args: [100] },
    });
    expect(decision.source).toBe("model");
    const accepted = service({
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: numbered.actorId,
      block: { type: "callProcedure", procedureId: "proc-1-1", args: [100] },
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

  it("sends the program's shape and none of what the child wrote, and the idea still lands on their program", async () => {
    const child: OriStudioContext = {
      actorId: "actor:studio-1-nova",
      locale: "es",
      program: {
        schema: SCHEMA_VERSION,
        variables: [{ id: "studio-var-1", name: "Puntos de Ana", initialValue: 0, visible: true }],
        textVariables: [
          { id: "studio-text-1", name: "Mi secreto", initialValue: "", visible: true },
        ],
        lists: [{ id: "studio-list-1", name: "Amigos de Ana", initialItems: [], visible: true }],
        scripts: [
          {
            id: "studio-actor-1-nova",
            trigger: { type: "greenFlag" },
            statements: [
              { type: "say", text: "Hola, soy Ana", seconds: 2 },
              {
                type: "listAdd",
                listId: "studio-list-1",
                value: { type: "textLiteral", value: "Lucía" },
              },
              {
                type: "setText",
                variableId: "studio-text-1",
                value: { type: "textLiteral", value: "el perro de Ana" },
              },
            ],
            procedures: [
              {
                id: "proc-1-1",
                name: "Baile de Ana",
                params: [{ id: "p1", name: "Cuánto baila Ana" }],
                body: [{ type: "move", steps: 40, stepsFrom: "p1" }],
              },
            ],
          },
        ],
      },
    };
    const sent: string[] = [];
    const offer = await requestStudioOri(
      child,
      service(
        {
          version: ORI_STUDIO_VERSION,
          kind: "program-suggestion",
          actorId: child.actorId,
          block: { type: "turn", degrees: 90 },
        },
        sent,
      ),
    );
    // Nothing the child wrote is in the request...
    for (const word of ["Ana", "secreto", "Lucía", "perro", "Baile", "Cuánto", "Hola"])
      expect(sent[0], word).not.toContain(word);
    // ...the shape is, so the service can do its job...
    expect(sent[0]).toContain("studio-actor-1-nova");
    expect(sent[0]).toContain("listAdd");
    // ...and the idea that came back is for the child's own program, not the redacted one.
    expect(offer.proposal?.operations[0]).toMatchObject({
      statement: { type: "turn", degrees: 90 },
    });
    expect(offer.proposal?.baseProgramHash).not.toBe(
      evaluateOriStudioOutput({ ...child, program: redactProgramForOri(child.program) }, undefined)
        .proposal!.baseProgramHash,
    );
  });

  it("does not use an idea that was made for some other program", async () => {
    const other = evaluateOriStudioOutput(
      { ...context, program: { ...redactProgramForOri(context.program), extensions: ["pen"] } },
      undefined,
    ).proposal!;
    const wrongBase = async () =>
      new Response(JSON.stringify({ message: "x", proposal: other }), { status: 200 });
    const offer = await requestStudioOri(context, wrongBase as typeof fetch);
    // The local reviewable idea is used instead.
    expect(offer.proposal?.operations).toHaveLength(1);
    expect(offer.proposal?.baseProgramHash).not.toBe(other.baseProgramHash);
  });
});
