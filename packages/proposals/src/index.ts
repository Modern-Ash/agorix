import { projectProgram, type ProjectionResult, type TextRange } from "@agorix/code-generator";
import { semanticProjectHash } from "@agorix/persistence";
import {
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { detectRepeatPattern } from "./repeatPattern.js";

export const PACKAGE_NAME = "@agorix/proposals";
export const PROGRAM_PROPOSAL_SCHEMA_VERSION = "agorix/program-proposal/v1";

export type ProgramProposalSchemaVersion = typeof PROGRAM_PROPOSAL_SCHEMA_VERSION;

export type ProposalSourceKind = "learning-companion" | "deterministic-scaffold" | "web" | "studio";

export interface ProposalSource {
  readonly kind: ProposalSourceKind;
  readonly capability?: string;
}

export interface ProgramProposal {
  readonly schema: ProgramProposalSchemaVersion;
  readonly id: string;
  readonly baseProgramHash: string;
  readonly source: ProposalSource;
  readonly purpose: string;
  readonly rationale: string;
  readonly affectedActorIds?: readonly string[];
  readonly affectedScriptIds?: readonly string[];
  readonly affectedAssetIds?: readonly string[];
  readonly affectedVariableIds?: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly expectedRuntimeEvidence?: readonly ProposalExpectedRuntimeEvidence[];
  readonly operations: readonly ProposalOperation[];
}

export type ProposalExpectedOutcome =
  "completes" | "reaches-goal" | "does-not-reach-goal" | "runtime-error";

export interface ProposalExpectedRuntimeEvidence {
  readonly id: string;
  readonly description: string;
  readonly nodeIds?: readonly string[];
  readonly actorIds?: readonly string[];
  readonly scriptIds?: readonly string[];
  readonly assetIds?: readonly string[];
  readonly variableIds?: readonly string[];
  readonly outcome?: ProposalExpectedOutcome;
}

export type ProposalOperation =
  | {
      readonly type: "appendStatement";
      readonly scriptIndex: number;
      readonly statement: Statement;
    }
  | {
      readonly type: "replaceStatement";
      readonly nodeId: string;
      readonly statement: Statement;
    }
  | {
      readonly type: "removeStatement";
      readonly nodeId: string;
    }
  | {
      readonly type: "replaceStatementField";
      readonly nodeId: string;
      readonly field: "steps" | "degrees" | "count";
      readonly value: number;
    };

export type ProposalErrorCode =
  | "INVALID_PROPOSAL"
  | "UNKNOWN_OPERATION"
  | "UNSUPPORTED_PATH"
  | "STALE_PROPOSAL"
  | "INVALID_CANDIDATE";

export class ProposalValidationError extends Error {
  readonly code: ProposalErrorCode;
  readonly path: string;

  constructor(code: ProposalErrorCode, path: string, message: string) {
    super(`${code} ${path}: ${message}`);
    this.name = "ProposalValidationError";
    this.code = code;
    this.path = path;
  }
}

export interface ProposalDiffEntry {
  readonly nodeId: string;
  readonly kind: "added" | "changed" | "removed" | "referenced";
  readonly beforeText?: string;
  readonly afterText?: string;
}

export interface ProposalReview {
  readonly proposal: ProgramProposal;
  readonly acceptedProgram: ProjectProgram;
  readonly candidateProgram: ProjectProgram;
  readonly acceptedProjection: ProjectionResult;
  readonly proposedProjection: ProjectionResult;
  readonly affectedRanges: readonly TextRange[];
  readonly diff: readonly ProposalDiffEntry[];
}

export interface ProposalAuditEvent {
  readonly schema: "agorix/proposal-audit/v1";
  readonly proposalId: string;
  readonly decision: "accept" | "reject" | "modify";
  readonly affectedActorIds?: readonly string[];
  readonly affectedScriptIds?: readonly string[];
  readonly affectedAssetIds?: readonly string[];
  readonly affectedVariableIds?: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly baseProgramHash: string;
  readonly resultProgramHash: string;
}

export interface RuntimeEvidenceTraceEntry {
  readonly nodeId: string;
  readonly actorId?: string;
  readonly scriptId?: string;
  readonly assetIds?: readonly string[];
  readonly variableIds?: readonly string[];
}

export interface ProposalRuntimeEvidenceBinding {
  readonly proposalId: string;
  readonly affectedActorIds: readonly string[];
  readonly affectedScriptIds: readonly string[];
  readonly affectedAssetIds: readonly string[];
  readonly affectedVariableIds: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly expected: readonly ProposalExpectedRuntimeEvidence[];
  readonly observedNodeIds: readonly string[];
  readonly matchedNodeIds: readonly string[];
  readonly missingNodeIds: readonly string[];
  readonly expectedActorIds: readonly string[];
  readonly observedActorIds: readonly string[];
  readonly matchedActorIds: readonly string[];
  readonly missingActorIds: readonly string[];
  readonly expectedScriptIds: readonly string[];
  readonly observedScriptIds: readonly string[];
  readonly matchedScriptIds: readonly string[];
  readonly missingScriptIds: readonly string[];
  readonly expectedAssetIds: readonly string[];
  readonly observedAssetIds: readonly string[];
  readonly matchedAssetIds: readonly string[];
  readonly missingAssetIds: readonly string[];
  readonly expectedVariableIds: readonly string[];
  readonly observedVariableIds: readonly string[];
  readonly matchedVariableIds: readonly string[];
  readonly missingVariableIds: readonly string[];
}

export interface ProposalDecisionResult {
  readonly program: ProjectProgram;
  readonly audit: ProposalAuditEvent;
}

export interface WebProposalCardView {
  readonly proposalId: string;
  readonly title: string;
  readonly rationale: string;
  readonly affectedActorIds: readonly string[];
  readonly affectedScriptIds: readonly string[];
  readonly affectedAssetIds: readonly string[];
  readonly affectedVariableIds: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly expectedRuntimeEvidence: readonly ProposalExpectedRuntimeEvidence[];
  readonly changes: readonly ProposalDiffEntry[];
  readonly actions: readonly ProposalAction[];
}

export interface ProposalAction {
  readonly id: "accept" | "modify" | "reject";
  readonly label: string;
  readonly minTouchTargetPx: 44;
}

export interface StudioProposalDiffView {
  readonly proposalId: string;
  readonly affectedActorIds: readonly string[];
  readonly affectedScriptIds: readonly string[];
  readonly affectedAssetIds: readonly string[];
  readonly affectedVariableIds: readonly string[];
  readonly affectedNodeIds: readonly string[];
  readonly expectedRuntimeEvidence: readonly ProposalExpectedRuntimeEvidence[];
  readonly affectedRanges: readonly TextRange[];
  readonly changes: readonly ProposalDiffEntry[];
  readonly acceptedCode: string;
  readonly proposedCode: string;
}

export type ProposalComparisonStage = "accepted" | "proposed" | "learner-modified" | "runtime";

export interface ProposalComparisonEntry {
  readonly stage: ProposalComparisonStage;
  readonly label: string;
  readonly programHash?: string;
  readonly code?: string;
  readonly changes?: readonly ProposalDiffEntry[];
  readonly evidence?: ProposalRuntimeEvidenceBinding;
}

export interface ProposalComparisonView {
  readonly proposalId: string;
  readonly entries: readonly ProposalComparisonEntry[];
}

type MutableProjectProgram = {
  schema: ProjectProgram["schema"];
  scripts: Array<{
    id: string;
    trigger: ProjectProgram["scripts"][number]["trigger"];
    statements: Statement[];
  }>;
};

const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const MAX_SCOPE_IDS = 64;

export function programSemanticHash(program: ProjectProgram): string {
  return semanticProjectHash({
    schemaVersion: program.schema,
    program: validateProgram(program),
    metadata: {
      createdAt: "1970-01-01T00:00:00.000Z",
      updatedAt: "1970-01-01T00:00:00.000Z",
      missionProgress: 0,
      hintLevel: 0,
    },
  });
}

export function createProgramProposal(
  input: Omit<ProgramProposal, "schema" | "baseProgramHash"> & {
    readonly baseProgram: ProjectProgram;
  },
): ProgramProposal {
  return validateProgramProposal({
    schema: PROGRAM_PROPOSAL_SCHEMA_VERSION,
    id: input.id,
    baseProgramHash: programSemanticHash(input.baseProgram),
    source: input.source,
    purpose: input.purpose,
    rationale: input.rationale,
    ...(input.affectedActorIds === undefined ? {} : { affectedActorIds: input.affectedActorIds }),
    ...(input.affectedScriptIds === undefined
      ? {}
      : { affectedScriptIds: input.affectedScriptIds }),
    ...(input.affectedAssetIds === undefined ? {} : { affectedAssetIds: input.affectedAssetIds }),
    ...(input.affectedVariableIds === undefined
      ? {}
      : { affectedVariableIds: input.affectedVariableIds }),
    affectedNodeIds: input.affectedNodeIds,
    ...(input.expectedRuntimeEvidence === undefined
      ? {}
      : { expectedRuntimeEvidence: input.expectedRuntimeEvidence }),
    operations: input.operations,
  });
}

export function parseProgramProposal(providerOutput: unknown): ProgramProposal {
  return validateProgramProposal(providerOutput as ProgramProposal);
}

export function validateProgramProposal(proposal: ProgramProposal): ProgramProposal {
  assertPlainObject(proposal, "$", [
    "schema",
    "id",
    "baseProgramHash",
    "source",
    "purpose",
    "rationale",
    "affectedActorIds",
    "affectedScriptIds",
    "affectedAssetIds",
    "affectedVariableIds",
    "affectedNodeIds",
    "expectedRuntimeEvidence",
    "operations",
  ]);
  if (proposal.schema !== PROGRAM_PROPOSAL_SCHEMA_VERSION) {
    fail("INVALID_PROPOSAL", "$.schema", `expected ${PROGRAM_PROPOSAL_SCHEMA_VERSION}`);
  }
  assertStableId(proposal.id, "$.id");
  assertBoundedString(proposal.baseProgramHash, "$.baseProgramHash", 1, 120);
  assertSource(proposal.source);
  assertBoundedString(proposal.purpose, "$.purpose", 1, 240);
  assertBoundedString(proposal.rationale, "$.rationale", 1, 800);
  assertOptionalStableIdArray(proposal.affectedActorIds, "$.affectedActorIds");
  assertOptionalStableIdArray(proposal.affectedScriptIds, "$.affectedScriptIds");
  assertOptionalStableIdArray(proposal.affectedAssetIds, "$.affectedAssetIds");
  assertOptionalStableIdArray(proposal.affectedVariableIds, "$.affectedVariableIds");
  assertStringArray(proposal.affectedNodeIds, "$.affectedNodeIds", MAX_SCOPE_IDS);
  assertExpectedRuntimeEvidence(proposal.expectedRuntimeEvidence, "$.expectedRuntimeEvidence");
  if (!Array.isArray(proposal.operations) || proposal.operations.length === 0) {
    fail("INVALID_PROPOSAL", "$.operations", "expected at least one operation");
  }
  proposal.operations.forEach((operation, index) =>
    assertOperation(operation, `$.operations[${index}]`),
  );
  return proposal;
}

export function createProposalReview(
  acceptedProgram: ProjectProgram,
  proposal: ProgramProposal,
): ProposalReview {
  const accepted = validateProgram(acceptedProgram);
  assertFreshBase(accepted, proposal);
  assertProposalScope(accepted, proposal);
  const candidate = validateProgram(applyProposalOperations(accepted, proposal));
  const acceptedProjection = projectProgram(accepted);
  const proposedProjection = projectProgram(candidate);
  assertProposalNodeIdsResolvable(proposal, acceptedProjection, proposedProjection);
  const diff = proposal.affectedNodeIds.map((nodeId) =>
    createDiffEntry(nodeId, acceptedProjection, proposedProjection),
  );
  return {
    proposal,
    acceptedProgram: accepted,
    candidateProgram: candidate,
    acceptedProjection,
    proposedProjection,
    affectedRanges: diff.flatMap((entry) => {
      const proposed = proposedProjection.mapping[entry.nodeId];
      const acceptedRange = acceptedProjection.mapping[entry.nodeId];
      return proposed ?? acceptedRange ?? [];
    }),
    diff,
  };
}

export function rejectProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProposalDecisionResult {
  const accepted = validateProgram(acceptedProgram);
  return {
    program: accepted,
    audit: createAuditEvent(review.proposal, "reject", accepted),
  };
}

export function acceptProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
): ProposalDecisionResult {
  const accepted = validateProgram(acceptedProgram);
  assertFreshBase(accepted, review.proposal);
  return {
    program: validateProgram(review.candidateProgram),
    audit: createAuditEvent(review.proposal, "accept", review.candidateProgram),
  };
}

