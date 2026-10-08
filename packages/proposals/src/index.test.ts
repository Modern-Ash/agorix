import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import {
  PACKAGE_NAME,
  PROGRAM_PROPOSAL_SCHEMA_VERSION,
  ProposalValidationError,
  acceptProposal,
  bindProposalRuntimeEvidence,
  createProposalComparisonView,
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

const multiScriptProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "explorer-script",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 10 }],
    },
    {
      id: "beacon-script",
      trigger: { type: "onMessage", message: "pulse" },
      statements: [{ type: "turn", degrees: 90 }],
    },
  ],
};

const variableProgram: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "score", name: "score", initialValue: 0, visible: true }],
  scripts: [
    {
      id: "score-script",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 10 }],
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

  it("rejects unstable or duplicated proposal scope and evidence ids", () => {
    expect(() =>
      parseProgramProposal({ ...turnProposal(), affectedActorIds: ["actor explorer"] }),
    ).toThrow(/stable id token/);
    expect(() =>
      parseProgramProposal({
        ...turnProposal(),
        affectedScriptIds: ["main", "main"],
      }),
    ).toThrow(/duplicate id/);
    expect(() =>
      parseProgramProposal({ ...turnProposal(), affectedVariableIds: ["score total"] }),
    ).toThrow(/stable id token/);
    expect(() =>
      parseProgramProposal({
        ...turnProposal(),
        affectedNodeIds: ["scripts[0]/statements[1]", "scripts[0]/statements[1]"],
      }),
    ).toThrow(/duplicate id/);
    expect(() =>
      parseProgramProposal({
        ...turnProposal(),
        expectedRuntimeEvidence: [
          {
            id: "move-runs",
            description: "The move node appears in the trace.",
            variableIds: ["score total"],
          },
        ],
      }),
    ).toThrow(/stable id token/);
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

  it("carries affected creative ids and expected evidence into Web and Studio views", () => {
    const proposal = createProgramProposal({
      id: "proposal-actor-score",
      baseProgram: multiScriptProgram,
      source: { kind: "learning-companion", capability: "multi-actor-review" },
      purpose: "Move only the explorer.",
      rationale: "The explorer needs one extra step; the beacon script should stay untouched.",
      affectedActorIds: ["actor:explorer"],
      affectedScriptIds: ["explorer-script"],
      affectedAssetIds: ["asset:costume.explorer"],
      affectedVariableIds: ["score"],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      expectedRuntimeEvidence: [
        {
          id: "explorer-move-runs",
          description: "Run the explorer script and confirm the move executes.",
          nodeIds: ["scripts[0]/statements[0]"],
          actorIds: ["actor:explorer"],
          scriptIds: ["explorer-script"],
          variableIds: ["score"],
          outcome: "completes",
        },
      ],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 25,
        },
      ],
    });

    const review = createProposalReview(multiScriptProgram, proposal);
    const web = createWebProposalCardView(review);
    const studio = createStudioProposalDiffView(review);
    const accepted = acceptProposal(multiScriptProgram, review);

    expect(web.affectedActorIds).toEqual(["actor:explorer"]);
    expect(web.affectedScriptIds).toEqual(studio.affectedScriptIds);
    expect(studio.affectedAssetIds).toEqual(["asset:costume.explorer"]);
    expect(web.affectedVariableIds).toEqual(["score"]);
    expect(web.expectedRuntimeEvidence).toEqual(studio.expectedRuntimeEvidence);
    expect(accepted.audit).toMatchObject({
      affectedActorIds: ["actor:explorer"],
      affectedScriptIds: ["explorer-script"],
      affectedAssetIds: ["asset:costume.explorer"],
      affectedVariableIds: ["score"],
    });
  });

  it("rejects a proposal that claims one script but mutates another", () => {
    const crossScript = createProgramProposal({
      id: "proposal-wrong-script",
      baseProgram: multiScriptProgram,
      source: { kind: "learning-companion", capability: "multi-actor-review" },
      purpose: "Claim to move explorer.",
      rationale: "The scope metadata must match the operation target.",
      affectedScriptIds: ["explorer-script"],
      affectedNodeIds: ["scripts[1]/statements[0]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[1]/statements[0]",
          field: "degrees",
          value: 45,
        },
      ],
    });

    expect(() => createProposalReview(multiScriptProgram, crossScript)).toThrow(
      /outside affectedScriptIds/,
    );
  });

  it("rejects a proposal that claims one node but mutates another", () => {
    const crossNode = createProgramProposal({
      id: "proposal-wrong-node",
      baseProgram: twoStepProgram,
      source: { kind: "learning-companion", capability: "program-proposal" },
      purpose: "Claim to change the move.",
      rationale: "The highlighted node must match the operation target.",
      affectedScriptIds: ["main"],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[1]",
          field: "degrees",
          value: 45,
        },
      ],
    });

    expect(() => createProposalReview(twoStepProgram, crossNode)).toThrow(
      /outside affectedNodeIds/,
    );
  });

  it("rejects a proposal that declares asset scope but references a different asset", () => {
    const crossAsset = createProgramProposal({
      id: "proposal-wrong-asset",
      baseProgram: multiScriptProgram,
      source: { kind: "learning-companion", capability: "multi-actor-review" },
      purpose: "Play the confirmation sound.",
      rationale: "The scope metadata must include the referenced sound asset.",
      affectedScriptIds: ["explorer-script"],
      affectedAssetIds: ["asset:costume.explorer"],
      affectedNodeIds: ["scripts[0]/statements[1]"],
      operations: [
        {
          type: "appendStatement",
          scriptIndex: 0,
          statement: { type: "playSound", soundId: "asset:sound.success" },
        },
      ],
    });

    expect(() => createProposalReview(multiScriptProgram, crossAsset)).toThrow(
      /outside affectedAssetIds/,
    );
  });

  it("rejects a proposal that declares variable scope but references a different variable", () => {
    const crossVariable = createProgramProposal({
      id: "proposal-wrong-variable",
      baseProgram: variableProgram,
      source: { kind: "learning-companion", capability: "program-proposal" },
      purpose: "Set the score.",
      rationale: "The scope metadata must include the referenced variable.",
      affectedScriptIds: ["score-script"],
      affectedVariableIds: ["energy"],
      affectedNodeIds: ["scripts[0]/statements[1]"],
      operations: [
        {
          type: "appendStatement",
          scriptIndex: 0,
          statement: {
            type: "setVariable",
            variableId: "score",
            value: { type: "numericLiteral", value: 1 },
          },
        },
      ],
    });

    expect(() => createProposalReview(variableProgram, crossVariable)).toThrow(
      /outside affectedVariableIds/,
    );
  });

  it("rejects expected evidence that points outside declared scope ids", () => {
    const crossEvidence = createProgramProposal({
      id: "proposal-cross-evidence",
      baseProgram: multiScriptProgram,
      source: { kind: "learning-companion", capability: "multi-actor-review" },
      purpose: "Move only explorer.",
      rationale: "Expected evidence must stay inside declared scope.",
      affectedActorIds: ["actor:explorer"],
      affectedScriptIds: ["explorer-script"],
      affectedAssetIds: ["asset:sound.beacon"],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      expectedRuntimeEvidence: [
        {
          id: "wrong-scope",
          description: "This evidence reaches outside the declared actor scope.",
          nodeIds: ["scripts[0]/statements[0]"],
          actorIds: ["actor:beacon"],
          scriptIds: ["explorer-script"],
          assetIds: ["asset:sound.beacon"],
        },
      ],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 20,
        },
      ],
    });

    expect(() => createProposalReview(multiScriptProgram, crossEvidence)).toThrow(
      /outside affected scope/,
    );
  });

  it("rejects affected or expected node ids that do not resolve in accepted or proposed code", () => {
    const extraAffectedNode = createProgramProposal({
      id: "proposal-extra-node",
      baseProgram: acceptedProgram,
      source: { kind: "learning-companion", capability: "program-proposal" },
      purpose: "Change the move.",
      rationale: "Every highlighted node must map to accepted or proposed code.",
      affectedNodeIds: ["scripts[0]/statements[0]", "scripts[0]/statements[9]"],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 120,
        },
      ],
    });
    const extraExpectedNode = createProgramProposal({
      id: "proposal-extra-evidence-node",
      baseProgram: acceptedProgram,
      source: { kind: "learning-companion", capability: "program-proposal" },
      purpose: "Change the move.",
      rationale: "Expected evidence nodes must also resolve.",
      affectedNodeIds: ["scripts[0]/statements[0]"],
      expectedRuntimeEvidence: [
        {
          id: "missing-node",
          description: "This node does not exist in either projection.",
          nodeIds: ["scripts[0]/statements[9]"],
        },
      ],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 120,
        },
      ],
    });

    expect(() => createProposalReview(acceptedProgram, extraAffectedNode)).toThrow(
      /not present in accepted or proposed code/,
    );
    expect(() => createProposalReview(acceptedProgram, extraExpectedNode)).toThrow(
      /not present in accepted or proposed code/,
    );
  });

  it("binds runtime trace back to proposal ids without unrelated trace metadata", () => {
    const proposal = createProgramProposal({
      id: "proposal-trace-binding",
      baseProgram: multiScriptProgram,
      source: { kind: "deterministic-scaffold", capability: "multi-actor-review" },
      purpose: "Move explorer.",
      rationale: "Runtime evidence should point at the changed node.",
      affectedActorIds: ["actor:explorer"],
      affectedScriptIds: ["explorer-script", "helper-script"],
      affectedAssetIds: ["asset:sound.beacon", "asset:costume.missing"],
      affectedVariableIds: ["score", "energy"],
      affectedNodeIds: ["scripts[0]/statements[0]", "scripts[0]/statements[1]"],
      expectedRuntimeEvidence: [
        {
          id: "move-node-runs",
          description: "The changed move node appears in the runtime trace.",
          nodeIds: ["scripts[0]/statements[0]"],
          actorIds: ["actor:explorer", "actor:helper"],
          scriptIds: ["explorer-script"],
          assetIds: ["asset:sound.beacon"],
          variableIds: ["score"],
        },
      ],
      operations: [
        {
          type: "replaceStatementField",
          nodeId: "scripts[0]/statements[0]",
          field: "steps",
          value: 30,
        },
      ],
    });

    const binding = bindProposalRuntimeEvidence(proposal, [
      {
        nodeId: "scripts[0]/statements[0]",
        actorId: "actor:explorer",
        scriptId: "explorer-script",
        assetIds: ["asset:sound.beacon"],
        variableIds: ["score"],
      },
      {
        nodeId: "scripts[1]/statements[0]",
        actorId: "actor:beacon",
        scriptId: "beacon-script",
        variableIds: ["energy"],
      },
    ]);

    expect(binding.matchedNodeIds).toEqual(["scripts[0]/statements[0]"]);
    expect(binding.missingNodeIds).toEqual(["scripts[0]/statements[1]"]);
    expect(binding.expectedActorIds).toEqual(["actor:explorer", "actor:helper"]);
    expect(binding.observedActorIds).toEqual(["actor:explorer"]);
    expect(binding.matchedActorIds).toEqual(["actor:explorer"]);
    expect(binding.missingActorIds).toEqual(["actor:helper"]);
    expect(binding.expectedScriptIds).toEqual(["explorer-script", "helper-script"]);
    expect(binding.observedScriptIds).toEqual(["explorer-script"]);
    expect(binding.matchedScriptIds).toEqual(["explorer-script"]);
    expect(binding.missingScriptIds).toEqual(["helper-script"]);
    expect(binding.expectedAssetIds).toEqual(["asset:sound.beacon", "asset:costume.missing"]);
    expect(binding.observedAssetIds).toEqual(["asset:sound.beacon"]);
    expect(binding.matchedAssetIds).toEqual(["asset:sound.beacon"]);
    expect(binding.missingAssetIds).toEqual(["asset:costume.missing"]);
    expect(binding.expectedVariableIds).toEqual(["score", "energy"]);
    expect(binding.observedVariableIds).toEqual(["score"]);
    expect(binding.matchedVariableIds).toEqual(["score"]);
    expect(binding.missingVariableIds).toEqual(["energy"]);
  });

  it("compares accepted, proposed, learner-modified and runtime evidence states", () => {
    const proposal = changeProposal();
    const review = createProposalReview(acceptedProgram, proposal);
    const learnerModified: ProjectProgram = {
      ...acceptedProgram,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 200 }],
        },
      ],
    };
    const evidence = bindProposalRuntimeEvidence(proposal, [
      { nodeId: "scripts[0]/statements[0]", scriptId: "main" },
    ]);

    const comparison = createProposalComparisonView(review, {
      learnerModifiedProgram: learnerModified,
      runtimeEvidence: evidence,
    });

    expect(comparison.proposalId).toBe(proposal.id);
    expect(comparison.entries.map((entry) => entry.stage)).toEqual([
      "accepted",
      "proposed",
      "learner-modified",
      "runtime",
    ]);
    expect(comparison.entries[0]?.code).toContain("sprite.move(160);");
    expect(comparison.entries[1]?.code).toContain("sprite.move(220);");
    expect(comparison.entries[2]?.code).toContain("sprite.move(200);");
    expect(comparison.entries[0]?.changes?.[0]).toMatchObject({
      beforeText: "  sprite.move(160);\n",
      afterText: "  sprite.move(220);\n",
    });
    expect(comparison.entries[3]?.evidence?.matchedNodeIds).toEqual(["scripts[0]/statements[0]"]);
    expect(comparison.entries[0]?.programHash).not.toBe(comparison.entries[1]?.programHash);
    expect(comparison.entries[2]?.programHash).not.toBe(comparison.entries[1]?.programHash);
  });
});
