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

const twoStepProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "move", steps: 160 },
        { type: "turn", degrees: 90 },
      ],
    },
  ],
};

const nestedProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "repeat", count: 2, body: [{ type: "move", steps: 40 }] },
        { type: "move", steps: 160 },
      ],
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

function changeProposal(): ProgramProposal {
  return createProgramProposal({
    id: "proposal-change-move",
    baseProgram: acceptedProgram,
    source: { kind: "learning-companion", capability: "program-proposal" },
    purpose: "Change the move distance.",
    rationale: "The sprite is still far from the beacon after the first run.",
    affectedNodeIds: ["scripts[0]/statements[0]"],
    operations: [
      {
        type: "replaceStatement",
        nodeId: "scripts[0]/statements[0]",
        statement: { type: "move", steps: 220 },
      },
    ],
  });
}

function removeProposal(): ProgramProposal {
  return createProgramProposal({
    id: "proposal-remove-turn",
    baseProgram: twoStepProgram,
    source: { kind: "learning-companion", capability: "program-proposal" },
    purpose: "Remove the extra turn.",
    rationale: "A single move already reaches the beacon.",
    affectedNodeIds: ["scripts[0]/statements[1]"],
    operations: [{ type: "removeStatement", nodeId: "scripts[0]/statements[1]" }],
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

  it("covers insert, change and remove with deterministic diff kinds", () => {
    const inserted = createProposalReview(acceptedProgram, turnProposal());
    const changed = createProposalReview(acceptedProgram, changeProposal());
    const removed = createProposalReview(twoStepProgram, removeProposal());

    expect(inserted.diff.map((entry) => entry.kind)).toEqual(["added"]);
    expect(changed.diff).toEqual([
      {
        nodeId: "scripts[0]/statements[0]",
        kind: "changed",
        beforeText: "  sprite.move(160);\n",
        afterText: "  sprite.move(220);\n",
      },
    ]);
    expect(removed.diff).toEqual([
      {
        nodeId: "scripts[0]/statements[1]",
        kind: "removed",
        beforeText: "  sprite.turn(90);\n",
      },
    ]);
  });

  it("accept commits exactly the previewed candidate for change and remove", () => {
    const changed = createProposalReview(acceptedProgram, changeProposal());
    const removed = createProposalReview(twoStepProgram, removeProposal());

    expect(acceptProposal(acceptedProgram, changed).program).toEqual(changed.candidateProgram);
    expect(acceptProposal(twoStepProgram, removed).program).toEqual(removed.candidateProgram);
    expect(acceptProposal(twoStepProgram, removed).program.scripts[0]?.statements).toEqual([
      { type: "move", steps: 160 },
    ]);
  });

  it("derives the same diff and candidate regardless of model prose or review order", () => {
    const proposal = changeProposal();
    const terseProse = createProgramProposal({
      id: proposal.id,
      baseProgram: acceptedProgram,
      source: proposal.source,
      purpose: "tune the move",
      rationale: "r",
      affectedNodeIds: proposal.affectedNodeIds,
      operations: proposal.operations,
    });

    const first = createProposalReview(acceptedProgram, proposal);
    const second = createProposalReview(acceptedProgram, terseProse);
    const third = createProposalReview(acceptedProgram, proposal);

    expect(second.proposal.purpose).not.toBe(first.proposal.purpose);
    expect(second.diff).toEqual(first.diff);
    expect(second.proposedProjection.code).toBe(first.proposedProjection.code);
    expect(second.candidateProgram).toEqual(first.candidateProgram);
    expect(JSON.stringify(third.diff)).toBe(JSON.stringify(first.diff));
    expect(programSemanticHash(third.candidateProgram)).toBe(
      programSemanticHash(first.candidateProgram),
    );
  });

  it("rejects unexpected and provider-specific fields inside operations", () => {
    const providerField = {
      ...turnProposal(),
      operations: [
        {
          type: "appendStatement",
          scriptIndex: 0,
          statement: { type: "turn", degrees: 90 },
          openAiThreadId: "thread-1",
        },
      ],
    } as unknown as ProgramProposal;
    const codePayload = {
      ...turnProposal(),
      operations: [
        {
          type: "replaceStatement",
          nodeId: "scripts[0]/statements[0]",
          statement: { type: "move", steps: 160 },
          source: "alert(1)",
        },
      ],
    } as unknown as ProgramProposal;

    expect(() => parseProgramProposal(providerField)).toThrow(/INVALID_PROPOSAL/);
    expect(() => parseProgramProposal(codePayload)).toThrow(/INVALID_PROPOSAL/);
  });

  it("applies nested statement paths and fails closed on unsupported paths", () => {
    const nestedChange = createProgramProposal({
      id: "proposal-nested-repeat",
      baseProgram: nestedProgram,
      source: { kind: "deterministic-scaffold" },
      purpose: "Lengthen the repeated move.",
      rationale: "The repeat stops short of the beacon.",
      affectedNodeIds: ["scripts[0]/statements[0]/body[0]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]/body[0]",
          field: "steps",
          value: 60,
        },
      ],
    });
    const unsupportedPath = createProgramProposal({
      id: "proposal-unsupported-path",
      baseProgram: nestedProgram,
      source: { kind: "deterministic-scaffold" },
      purpose: "Target a segment the program does not have.",
      rationale: "The protocol must fail closed.",
      affectedNodeIds: ["scripts[0]/statements[0]/else[0]"],
      operations: [{ type: "removeStatement", nodeId: "scripts[0]/statements[0]/else[0]" }],
    });

    expect(createProposalReview(nestedProgram, nestedChange).diff).toEqual([
      {
        nodeId: "scripts[0]/statements[0]/body[0]",
        kind: "changed",
        beforeText: "    sprite.move(40);\n",
        afterText: "    sprite.move(60);\n",
      },
    ]);
    expect(() => createProposalReview(nestedProgram, unsupportedPath)).toThrow(/UNSUPPORTED_PATH/);
  });

  it("round-trips the proposal itself through JSON without PII or provider identity", () => {
    const proposal = changeProposal();
    const serialized = JSON.stringify(proposal);

    expect(parseProgramProposal(JSON.parse(serialized))).toEqual(proposal);
    expect(serialized).not.toMatch(/email|school|address|name|age|openAi|anthropic|thread/i);
  });
});