export function modifyProposal(
  acceptedProgram: ProjectProgram,
  review: ProposalReview,
  learnerReviewedProgram: ProjectProgram,
): ProposalDecisionResult {
  const accepted = validateProgram(acceptedProgram);
  assertFreshBase(accepted, review.proposal);
  const program = validateProgram(learnerReviewedProgram);
  return {
    program,
    audit: createAuditEvent(review.proposal, "modify", program),
  };
}

export function createWebProposalCardView(review: ProposalReview): WebProposalCardView {
  return {
    proposalId: review.proposal.id,
    title: review.proposal.purpose,
    rationale: review.proposal.rationale,
    affectedActorIds: review.proposal.affectedActorIds ?? [],
    affectedScriptIds: review.proposal.affectedScriptIds ?? [],
    affectedAssetIds: review.proposal.affectedAssetIds ?? [],
    affectedVariableIds: review.proposal.affectedVariableIds ?? [],
    affectedNodeIds: review.proposal.affectedNodeIds,
    expectedRuntimeEvidence: review.proposal.expectedRuntimeEvidence ?? [],
    changes: review.diff,
    actions: [
      { id: "accept", label: "Accept", minTouchTargetPx: 44 },
      { id: "modify", label: "Modify", minTouchTargetPx: 44 },
      { id: "reject", label: "Reject", minTouchTargetPx: 44 },
    ],
  };
}

