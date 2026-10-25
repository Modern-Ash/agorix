import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "@agorix/program-model";
import {
  createOriStudioInput,
  evaluateOriStudioOutput,
  ORI_STUDIO_VERSION,
  runOriStudio,
  validateOriStudioProposal,
  type OriStudioContext,
} from "./studio.js";

const context: OriStudioContext = {
  actorId: "actor:studio-2-mika",
  locale: "es" as const,
  program: {
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "studio-actor-1-nova",
        trigger: { type: "greenFlag" as const },
        statements: [{ type: "say" as const, text: "Mi secreto" }],
      },
      { id: "studio-actor-2-mika", trigger: { type: "onActorClicked" as const }, statements: [] },
    ],
  },
};

describe("Ori free scene contract", () => {
  it("sends only structure to the model and scopes a real proposal to the selected actor", async () => {
    const input = createOriStudioInput(context);
    expect(JSON.stringify(input)).not.toContain("Mi secreto");
    const decision = await runOriStudio(context, {
      generate: async () =>
        JSON.stringify({
          version: ORI_STUDIO_VERSION,
          kind: "program-suggestion",
          actorId: context.actorId,
          block: { type: "turn", degrees: -90 },
        }),
    });
    expect(decision.source).toBe("model");
    expect(decision.proposal?.operations[0]).toMatchObject({
      type: "appendStatement",
      scriptIndex: 1,
      statement: { type: "turn", degrees: -90 },
    });
    expect(
      validateOriStudioProposal(context, decision.proposal).candidateProgram.scripts[0],
    ).toEqual(context.program.scripts[0]);
  });

  it("falls back safely for wrong actor, extra keys, provider failure and forged proposal", async () => {
    const wrong = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: "actor:studio-1-nova",
      block: { type: "move", steps: 40 },
    });
    expect(wrong.source).toBe("fallback");
    const extra = evaluateOriStudioOutput(context, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: context.actorId,
      block: { type: "move", steps: 40, evil: true },
    });
    expect(extra.source).toBe("fallback");
    expect(
      (
        await runOriStudio(context, {
          generate: () => {
            throw new Error("offline");
          },
        })
      ).source,
    ).toBe("fallback");
    expect(() =>
      validateOriStudioProposal(context, {
        ...wrong.proposal,
        affectedActorIds: ["actor:studio-1-nova"],
      }),
    ).toThrow();
  });

  it("keeps a data-rich keyed scene reviewable without sending learner names to the model", () => {
    const expanded: OriStudioContext = {
      ...context,
      program: {
        ...context.program,
        variables: [{ id: "studio-var-1", name: "Mi secreto", initialValue: 0, visible: true }],
        lists: [{ id: "studio-list-1", name: "Cosas privadas", initialItems: [], visible: true }],
        scripts: [
          context.program.scripts[0]!,
          {
            id: "studio-actor-2-mika",
            trigger: { type: "onKeyPressed", key: "Space" },
            statements: [
              {
                type: "setVariable",
                variableId: "studio-var-1",
                value: { type: "numericLiteral", value: 2 },
              },
            ],
          },
        ],
      },
    };
    expect(JSON.stringify(createOriStudioInput(expanded))).not.toMatch(
      /Mi secreto|Cosas privadas|studio-var-1/,
    );
    const decision = evaluateOriStudioOutput(expanded, {
      version: ORI_STUDIO_VERSION,
      kind: "program-suggestion",
      actorId: expanded.actorId,
      block: { type: "move", steps: 40 },
    });
    expect(decision.source).toBe("model");
    expect(
      validateOriStudioProposal(expanded, decision.proposal).candidateProgram.variables,
    ).toEqual(expanded.program.variables);
  });

  describe("reusing the child's own blocks (Mis bloques, #538 slice 4)", () => {
    const withBlocks: OriStudioContext = {
      ...context,
      program: {
        ...context.program,
        scripts: [
          {
            id: "studio-actor-1-nova",
            trigger: { type: "greenFlag" as const },
            statements: [{ type: "say" as const, text: "Mi secreto" }],
            procedures: [
              {
                id: "proc-1-1",
                name: "Bloque de Nova",
                body: [{ type: "move" as const, steps: 40 }],
              },
            ],
          },
          {
            id: "studio-actor-2-mika",
            trigger: { type: "onActorClicked" as const },
            statements: [],
            procedures: [
              {
                id: "proc-2-1",
                name: "Mi baile secreto",
                body: [
                  { type: "move" as const, steps: 40 },
                  { type: "turn" as const, degrees: 90 },
                ],
              },
              { id: "proc-2-2", name: "Salto", body: [{ type: "turn" as const, degrees: -90 }] },
            ],
          },
        ],
      },
    };
    const suggest = (block: Record<string, unknown>, ctx = withBlocks) =>
      evaluateOriStudioOutput(ctx, {
        version: ORI_STUDIO_VERSION,
        kind: "program-suggestion",
        actorId: ctx.actorId,
        block,
      });

    it("sends block ids and the kinds of blocks inside, never a title or the child's text", () => {
      const input = createOriStudioInput(withBlocks);
      expect(input.procedures).toEqual([
        { id: "proc-2-1", blocks: ["move", "turn"] },
        { id: "proc-2-2", blocks: ["turn"] },
      ]);
      expect(input.allowedBlocks).toContainEqual({
        type: "callProcedure",
        procedureId: "proc-2-1",
      });
      const text = JSON.stringify(input);
      expect(text).not.toMatch(/Mi baile secreto|Salto|Bloque de Nova|Mi secreto|proc-1-1/);
    });

    it("never offers a block with numbers, because Ori cannot choose the child's values", () => {
      const numbered = {
        ...withBlocks,
        program: {
          ...withBlocks.program,
          scripts: withBlocks.program.scripts.map((script, index) =>
            index === 1
              ? {
                  ...script,
                  procedures: [
                    ...(script.procedures ?? []),
                    {
                      id: "proc-2-3",
                      name: "Con largo",
                      params: [{ id: "p1" as const, name: "Largo" }],
                      body: [{ type: "move" as const, steps: 40, stepsFrom: "p1" as const }],
                    },
                  ],
                }
              : script,
          ),
        },
      };
      const input = createOriStudioInput(numbered);
      expect(input.procedures.map((item) => item.id)).toEqual(["proc-2-1", "proc-2-2"]);
      expect(JSON.stringify(input)).not.toMatch(/proc-2-3|Largo|Con largo/);
      expect(suggest({ type: "callProcedure", procedureId: "proc-2-3" }, numbered).source).not.toBe(
        "model",
      );
    });

    it("turns a valid reuse into one reviewable proposal that changes nothing by itself", () => {
      const decision = suggest({ type: "callProcedure", procedureId: "proc-2-2" });
      expect(decision.source).toBe("model");
      expect(decision.proposal?.operations[0]).toMatchObject({
        type: "appendStatement",
        scriptIndex: 1,
        statement: { type: "callProcedure", procedureId: "proc-2-2" },
      });
      const review = validateOriStudioProposal(withBlocks, decision.proposal);
      expect(review.candidateProgram.scripts[1]?.statements).toEqual([
        { type: "callProcedure", procedureId: "proc-2-2" },
      ]);
      expect(withBlocks.program.scripts[1]?.statements).toEqual([]);
      expect(review.candidateProgram.scripts[1]?.procedures).toEqual(
        withBlocks.program.scripts[1]?.procedures,
      );
    });

    it("rejects an unknown block, another character's block, extra keys and a made-up kind", () => {
      for (const block of [
        { type: "callProcedure", procedureId: "proc-2-9" },
        { type: "callProcedure", procedureId: "proc-1-1" },
        { type: "callProcedure", procedureId: "../etc" },
        { type: "callProcedure", procedureId: 5 },
        { type: "callProcedure", procedureId: "proc-2-1", name: "Mi baile secreto" },
        { type: "callProcedure" },
        { type: "defineProcedure", procedureId: "proc-2-3", body: [] },
      ]) {
        expect(suggest(block).source, JSON.stringify(block)).toBe("fallback");
      }
    });

    it("cannot reuse a block when the character has none, and the no-AI path is unchanged", () => {
      expect(suggest({ type: "callProcedure", procedureId: "proc-2-1" }, context).source).toBe(
        "fallback",
      );
      const fallback = evaluateOriStudioOutput(withBlocks, undefined);
      expect(fallback.source).toBe("fallback");
      expect(fallback.proposal?.operations[0]).toMatchObject({
        statement: { type: "move", steps: 40 },
      });
    });

    it("a forged proposal that calls a missing or foreign block is refused", () => {
      const good = suggest({ type: "callProcedure", procedureId: "proc-2-1" });
      const forge = (procedureId: string) => ({
        ...good.proposal!,
        operations: [
          {
            type: "appendStatement",
            scriptIndex: 1,
            statement: { type: "callProcedure", procedureId },
          },
        ],
      });
      expect(() => validateOriStudioProposal(withBlocks, forge("proc-1-1"))).toThrow();
      expect(() => validateOriStudioProposal(withBlocks, forge("proc-2-7"))).toThrow();
      expect(() => validateOriStudioProposal(withBlocks, forge("proc-2-2"))).not.toThrow();
    });

    it("the model contract tells Ori how to reuse a block and that it cannot make one", async () => {
      let seenInstructions = "";
      let seenInput = "";
      await runOriStudio(withBlocks, {
        generate: async (instructions: string, input: string) => {
          seenInstructions = instructions;
          seenInput = input;
          return JSON.stringify({
            version: ORI_STUDIO_VERSION,
            kind: "program-suggestion",
            actorId: withBlocks.actorId,
            block: { type: "callProcedure", procedureId: "proc-2-1" },
          });
        },
      });
      expect(seenInstructions).toContain("callProcedure");
      expect(seenInstructions).toContain("input.procedures");
      expect(seenInput).not.toMatch(/Mi baile secreto/);
    });
  });
});
