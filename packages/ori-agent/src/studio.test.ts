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
});