export function createStudioProposalDiffView(review: ProposalReview): StudioProposalDiffView {
  return {
    proposalId: review.proposal.id,
    affectedActorIds: review.proposal.affectedActorIds ?? [],
    affectedScriptIds: review.proposal.affectedScriptIds ?? [],
    affectedAssetIds: review.proposal.affectedAssetIds ?? [],
    affectedVariableIds: review.proposal.affectedVariableIds ?? [],
    affectedNodeIds: review.proposal.affectedNodeIds,
    expectedRuntimeEvidence: review.proposal.expectedRuntimeEvidence ?? [],
    affectedRanges: review.affectedRanges,
    changes: review.diff,
    acceptedCode: review.acceptedProjection.code,
    proposedCode: review.proposedProjection.code,
  };
}

export function bindProposalRuntimeEvidence(
  proposal: ProgramProposal,
  trace: readonly RuntimeEvidenceTraceEntry[],
): ProposalRuntimeEvidenceBinding {
  const affectedNodeIds = proposal.affectedNodeIds;
  const expectedActorIds = unique([
    ...(proposal.affectedActorIds ?? []),
    ...(proposal.expectedRuntimeEvidence ?? []).flatMap((evidence) => evidence.actorIds ?? []),
  ]);
  const expectedScriptIds = unique([
    ...(proposal.affectedScriptIds ?? []),
    ...(proposal.expectedRuntimeEvidence ?? []).flatMap((evidence) => evidence.scriptIds ?? []),
  ]);
  const expectedAssetIds = unique([
    ...(proposal.affectedAssetIds ?? []),
    ...(proposal.expectedRuntimeEvidence ?? []).flatMap((evidence) => evidence.assetIds ?? []),
  ]);
  const expectedVariableIds = unique([
    ...(proposal.affectedVariableIds ?? []),
    ...(proposal.expectedRuntimeEvidence ?? []).flatMap((evidence) => evidence.variableIds ?? []),
  ]);
  const expectedNodeIds = new Set(
    (proposal.expectedRuntimeEvidence ?? []).flatMap((evidence) => evidence.nodeIds ?? []),
  );
  const wantedNodeIds = new Set([...affectedNodeIds, ...expectedNodeIds]);
  const relevantTrace = trace.filter((entry) => wantedNodeIds.has(entry.nodeId));
  const observedNodeIds = unique(relevantTrace.map((entry) => entry.nodeId));
  const observedActorIds = unique(
    relevantTrace.flatMap((entry) => (entry.actorId === undefined ? [] : [entry.actorId])),
  );
  const observedScriptIds = unique(
    relevantTrace.flatMap((entry) => (entry.scriptId === undefined ? [] : [entry.scriptId])),
  );
  const observedAssetIds = unique(relevantTrace.flatMap((entry) => entry.assetIds ?? []));
  const observedVariableIds = unique(relevantTrace.flatMap((entry) => entry.variableIds ?? []));
  return {
    proposalId: proposal.id,
    affectedActorIds: proposal.affectedActorIds ?? [],
    affectedScriptIds: proposal.affectedScriptIds ?? [],
    affectedAssetIds: proposal.affectedAssetIds ?? [],
    affectedVariableIds: proposal.affectedVariableIds ?? [],
    affectedNodeIds,
    expected: proposal.expectedRuntimeEvidence ?? [],
    observedNodeIds,
    matchedNodeIds: affectedNodeIds.filter((nodeId) => observedNodeIds.includes(nodeId)),
    missingNodeIds: affectedNodeIds.filter((nodeId) => !observedNodeIds.includes(nodeId)),
    expectedActorIds,
    observedActorIds,
    matchedActorIds: expectedActorIds.filter((actorId) => observedActorIds.includes(actorId)),
    missingActorIds: expectedActorIds.filter((actorId) => !observedActorIds.includes(actorId)),
    expectedScriptIds,
    observedScriptIds,
    matchedScriptIds: expectedScriptIds.filter((scriptId) => observedScriptIds.includes(scriptId)),
    missingScriptIds: expectedScriptIds.filter((scriptId) => !observedScriptIds.includes(scriptId)),
    expectedAssetIds,
    observedAssetIds,
    matchedAssetIds: expectedAssetIds.filter((assetId) => observedAssetIds.includes(assetId)),
    missingAssetIds: expectedAssetIds.filter((assetId) => !observedAssetIds.includes(assetId)),
    expectedVariableIds,
    observedVariableIds,
    matchedVariableIds: expectedVariableIds.filter((variableId) =>
      observedVariableIds.includes(variableId),
    ),
    missingVariableIds: expectedVariableIds.filter(
      (variableId) => !observedVariableIds.includes(variableId),
    ),
  };
}

