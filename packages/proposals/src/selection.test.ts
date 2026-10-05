import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import {
  ProposalValidationError,
  acceptProposal,
  createFirstStepProposal,
  createProposalReview,
  createRepeatPatternProposal,
  modifyProposal,
  operationEditable,
  resolveOperationTargets,
  selectProposalOperations,
} from "./index.js";

const move = (steps: number): Statement => ({ type: "move", steps });
const turn = (degrees: number): Statement => ({ type: "turn", degrees });
const program = (...statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const text = { id: "p1", purpose: "Shorter", rationale: "You repeated this." };
const base = program(move(20), turn(90), move(20), turn(90), move(20), turn(90), move(5));

describe("selectProposalOperations", () => {
  const proposal = createRepeatPatternProposal({ ...text, baseProgram: base })!;

  it("keeps the base hash, narrows operations and gives the derived proposal its own id", () => {
    const derived = selectProposalOperations(proposal, { include: [0, 1] })!;
    expect(derived.baseProgramHash).toBe(proposal.baseProgramHash);
    expect(derived.operations).toEqual([proposal.operations[0], proposal.operations[1]]);
    expect(derived.id).toBe("p1:selection");
  });

  it("returns undefined for an empty selection and ignores unknown or duplicate indexes", () => {
    expect(selectProposalOperations(proposal, { include: [] })).toBeUndefined();
    expect(selectProposalOperations(proposal, { include: [99] })).toBeUndefined();
    const derived = selectProposalOperations(proposal, { include: [1, 1, 0] })!;
    expect(derived.operations).toHaveLength(2);
    expect(derived.operations[0]).toEqual(proposal.operations[0]);
  });

  it("applies a numeric override to an editable field and refuses bad overrides", () => {
    const first = createFirstStepProposal({ ...text, baseProgram: program() })!;
    const derived = selectProposalOperations(first, {
      include: [0],
      overrides: [{ index: 0, value: 7 }],
    })!;
    expect(derived.operations[0]).toEqual({
      type: "appendStatement",
      scriptIndex: 0,
      statement: move(7),
    });
    expect(() =>
      selectProposalOperations(first, { include: [0], overrides: [{ index: 0, value: 1.5 }] }),
    ).toThrow(ProposalValidationError);
    expect(() =>
      selectProposalOperations(first, { include: [], overrides: [{ index: 0, value: 7 }] }),
    ).not.toThrow();
    expect(() =>
      selectProposalOperations(proposal, { include: [1], overrides: [{ index: 1, value: 3 }] }),
    ).toThrow(ProposalValidationError);
  });

  it("produces a reviewable proposal whose acceptance is one transaction", () => {
    const derived = selectProposalOperations(proposal, {
      include: [0, 1, 2, 3, 4, 5],
      overrides: [{ index: 0, value: 5 }],
    })!;
    const review = createProposalReview(base, derived);
    expect(acceptProposal(base, review).program.scripts[0]?.statements[0]).toMatchObject({
      type: "repeat",
      count: 5,
    });
    const modified = modifyProposal(base, review, review.candidateProgram);
    expect(modified.audit.decision).toBe("modify");
  });

  it("leaves a program invalid when only part of a grouped change is selected", () => {
    const first = createFirstStepProposal({ ...text, baseProgram: program() })!;
    const derived = selectProposalOperations(first, {
      include: [0],
      overrides: [{ index: 0, value: 100000 }],
    })!;
    expect(() => createProposalReview(program(), derived)).toThrow(ProposalValidationError);
  });
});

describe("operationEditable", () => {
  it("reports the editable numeric field of an operation", () => {
    const first = createFirstStepProposal({ ...text, baseProgram: program() })!;
    expect(operationEditable(first.operations[0]!)).toEqual({ field: "steps", value: 10 });
    const repeat = createRepeatPatternProposal({ ...text, baseProgram: base })!;
    expect(operationEditable(repeat.operations[0]!)).toEqual({ field: "count", value: 3 });
    expect(operationEditable(repeat.operations[1]!)).toBeUndefined();
  });
});

describe("resolveOperationTargets", () => {
  it("maps repeated removals to the original nodes they remove", () => {
    const proposal = createRepeatPatternProposal({ ...text, baseProgram: base })!;
    expect(resolveOperationTargets(base, proposal)).toEqual([
      "scripts[0]/statements[0]",
      "scripts[0]/statements[1]",
      "scripts[0]/statements[2]",
      "scripts[0]/statements[3]",
      "scripts[0]/statements[4]",
      "scripts[0]/statements[5]",
    ]);
  });

  it("has no original node for an append", () => {
    const first = createFirstStepProposal({ ...text, baseProgram: program() })!;
    expect(resolveOperationTargets(program(), first)).toEqual([undefined]);
  });
});
