import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  PACKAGE_NAME,
  PROGRAM_PROPOSAL_SCHEMA_VERSION,
  ProposalValidationError,
  acceptProposal,
  createProgramProposal,
  createProposalReview,
  createStudioProposalDiffView,
  createWebProposalCardView,
  modifyProposal,
  parseProgramProposal,
  programSemanticHash,
  rejectProposal,
  type ProgramProposal,
} from "./index.js";

const acceptedProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 160 }],
    },
  ],
};

function turnProposal(): ProgramProposal {
  return createProgramProposal({
    id: "proposal-turn-after-move",
    baseProgram: acceptedProgram,
    source: { kind: "learning-companion", capability: "program-proposal" },
    purpose: "Add a turn after the move.",
    rationale: "This may help the learner explore direction after reaching the beacon.",
    affectedNodeIds: ["scripts[0]/statements[1]"],
    operations: [
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "turn", degrees: 90 },
      },
    ],
  });
}

describe("proposal package", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/proposals");
  });

  it("creates a versioned proposal without mutating accepted program", () => {
    const before = structuredClone(acceptedProgram);
    const proposal = turnProposal();

    expect(proposal.schema).toBe(PROGRAM_PROPOSAL_SCHEMA_VERSION);
    expect(proposal.baseProgramHash).toBe(programSemanticHash(acceptedProgram));
    expect(acceptedProgram).toEqual(before);
  });

  it("rejects malformed provider response and provider-specific fields", () => {
    expect(() => parseProgramProposal({ id: "missing-schema" })).toThrow(ProposalValidationError);
    expect(() => parseProgramProposal({ ...turnProposal(), openAiThreadId: "thread-1" })).toThrow(
      ProposalValidationError,
    );
  });

  it("renders deterministic preview and diff from structured state", () => {
    const review = createProposalReview(acceptedProgram, turnProposal());

    expect(review.acceptedProjection.code).not.toContain("sprite.turn(90);");
    expect(review.proposedProjection.code).toContain("sprite.turn(90);");
    expect(review.diff).toEqual([
      {
        nodeId: "scripts[0]/statements[1]",
        kind: "added",
        afterText: "  sprite.turn(90);\n",
      },
    ]);
    expect(review.affectedRanges).toEqual([
      review.proposedProjection.mapping["scripts[0]/statements[1]"],
    ]);
  });

  it("reject preserves exact canonical hash and state", () => {
    const review = createProposalReview(acceptedProgram, turnProposal());
    const rejected = rejectProposal(acceptedProgram, review);

    expect(rejected.program).toEqual(acceptedProgram);
    expect(programSemanticHash(rejected.program)).toBe(programSemanticHash(acceptedProgram));
    expect(rejected.audit.decision).toBe("reject");
  });

  it("accept applies only the validated candidate program", () => {
    const review = createProposalReview(acceptedProgram, turnProposal());
    const accepted = acceptProposal(acceptedProgram, review);

    expect(accepted.program.scripts[0]?.statements).toEqual([
      { type: "move", steps: 160 },
      { type: "turn", degrees: 90 },
    ]);
    expect(accepted.audit.decision).toBe("accept");
  });

  it("modify validates a learner-reviewed candidate before commit", () => {
    const review = createProposalReview(acceptedProgram, turnProposal());
    const learnerReviewed: ProjectProgram = {
      ...acceptedProgram,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "move", steps: 160 },
            { type: "turn", degrees: 45 },
          ],
        },
      ],
    };

    const modified = modifyProposal(acceptedProgram, review, learnerReviewed);

    expect(modified.program).toEqual(learnerReviewed);
    expect(modified.audit.decision).toBe("modify");
  });

  it("stale proposal against changed base cannot apply silently", () => {
    const proposal = turnProposal();
    const changedProgram: ProjectProgram = {
      ...acceptedProgram,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 100 }],
        },
      ],
    };

    expect(() => createProposalReview(changedProgram, proposal)).toThrow(/STALE_PROPOSAL/);
  });

  it("fails closed for unknown operations and invalid candidates", () => {
    const unknown = {
      ...turnProposal(),
      operations: [{ type: "executeJavascript", source: "alert(1)" }],
    } as unknown as ProgramProposal;
    const invalid = createProgramProposal({
      id: "invalid-move",
      baseProgram: acceptedProgram,
      source: { kind: "deterministic-scaffold" },
      purpose: "Try an invalid move.",
      rationale: "The validator should reject this.",
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 10_000,
        },
      ],
    });

    expect(() => createProposalReview(acceptedProgram, unknown)).toThrow(/UNKNOWN_OPERATION/);
    expect(() => createProposalReview(acceptedProgram, invalid)).toThrow(/INVALID_CANDIDATE/);
  });

  it("same fixture renders Web card and Studio diff with shared semantics", () => {
    const review = createProposalReview(acceptedProgram, turnProposal());
    const web = createWebProposalCardView(review);
    const studio = createStudioProposalDiffView(review);

    expect(web.proposalId).toBe(studio.proposalId);
    expect(web.actions.map((action) => action.id)).toEqual(["accept", "modify", "reject"]);
    expect(web.actions.every((action) => action.minTouchTargetPx === 44)).toBe(true);
    expect(studio.proposedCode).toContain("sprite.turn(90);");
    expect(studio.affectedRanges).toEqual(review.affectedRanges);
  });

  it("audit event is serializable and contains no child PII or provider SDK fields", () => {
    const review = createProposalReview(acceptedProgram, turnProposal());
    const accepted = acceptProposal(acceptedProgram, review);
    const serialized = JSON.stringify(accepted.audit);

    expect(JSON.parse(serialized)).toEqual(accepted.audit);
    expect(serialized).not.toMatch(/email|school|address|name|age|openAi|anthropic|thread/i);
  });
});