export function createProposalComparisonView(
  review: ProposalReview,
  options: {
    readonly learnerModifiedProgram?: ProjectProgram;
    readonly runtimeEvidence?: ProposalRuntimeEvidenceBinding;
  } = {},
): ProposalComparisonView {
  const entries: ProposalComparisonEntry[] = [
    {
      stage: "accepted",
      label: "Accepted project",
      programHash: programSemanticHash(review.acceptedProgram),
      code: review.acceptedProjection.code,
      changes: review.diff.map((entry) => ({
        nodeId: entry.nodeId,
        kind: entry.kind,
        ...(entry.beforeText === undefined ? {} : { beforeText: entry.beforeText }),
        ...(entry.afterText === undefined ? {} : { afterText: entry.afterText }),
      })),
    },
    {
      stage: "proposed",
      label: "AI proposal",
      programHash: programSemanticHash(review.candidateProgram),
      code: review.proposedProjection.code,
      changes: review.diff,
    },
  ];
  if (options.learnerModifiedProgram !== undefined) {
    const modified = validateProgram(options.learnerModifiedProgram);
    const modifiedProjection = projectProgram(modified);
    entries.push({
      stage: "learner-modified",
      label: "Learner modified result",
      programHash: programSemanticHash(modified),
      code: modifiedProjection.code,
      changes: review.proposal.affectedNodeIds.map((nodeId) =>
        createDiffEntry(nodeId, review.acceptedProjection, modifiedProjection),
      ),
    });
  }
  if (options.runtimeEvidence !== undefined) {
    entries.push({
      stage: "runtime",
      label: "Runtime evidence",
      evidence: options.runtimeEvidence,
    });
  }
  return { proposalId: review.proposal.id, entries };
}

function applyProposalOperations(
  acceptedProgram: ProjectProgram,
  proposal: ProgramProposal,
): ProjectProgram {
  const mutable = structuredClone(acceptedProgram) as MutableProjectProgram;
  for (const operation of proposal.operations) {
    switch (operation.type) {
      case "appendStatement": {
        const script = mutable.scripts[operation.scriptIndex];
        if (script === undefined) {
          fail("UNSUPPORTED_PATH", "scriptIndex", "script does not exist");
        }
        script.statements.push(operation.statement);
        break;
      }
      case "replaceStatement": {
        const target = statementTarget(mutable, operation.nodeId);
        target.list[target.index] = operation.statement;
        break;
      }
      case "removeStatement": {
        const target = statementTarget(mutable, operation.nodeId);
        target.list.splice(target.index, 1);
        break;
      }
      case "replaceStatementField": {
        const target = statementTarget(mutable, operation.nodeId);
        const statement = target.list[target.index] as Record<string, unknown> | undefined;
        if (statement === undefined || !(operation.field in statement)) {
          fail("UNSUPPORTED_PATH", operation.nodeId, `field ${operation.field} is not supported`);
        }
        target.list[target.index] = {
          ...statement,
          [operation.field]: operation.value,
        } as unknown as Statement;
        break;
      }
      default: {
        const unknown = operation as { type?: unknown };
        fail("UNKNOWN_OPERATION", "operation.type", `unknown operation ${String(unknown.type)}`);
      }
    }
  }
  try {
    return validateProgram(mutable);
  } catch (error) {
    if (error instanceof Error) {
      throw new ProposalValidationError("INVALID_CANDIDATE", "$.operations", error.message);
    }
    throw error;
  }
}

