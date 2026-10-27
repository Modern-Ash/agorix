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
    const numbered: OriStudioContext = {
      ...withBlocks,
      program: {
        ...withBlocks.program,
        scripts: withBlocks.program.scripts.map((script, index) =>
          index === 1
            ? {
                ...script,
                statements: [
                  {
                    type: "callProcedure" as const,
                    procedureId: "proc-2-3",
                    args: [{ type: "numericLiteral" as const, value: 37 }],
                  },
                ],
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
        { id: "proc-2-1", blocks: ["move", "turn"], numbers: [] },
        { id: "proc-2-2", blocks: ["turn"], numbers: [] },
      ]);
      expect(input.allowedBlocks).toContainEqual({
        type: "callProcedure",
        procedureId: "proc-2-1",
      });
      const text = JSON.stringify(input);
      expect(text).not.toMatch(/Mi baile secreto|Salto|Bloque de Nova|Mi secreto|proc-1-1/);
    });

    it("offers a block with numbers through closed choices, never a title or a chosen value", () => {
      const input = createOriStudioInput(numbered);
      expect(input.procedures).toContainEqual({
        id: "proc-2-3",
        blocks: ["move"],
        numbers: [
          {
            unit: "steps",
            choices: [-200, -100, -60, -40, -20, 20, 40, 60, 100, 200],
          },
        ],
      });
      expect(JSON.stringify(input)).not.toMatch(/Largo|Con largo/);
      // The child's current value is 37; only the closed choices are shared.
      expect(JSON.stringify(input)).not.toContain("37");
    });

    it("turns a numbered reuse into one reviewable proposal with the chosen values", () => {
      const decision = suggest(
        { type: "callProcedure", procedureId: "proc-2-3", args: [100] },
        numbered,
      );
      expect(decision.source).toBe("model");
      expect(decision.proposal?.operations[0]).toMatchObject({
        type: "appendStatement",
        scriptIndex: 1,
        statement: {
          type: "callProcedure",
          procedureId: "proc-2-3",
          args: [{ type: "numericLiteral", value: 100 }],
        },
      });
      const review = validateOriStudioProposal(numbered, decision.proposal);
      expect(review.candidateProgram.scripts[1]?.statements.at(-1)).toEqual({
        type: "callProcedure",
        procedureId: "proc-2-3",
        args: [{ type: "numericLiteral", value: 100 }],
      });
      expect(numbered.program.scripts[1]?.statements).toHaveLength(1);
    });

    it("rejects missing, extra, wrong-unit and non-numeric arguments for a numbered block", () => {
      for (const block of [
        { type: "callProcedure", procedureId: "proc-2-3" },
        { type: "callProcedure", procedureId: "proc-2-3", args: [] },
        { type: "callProcedure", procedureId: "proc-2-3", args: [45] },
        { type: "callProcedure", procedureId: "proc-2-3", args: ["100"] },
        { type: "callProcedure", procedureId: "proc-2-3", args: [{ type: "numericLiteral" }] },
        { type: "callProcedure", procedureId: "proc-2-3", args: [100, 40] },
        { type: "callProcedure", procedureId: "proc-2-3", args: [100], name: "Con largo" },
        { type: "callProcedure", procedureId: "proc-2-3", args: null },
      ]) {
        expect(suggest(block, numbered).source, JSON.stringify(block)).toBe("fallback");
      }
      // An unnumbered block must not grow an args key.
      expect(
        suggest({ type: "callProcedure", procedureId: "proc-2-2", args: [40] }, numbered).source,
      ).toBe("fallback");
    });

    it("a forged numbered proposal is refused by the host allow-list", () => {
      const good = suggest(
        { type: "callProcedure", procedureId: "proc-2-3", args: [100] },
        numbered,
      );
      const forge = (args: unknown) => ({
        ...good.proposal!,
        operations: [
          {
            type: "appendStatement",
            scriptIndex: 1,
            statement: { type: "callProcedure", procedureId: "proc-2-3", args },
          },
        ],
      });
      expect(() =>
        validateOriStudioProposal(numbered, forge([{ type: "numericLiteral", value: 45 }])),
      ).toThrow();
      expect(() =>
        validateOriStudioProposal(numbered, forge([{ type: "param", paramId: "p1" }])),
      ).toThrow();
      expect(() =>
        validateOriStudioProposal(numbered, forge([{ type: "numericLiteral", value: 100 }])),
      ).not.toThrow();
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
      expect(seenInstructions).toContain("args");
      expect(seenInstructions).toContain("numbers");
      expect(seenInstructions).toContain("choices");
      expect(seenInput).not.toMatch(/Mi baile secreto/);
    });
  });
});
