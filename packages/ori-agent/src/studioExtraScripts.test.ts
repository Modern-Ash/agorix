import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { acceptProposal } from "@agorix/proposals";
import {
  createOriStudioInput,
  evaluateOriStudioOutput,
  proposeOriStudioIntent,
  validateOriStudioIntentProposal,
} from "./studio.js";

// #1363: a character may have up to two more scripts. Ori must keep working in such a scene.
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "studio-actor-1-nova",
      trigger: { type: "greenFlag" },
      statements: [{ type: "move", steps: 40 }],
    },
    {
      id: "studio-actor-2-mika",
      trigger: { type: "greenFlag" },
      statements: [],
    },
    {
      id: "studio-actor-1-nova-s2",
      trigger: { type: "onKeyPressed", key: "ArrowRight" },
      statements: [{ type: "move", steps: 20 }],
    },
    {
      id: "studio-actor-1-nova-s3",
      trigger: { type: "onKeyPressed", key: "ArrowLeft" },
      statements: [],
    },
  ],
};
const context = { actorId: "actor:studio-1-nova", locale: "es" as const, program };

describe("Ori in a scene where a character has more than one script (#1363)", () => {
  it("still reads the scene and proposes for the character's first script", () => {
    expect(createOriStudioInput(context).selectedBlocks).toEqual(["move"]);
    const proposal = proposeOriStudioIntent(context, "jump");
    const review = validateOriStudioIntentProposal(context, proposal);
    const accepted = acceptProposal(program, review).program;
    // The idea went to the first script; the extra scripts are untouched.
    expect(accepted.scripts[0]!.statements.length).toBeGreaterThan(1);
    expect(accepted.scripts[2]).toEqual(program.scripts[2]);
    expect(accepted.scripts[3]).toEqual(program.scripts[3]);
  });

  it("gives the offline idea too, with a proposal that only appends to the first script", () => {
    const decision = evaluateOriStudioOutput(context, undefined);
    expect(decision.proposal).toBeDefined();
    expect(decision.proposal!.affectedScriptIds).toEqual(["studio-actor-1-nova"]);
  });

  it("proposes for a character that has no extra script, in the same scene", () => {
    const proposal = proposeOriStudioIntent({ ...context, actorId: "actor:studio-2-mika" }, "jump");
    const review = validateOriStudioIntentProposal(
      { ...context, actorId: "actor:studio-2-mika" },
      proposal,
    );
    expect(acceptProposal(program, review).program.scripts[1]!.statements.length).toBeGreaterThan(
      0,
    );
  });
});

describe("Ori on the script the child has open (#1363)", () => {
  const second = { ...context, scriptId: "studio-actor-1-nova-s2" };

  it("proposes for that script and leaves the others alone", () => {
    const proposal = proposeOriStudioIntent(second, "jump");
    expect(proposal.affectedScriptIds).toEqual(["studio-actor-1-nova-s2"]);
    const review = validateOriStudioIntentProposal(second, proposal);
    const accepted = acceptProposal(program, review).program;
    expect(accepted.scripts[2]!.statements.length).toBeGreaterThan(1);
    expect(accepted.scripts[0]).toEqual(program.scripts[0]);
    expect(accepted.scripts[3]).toEqual(program.scripts[3]);
  });

  it("reads that script's blocks, not the first one's", () => {
    expect(createOriStudioInput(second).selectedBlocks).toEqual(["move"]);
    expect(
      createOriStudioInput({ ...second, scriptId: "studio-actor-1-nova-s3" }).selectedBlocks,
    ).toEqual([]);
  });

  it("refuses a script that is another character's, the copy script, or unknown", () => {
    expect(() =>
      proposeOriStudioIntent({ ...second, actorId: "actor:studio-2-mika" }, "jump"),
    ).toThrow();
    expect(() =>
      proposeOriStudioIntent({ ...context, scriptId: "studio-actor-1-nova-clone" }, "jump"),
    ).toThrow();
    expect(() => proposeOriStudioIntent({ ...context, scriptId: "nope" }, "jump")).toThrow();
  });

  it("keeps the ideas that bring a copy script for the first script only", () => {
    expect(() => proposeOriStudioIntent(second, "rainFalls")).toThrow();
    expect(() => proposeOriStudioIntent(context, "rainFalls")).not.toThrow();
  });
});

describe("what Ori's model is given never holds a child's words (design: word lists)", () => {
  it("is built from block kinds and closed choices only", () => {
    const withWords: ProjectProgram = {
      schema: SCHEMA_VERSION,
      lists: [{ id: "l", name: "Compras", initialItems: [], visible: true }],
      scripts: [
        {
          id: "studio-actor-1-nova",
          trigger: { type: "greenFlag" },
          statements: [
            { type: "listAdd", listId: "l", value: { type: "textLiteral", value: "secretito" } },
            { type: "say", text: "mi secreto", seconds: 2 },
          ],
        },
      ],
    };
    const input = JSON.stringify(
      createOriStudioInput({ actorId: "actor:studio-1-nova", locale: "es", program: withWords }),
    );
    expect(input).not.toContain("secretito");
    expect(input).not.toContain("mi secreto");
    expect(input).not.toContain("Compras");
  });
});