function statementTarget(
  program: MutableProjectProgram,
  nodeId: string,
): { list: Statement[]; index: number } {
  const match = /^scripts\[(\d+)\](?:\/(statements|body|then)\[(\d+)\])+$/.exec(nodeId);
  if (match === null) {
    fail("UNSUPPORTED_PATH", "nodeId", `unsupported statement path ${nodeId}`);
  }
  const scriptIndex = Number(match[1]);
  const script = program.scripts[scriptIndex];
  if (script === undefined) {
    fail("UNSUPPORTED_PATH", nodeId, "script does not exist");
  }
  const parts = [...nodeId.matchAll(/\/(statements|body|then)\[(\d+)\]/g)].map((part) => ({
    segment: part[1],
    index: Number(part[2]),
  }));
  let list = script.statements;
  for (let partIndex = 0; partIndex < parts.length - 1; partIndex += 1) {
    const part = parts[partIndex];
    if (part === undefined) {
      fail("UNSUPPORTED_PATH", nodeId, "statement path is incomplete");
    }
    const statement = list[part.index];
    if (statement === undefined) {
      fail("UNSUPPORTED_PATH", nodeId, "statement does not exist");
    }
    const next = parts[partIndex + 1];
    if (next?.segment === "body" && statement.type === "repeat") {
      list = statement.body as Statement[];
    } else if (next?.segment === "then" && statement.type === "if") {
      list = statement.then as Statement[];
    } else {
      fail("UNSUPPORTED_PATH", nodeId, "nested statement segment is not supported");
    }
  }
  const last = parts[parts.length - 1];
  if (last === undefined || list[last.index] === undefined) {
    fail("UNSUPPORTED_PATH", nodeId, "statement does not exist");
  }
  return { list, index: last.index };
}

function createDiffEntry(
  nodeId: string,
  acceptedProjection: ProjectionResult,
  proposedProjection: ProjectionResult,
): ProposalDiffEntry {
  const beforeText = textForRange(acceptedProjection, nodeId);
  const afterText = textForRange(proposedProjection, nodeId);
  const kind =
    beforeText === undefined
      ? "added"
      : afterText === undefined
        ? "removed"
        : beforeText === afterText
          ? "referenced"
          : "changed";
  return {
    nodeId,
    kind,
    ...(beforeText === undefined ? {} : { beforeText }),
    ...(afterText === undefined ? {} : { afterText }),
  };
}

function textForRange(projection: ProjectionResult, nodeId: string): string | undefined {
  const range = projection.mapping[nodeId];
  return range === undefined ? undefined : projection.code.slice(range.start, range.end);
}

function assertProposalNodeIdsResolvable(
  proposal: ProgramProposal,
  acceptedProjection: ProjectionResult,
  proposedProjection: ProjectionResult,
): void {
  assertNodeIdsResolvable(
    proposal.affectedNodeIds,
    "$.affectedNodeIds",
    acceptedProjection,
    proposedProjection,
  );
  (proposal.expectedRuntimeEvidence ?? []).forEach((evidence, index) =>
    assertNodeIdsResolvable(
      evidence.nodeIds ?? [],
      `$.expectedRuntimeEvidence[${index}].nodeIds`,
      acceptedProjection,
      proposedProjection,
    ),
  );
}

function assertNodeIdsResolvable(
  nodeIds: readonly string[],
  path: string,
  acceptedProjection: ProjectionResult,
  proposedProjection: ProjectionResult,
): void {
  for (const [index, nodeId] of nodeIds.entries()) {
    if (
      acceptedProjection.mapping[nodeId] === undefined &&
      proposedProjection.mapping[nodeId] === undefined
    ) {
      throw new ProposalValidationError(
        "INVALID_PROPOSAL",
        `${path}[${index}]`,
        `node ${JSON.stringify(nodeId)} is not present in accepted or proposed code`,
      );
    }
  }
}

function assertFreshBase(program: ProjectProgram, proposal: ProgramProposal): void {
  const currentHash = programSemanticHash(program);
  if (currentHash !== proposal.baseProgramHash) {
    throw new ProposalValidationError(
      "STALE_PROPOSAL",
      "$.baseProgramHash",
      `proposal base ${proposal.baseProgramHash} does not match current ${currentHash}`,
    );
  }
}

function assertProposalScope(program: ProjectProgram, proposal: ProgramProposal): void {
  const allowedNodeIds = new Set(proposal.affectedNodeIds);
  const allowedScriptIds =
    proposal.affectedScriptIds === undefined ? undefined : new Set(proposal.affectedScriptIds);
  const allowedAssetIds =
    proposal.affectedAssetIds === undefined ? undefined : new Set(proposal.affectedAssetIds);
  const allowedVariableIds =
    proposal.affectedVariableIds === undefined ? undefined : new Set(proposal.affectedVariableIds);
  assertExpectedEvidenceScope(proposal, {
    ...(proposal.affectedActorIds === undefined
      ? {}
      : { allowedActorIds: new Set(proposal.affectedActorIds) }),
    ...(allowedScriptIds === undefined ? {} : { allowedScriptIds }),
    ...(allowedAssetIds === undefined ? {} : { allowedAssetIds }),
    ...(allowedVariableIds === undefined ? {} : { allowedVariableIds }),
  });
  for (const operation of proposal.operations) {
    for (const nodeId of nodeIdsForOperation(program, operation)) {
      if (!allowedNodeIds.has(nodeId)) {
        throw new ProposalValidationError(
          "INVALID_PROPOSAL",
          "$.affectedNodeIds",
          `operation targets node ${JSON.stringify(nodeId)} outside affectedNodeIds`,
        );
      }
    }
    const script = scriptForOperation(program, operation);
    if (
      script !== undefined &&
      allowedScriptIds !== undefined &&
      !allowedScriptIds.has(script.id)
    ) {
      throw new ProposalValidationError(
        "INVALID_PROPOSAL",
        "$.affectedScriptIds",
        `operation targets script ${JSON.stringify(script.id)} outside affectedScriptIds`,
      );
    }
    if (allowedAssetIds !== undefined) {
      for (const assetId of assetIdsForOperation(operation)) {
        if (!allowedAssetIds.has(assetId)) {
          throw new ProposalValidationError(
            "INVALID_PROPOSAL",
            "$.affectedAssetIds",
            `operation references asset ${JSON.stringify(assetId)} outside affectedAssetIds`,
          );
        }
      }
    }
    if (allowedVariableIds !== undefined) {
      for (const variableId of variableIdsForOperation(operation)) {
        if (!allowedVariableIds.has(variableId)) {
          throw new ProposalValidationError(
            "INVALID_PROPOSAL",
            "$.affectedVariableIds",
            `operation references variable ${JSON.stringify(variableId)} outside affectedVariableIds`,
          );
        }
      }
    }
  }
}

