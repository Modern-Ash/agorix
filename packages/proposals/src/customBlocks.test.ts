import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { acceptProposal, createProgramProposal, createProposalReview } from "./index.js";

// Issue #538, Mis bloques slice 4: a proposal may call a block the child already made.
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "studio-actor-1-nova",
      trigger: { type: "greenFlag" },
      statements: [],
      procedures: [{ id: "proc-1-1", name: "Baile", body: [{ type: "move", steps: 40 }] }],
    },
    { id: "studio-actor-2-mika", trigger: { type: "greenFlag" }, statements: [] },
  ],
};

function propose(scriptIndex: number, statement: Statement) {
  return createProgramProposal({
    id: "ori-blocks-test",
    baseProgram: program,
    source: { kind: "learning-companion", capability: "builder" },
    purpose: "Una idea",
    rationale: "Mirala y decidí",
    affectedActorIds: [`actor:studio-${scriptIndex + 1}`],
    affectedScriptIds: [program.scripts[scriptIndex]!.id],
    affectedNodeIds: [`scripts[${scriptIndex}]/statements[0]`],
    operations: [{ type: "appendStatement", scriptIndex, statement }],
  });
}

describe("proposals that use the child's own block", () => {
  it("is accepted for the character that owns the block and changes only that script", () => {
    const proposal = propose(0, { type: "callProcedure", procedureId: "proc-1-1" });
    const review = createProposalReview(program, proposal);
    expect(review.candidateProgram.scripts[0]?.statements).toEqual([
      { type: "callProcedure", procedureId: "proc-1-1" },
    ]);
    expect(review.candidateProgram.scripts[1]).toEqual(program.scripts[1]);
    expect(acceptProposal(program, review).program.scripts[0]?.procedures).toEqual(
      program.scripts[0]?.procedures,
    );
    expect(program.scripts[0]?.statements).toEqual([]);
  });

  it("is refused for a character that does not have that block", () => {
    const proposal = propose(1, { type: "callProcedure", procedureId: "proc-1-1" });
    expect(() => createProposalReview(program, proposal)).toThrow();
  });

  it("is refused for an id nobody defined", () => {
    const proposal = propose(0, { type: "callProcedure", procedureId: "proc-1-9" });
    expect(() => createProposalReview(program, proposal)).toThrow();
  });

  it("accepts a call inside a repeat the same way", () => {
    const proposal = propose(0, {
      type: "repeat",
      count: 2,
      body: [{ type: "callProcedure", procedureId: "proc-1-1" }],
    });
    const review = createProposalReview(program, proposal);
    expect(review.candidateProgram.scripts[0]?.statements[0]).toMatchObject({ type: "repeat" });
  });

  it("accepts a numbered call and checks its arity against the real block", () => {
    const numbered: ProjectProgram = {
      ...program,
      scripts: program.scripts.map((script, index) =>
        index === 0
          ? {
              ...script,
              procedures: [
                {
                  id: "proc-1-1",
                  name: "Paso",
                  params: [{ id: "p1", name: "Largo" }],
                  body: [{ type: "move", steps: 40, stepsFrom: "p1" }],
                },
              ],
            }
          : script,
      ),
    };
    const proposal = createProgramProposal({
      id: "ori-blocks-numbered-test",
      baseProgram: numbered,
      source: { kind: "learning-companion", capability: "builder" },
      purpose: "Una idea",
      rationale: "Mirala y decidí",
      affectedActorIds: ["actor:studio-1"],
      affectedScriptIds: [numbered.scripts[0]!.id],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        {
          type: "appendStatement",
          scriptIndex: 0,
          statement: {
            type: "callProcedure",
            procedureId: "proc-1-1",
            args: [{ type: "numericLiteral", value: 100 }],
          },
        },
      ],
    });
    expect(
      createProposalReview(numbered, proposal).candidateProgram.scripts[0]?.statements[0],
    ).toEqual({
      type: "callProcedure",
      procedureId: "proc-1-1",
      args: [{ type: "numericLiteral", value: 100 }],
    });

    const missing = createProgramProposal({
      id: "ori-blocks-missing-arg",
      baseProgram: numbered,
      source: { kind: "learning-companion", capability: "builder" },
      purpose: "Una idea",
      rationale: "Mirala y decidí",
      affectedActorIds: ["actor:studio-1"],
      affectedScriptIds: [numbered.scripts[0]!.id],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        {
          type: "appendStatement",
          scriptIndex: 0,
          statement: { type: "callProcedure", procedureId: "proc-1-1" },
        },
      ],
    });
    expect(() => createProposalReview(numbered, missing)).toThrow();
  });
});
