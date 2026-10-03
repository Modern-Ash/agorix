import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { runProgram } from "@agorix/runtime";
import {
  acceptProposal,
  createProposalReview,
  createRepeatPatternProposal,
  detectRepeatPattern,
  programSemanticHash,
  rejectProposal,
} from "./index.js";

const move = (steps: number): Statement => ({ type: "move", steps });
const turn = (degrees: number): Statement => ({ type: "turn", degrees });
const program = (...statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const text = { id: "p1", purpose: "Shorter", rationale: "You repeated this." };

describe("detectRepeatPattern", () => {
  it("finds a two-statement block repeated four times", () => {
    const pattern = detectRepeatPattern(
      program(...Array.from({ length: 4 }, () => [move(20), turn(90)]).flat()),
    );
    expect(pattern).toMatchObject({ scriptIndex: 0, startIndex: 0, period: 2, count: 4 });
    expect(pattern?.body).toEqual([move(20), turn(90)]);
  });

  it("finds a single statement repeated three times after a prefix", () => {
    expect(detectRepeatPattern(program(turn(10), move(5), move(5), move(5)))).toMatchObject({
      startIndex: 1,
      period: 1,
      count: 3,
    });
  });

  it.each([
    ["empty", program()],
    ["only two repetitions", program(move(20), turn(90), move(20), turn(90))],
    ["similar but different values", program(move(20), move(21), move(20))],
    ["already a repeat", program({ type: "repeat", count: 4, body: [move(20), turn(90)] })],
  ])("returns undefined for %s", (_name, input) => {
    expect(detectRepeatPattern(input)).toBeUndefined();
  });
});

describe("createRepeatPatternProposal", () => {
  const base = program(move(20), turn(90), move(20), turn(90), move(20), turn(90), move(5));

  it("returns undefined without a pattern", () => {
    expect(createRepeatPatternProposal({ ...text, baseProgram: program(move(1)) })).toBeUndefined();
  });

  it("does not mutate the base program until accepted, and reject keeps it unchanged", () => {
    const hash = programSemanticHash(base);
    const proposal = createRepeatPatternProposal({ ...text, baseProgram: base });
    expect(proposal).toBeDefined();
    const review = createProposalReview(base, proposal!);
    expect(programSemanticHash(base)).toBe(hash);
    rejectProposal(base, review);
    expect(programSemanticHash(base)).toBe(hash);
  });

  it("accepting yields repeat and runs equivalently to the original", () => {
    const proposal = createRepeatPatternProposal({ ...text, baseProgram: base })!;
    const accepted = acceptProposal(base, createProposalReview(base, proposal)).program;
    expect(accepted.scripts[0]?.statements).toEqual([
      { type: "repeat", count: 3, body: [move(20), turn(90)] },
      move(5),
    ]);
    const world = { sprite: { x: 0, y: 0, heading: 0 }, goal: { x: 50, y: 50 } };
    const before = runProgram(base, world, {});
    const after = runProgram(accepted, world, {});
    expect(after.world).toEqual(before.world);
  });
});