function assertExpectedEvidenceScope(
  proposal: ProgramProposal,
  scope: {
    readonly allowedActorIds?: ReadonlySet<string>;
    readonly allowedScriptIds?: ReadonlySet<string>;
    readonly allowedAssetIds?: ReadonlySet<string>;
    readonly allowedVariableIds?: ReadonlySet<string>;
  },
): void {
  for (const [index, evidence] of (proposal.expectedRuntimeEvidence ?? []).entries()) {
    assertExpectedIdsWithinScope(
      evidence.actorIds,
      scope.allowedActorIds,
      `$.expectedRuntimeEvidence[${index}].actorIds`,
      "actor",
    );
    assertExpectedIdsWithinScope(
      evidence.scriptIds,
      scope.allowedScriptIds,
      `$.expectedRuntimeEvidence[${index}].scriptIds`,
      "script",
    );
    assertExpectedIdsWithinScope(
      evidence.assetIds,
      scope.allowedAssetIds,
      `$.expectedRuntimeEvidence[${index}].assetIds`,
      "asset",
    );
    assertExpectedIdsWithinScope(
      evidence.variableIds,
      scope.allowedVariableIds,
      `$.expectedRuntimeEvidence[${index}].variableIds`,
      "variable",
    );
  }
}

function assertExpectedIdsWithinScope(
  ids: readonly string[] | undefined,
  allowed: ReadonlySet<string> | undefined,
  path: string,
  label: string,
): void {
  if (ids === undefined || allowed === undefined) return;
  for (const id of ids) {
    if (!allowed.has(id)) {
      throw new ProposalValidationError(
        "INVALID_PROPOSAL",
        path,
        `expected evidence references ${label} ${JSON.stringify(id)} outside affected scope`,
      );
    }
  }
}

function nodeIdsForOperation(
  program: ProjectProgram,
  operation: ProposalOperation,
): readonly string[] {
  switch (operation.type) {
    case "appendStatement": {
      const script = program.scripts[operation.scriptIndex];
      return script === undefined
        ? []
        : [`scripts[${operation.scriptIndex}]/statements[${script.statements.length}]`];
    }
    case "replaceStatement":
    case "removeStatement":
    case "replaceStatementField":
      return [operation.nodeId];
    default:
      return [];
  }
}

function assetIdsForOperation(operation: ProposalOperation): readonly string[] {
  switch (operation.type) {
    case "appendStatement":
    case "replaceStatement":
      return assetIdsForStatement(operation.statement);
    case "removeStatement":
    case "replaceStatementField":
      return [];
    default:
      return [];
  }
}

function assetIdsForStatement(statement: Statement): readonly string[] {
  switch (statement.type) {
    case "switchCostume":
      return [statement.costumeId];
    case "switchBackdrop":
      return [statement.backdropId];
    case "playSound":
      return [statement.soundId];
    case "repeat":
      return statement.body.flatMap(assetIdsForStatement);
    case "if":
      return statement.then.flatMap(assetIdsForStatement);
    default:
      return [];
  }
}

function variableIdsForOperation(operation: ProposalOperation): readonly string[] {
  switch (operation.type) {
    case "appendStatement":
    case "replaceStatement":
      return variableIdsForStatement(operation.statement);
    case "removeStatement":
    case "replaceStatementField":
      return [];
    default:
      return [];
  }
}

function variableIdsForStatement(statement: Statement): readonly string[] {
  switch (statement.type) {
    case "setVariable":
      return unique([statement.variableId, ...variableIdsForExpression(statement.value)]);
    case "changeVariable":
      return unique([statement.variableId, ...variableIdsForExpression(statement.delta)]);
    case "showVariable":
    case "hideVariable":
      return [statement.variableId];
    case "repeat":
      return unique(statement.body.flatMap(variableIdsForStatement));
    case "if":
      return unique([
        ...variableIdsForExpression(statement.condition),
        ...statement.then.flatMap(variableIdsForStatement),
      ]);
    default:
      return [];
  }
}

function variableIdsForExpression(expression: Expression): readonly string[] {
  switch (expression.type) {
    case "variable":
      return [expression.variableId];
    case "add":
    case "subtract":
    case "multiply":
    case "divide":
    case "lessThan":
    case "greaterThan":
    case "equals":
    case "and":
    case "or":
      return unique([
        ...variableIdsForExpression(expression.left),
        ...variableIdsForExpression(expression.right),
      ]);
    case "not":
      return variableIdsForExpression(expression.value);
    case "random":
      return unique([
        ...variableIdsForExpression(expression.min),
        ...variableIdsForExpression(expression.max),
      ]);
    default:
      return [];
  }
}

function scriptForOperation(
  program: ProjectProgram,
  operation: ProposalOperation,
): ProjectProgram["scripts"][number] | undefined {
  switch (operation.type) {
    case "appendStatement":
      return program.scripts[operation.scriptIndex];
    case "replaceStatement":
    case "removeStatement":
    case "replaceStatementField": {
      const match = /^scripts\[(\d+)\]/.exec(operation.nodeId);
      return match === null ? undefined : program.scripts[Number(match[1])];
    }
    default:
      return undefined;
  }
}

function createAuditEvent(
  proposal: ProgramProposal,
  decision: ProposalAuditEvent["decision"],
  resultProgram: ProjectProgram,
): ProposalAuditEvent {
  return {
    schema: "agorix/proposal-audit/v1",
    proposalId: proposal.id,
    decision,
    ...(proposal.affectedActorIds === undefined
      ? {}
      : { affectedActorIds: proposal.affectedActorIds }),
    ...(proposal.affectedScriptIds === undefined
      ? {}
      : { affectedScriptIds: proposal.affectedScriptIds }),
    ...(proposal.affectedAssetIds === undefined
      ? {}
      : { affectedAssetIds: proposal.affectedAssetIds }),
    ...(proposal.affectedVariableIds === undefined
      ? {}
      : { affectedVariableIds: proposal.affectedVariableIds }),
    affectedNodeIds: proposal.affectedNodeIds,
    baseProgramHash: proposal.baseProgramHash,
    resultProgramHash: programSemanticHash(resultProgram),
  };
}

function assertSource(source: ProposalSource): void {
  assertPlainObject(source, "$.source", ["kind", "capability"]);
  if (!["learning-companion", "deterministic-scaffold", "web", "studio"].includes(source.kind)) {
    fail("INVALID_PROPOSAL", "$.source.kind", "expected proposal source kind");
  }
  if (source.capability !== undefined) {
    assertBoundedString(source.capability, "$.source.capability", 1, 120);
  }
}

function assertOperation(operation: ProposalOperation, path: string): void {
  assertPlainObject(operation, path);
  switch (operation.type) {
    case "appendStatement":
      assertAllowedKeys(operation, path, ["type", "scriptIndex", "statement"]);
      assertNonNegativeInteger(operation.scriptIndex, `${path}.scriptIndex`);
      validateProgram(probeProgramForStatement(operation.statement));
      return;
    case "replaceStatement":
      assertAllowedKeys(operation, path, ["type", "nodeId", "statement"]);
      assertBoundedString(operation.nodeId, `${path}.nodeId`, 1, 160);
      validateProgram(probeProgramForStatement(operation.statement));
      return;
    case "removeStatement":
      assertAllowedKeys(operation, path, ["type", "nodeId"]);
      assertBoundedString(operation.nodeId, `${path}.nodeId`, 1, 160);
      return;
    case "replaceStatementField":
      assertAllowedKeys(operation, path, ["type", "nodeId", "field", "value"]);
      assertBoundedString(operation.nodeId, `${path}.nodeId`, 1, 160);
      if (!["steps", "degrees", "count"].includes(operation.field)) {
        fail("INVALID_PROPOSAL", `${path}.field`, "expected supported field");
      }
      if (typeof operation.value !== "number") {
        fail("INVALID_PROPOSAL", `${path}.value`, "expected number");
      }
      return;
    default:
      fail("UNKNOWN_OPERATION", `${path}.type`, "unknown proposal operation");
  }
}

function probeProgramForStatement(statement: Statement): ProjectProgram {
  const variableIds = variableIdsForStatement(statement);
  return {
    schema: "agorix/program/v1",
    ...(variableIds.length === 0
      ? {}
      : {
          variables: variableIds.map((variableId) => ({
            id: variableId,
            name: variableId,
            initialValue: 0,
            visible: true,
          })),
        }),
    scripts: [{ id: "probe", trigger: { type: "onStart" }, statements: [statement] }],
  };
}

function assertPlainObject(
  value: unknown,
  path: string,
  allowedKeys?: readonly string[],
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("INVALID_PROPOSAL", path, "expected object");
  }
  if (allowedKeys !== undefined) {
    for (const key of Object.keys(value)) {
      if (!allowedKeys.includes(key)) {
        fail("INVALID_PROPOSAL", `${path}.${key}`, "unexpected field");
      }
    }
  }
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  path: string,
  allowedKeys: readonly string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      fail("INVALID_PROPOSAL", `${path}.${key}`, "unexpected field");
    }
  }
}

function assertStringArray(value: unknown, path: string, maxLength = MAX_SCOPE_IDS): void {
  if (!Array.isArray(value)) {
    fail("INVALID_PROPOSAL", path, "expected string array");
  }
  if (value.length > maxLength) {
    fail("INVALID_PROPOSAL", path, `expected at most ${maxLength} entries`);
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    assertBoundedString(item, `${path}[${index}]`, 1, 160);
    if (seen.has(item)) {
      fail("INVALID_PROPOSAL", `${path}[${index}]`, `duplicate id ${JSON.stringify(item)}`);
    }
    seen.add(item);
  });
}

function assertOptionalStringArray(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  assertStringArray(value, path);
}

function assertStableId(value: unknown, path: string): asserts value is string {
  assertBoundedString(value, path, 1, 64);
  if (typeof value !== "string" || !STABLE_ID_PATTERN.test(value)) {
    fail("INVALID_PROPOSAL", path, "expected a stable id token");
  }
}

function assertStableIdArray(value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    fail("INVALID_PROPOSAL", path, "expected stable id array");
  }
  if (value.length > MAX_SCOPE_IDS) {
    fail("INVALID_PROPOSAL", path, `expected at most ${MAX_SCOPE_IDS} entries`);
  }
  const seen = new Set<string>();
  value.forEach((item, index) => {
    assertStableId(item, `${path}[${index}]`);
    if (seen.has(item)) {
      fail("INVALID_PROPOSAL", `${path}[${index}]`, `duplicate id ${JSON.stringify(item)}`);
    }
    seen.add(item);
  });
}

function assertOptionalStableIdArray(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  assertStableIdArray(value, path);
}

function assertExpectedRuntimeEvidence(value: unknown, path: string): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    fail("INVALID_PROPOSAL", path, "expected evidence array");
  }
  const seenEvidenceIds = new Set<string>();
  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    assertPlainObject(item, itemPath, [
      "id",
      "description",
      "nodeIds",
      "actorIds",
      "scriptIds",
      "assetIds",
      "variableIds",
      "outcome",
    ]);
    const evidenceId = item.id;
    assertStableId(evidenceId, `${itemPath}.id`);
    if (seenEvidenceIds.has(evidenceId)) {
      fail("INVALID_PROPOSAL", `${itemPath}.id`, `duplicate id ${JSON.stringify(evidenceId)}`);
    }
    seenEvidenceIds.add(evidenceId);
    assertBoundedString(item.description, `${itemPath}.description`, 1, 400);
    assertOptionalStringArray(item.nodeIds, `${itemPath}.nodeIds`);
    assertOptionalStableIdArray(item.actorIds, `${itemPath}.actorIds`);
    assertOptionalStableIdArray(item.scriptIds, `${itemPath}.scriptIds`);
    assertOptionalStableIdArray(item.assetIds, `${itemPath}.assetIds`);
    assertOptionalStableIdArray(item.variableIds, `${itemPath}.variableIds`);
    if (
      item.outcome !== undefined &&
      !["completes", "reaches-goal", "does-not-reach-goal", "runtime-error"].includes(
        item.outcome as string,
      )
    ) {
      fail("INVALID_PROPOSAL", `${itemPath}.outcome`, "expected runtime outcome");
    }
  });
}

function assertBoundedString(value: unknown, path: string, min: number, max: number): void {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    fail("INVALID_PROPOSAL", path, `expected string length ${min}-${max}`);
  }
}

function assertNonNegativeInteger(value: unknown, path: string): void {
  if (!Number.isInteger(value) || Number(value) < 0) {
    fail("INVALID_PROPOSAL", path, "expected non-negative integer");
  }
}

function fail(code: ProposalErrorCode, path: string, message: string): never {
  throw new ProposalValidationError(code, path, message);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export {
  MAX_REPEAT_PATTERN_PERIOD,
  MIN_REPEAT_PATTERN_COUNT,
  detectRepeatPattern,
  type RepeatPattern,
} from "./repeatPattern.js";

/**
 * Offers to express a statement written out several times as one `repeat`.
 * Returns undefined when no pattern exists. The result is only a proposal:
 * the base program stays unchanged until the learner accepts it.
 */
export function createRepeatPatternProposal(input: {
  readonly id: string;
  readonly baseProgram: ProjectProgram;
  readonly purpose: string;
  readonly rationale: string;
}): ProgramProposal | undefined {
  const pattern = detectRepeatPattern(input.baseProgram);
  if (pattern === undefined) {
    return undefined;
  }
  const nodeId = (index: number) => `scripts[${pattern.scriptIndex}]/statements[${index}]`;
  const covered = pattern.period * pattern.count;
  const removals: ProposalOperation[] = Array.from({ length: covered - 1 }, () => ({
    type: "removeStatement",
    nodeId: nodeId(pattern.startIndex + 1),
  }));
  return createProgramProposal({
    id: input.id,
    baseProgram: input.baseProgram,
    source: { kind: "deterministic-scaffold", capability: "repeat-pattern" },
    purpose: input.purpose,
    rationale: input.rationale,
    affectedNodeIds: Array.from({ length: covered }, (_, offset) =>
      nodeId(pattern.startIndex + offset),
    ),
    operations: [
      {
        type: "replaceStatement",
        nodeId: nodeId(pattern.startIndex),
        statement: { type: "repeat", count: pattern.count, body: pattern.body },
      },
      ...removals,
    ],
  });
}

/**
 * A small first step for an empty program. It is a proposal like any other:
 * the learner inspects it and accepts, changes or rejects it.
 */
export function createFirstStepProposal(input: {
  readonly id: string;
  readonly baseProgram: ProjectProgram;
  readonly purpose: string;
  readonly rationale: string;
  /** Distance of the proposed move; defaults to 10. */
  readonly steps?: number;
}): ProgramProposal | undefined {
  const script = input.baseProgram.scripts[0];
  if (script === undefined || script.statements.length > 0) {
    return undefined;
  }
  return createProgramProposal({
    id: input.id,
    baseProgram: input.baseProgram,
    source: { kind: "deterministic-scaffold", capability: "first-step" },
    purpose: input.purpose,
    rationale: input.rationale,
    affectedNodeIds: ["scripts[0]/statements[0]"],
    operations: [
      {
        type: "appendStatement",
        scriptIndex: 0,
        statement: { type: "move", steps: input.steps ?? 10 },
      },
    ],
  });
}

export {
  operationEditable,
  resolveOperationTargets,
  selectProposalOperations,
  type EditableField,
  type EditableValue,
  type OperationOverride,
  type OperationSelection,
} from "./selection.js";
