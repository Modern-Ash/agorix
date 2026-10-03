import { projectProgram, type ProjectionResult, type TextRange } from "@agorix/code-generator";
import { semanticProjectHash } from "@agorix/persistence";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
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
  readonly affectedNodeIds: readonly string[];
  readonly operations: readonly ProposalOperation[];
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
  readonly affectedNodeIds: readonly string[];
  readonly baseProgramHash: string;
  readonly resultProgramHash: string;
}

export interface ProposalDecisionResult {
  readonly program: ProjectProgram;
  readonly audit: ProposalAuditEvent;
}

export interface WebProposalCardView {
  readonly proposalId: string;
  readonly title: string;
  readonly rationale: string;
  readonly affectedNodeIds: readonly string[];
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
  readonly affectedRanges: readonly TextRange[];
  readonly changes: readonly ProposalDiffEntry[];
  readonly acceptedCode: string;
  readonly proposedCode: string;
}

type MutableProjectProgram = {
  schema: ProjectProgram["schema"];
  scripts: Array<{
    id: string;
    trigger: ProjectProgram["scripts"][number]["trigger"];
    statements: Statement[];
  }>;
};

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
    affectedNodeIds: input.affectedNodeIds,
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
    "affectedNodeIds",
    "operations",
  ]);
  if (proposal.schema !== PROGRAM_PROPOSAL_SCHEMA_VERSION) {
    fail("INVALID_PROPOSAL", "$.schema", `expected ${PROGRAM_PROPOSAL_SCHEMA_VERSION}`);
  }
  assertBoundedString(proposal.id, "$.id", 1, 120);
  assertBoundedString(proposal.baseProgramHash, "$.baseProgramHash", 1, 120);
  assertSource(proposal.source);
  assertBoundedString(proposal.purpose, "$.purpose", 1, 240);
  assertBoundedString(proposal.rationale, "$.rationale", 1, 800);
  assertStringArray(proposal.affectedNodeIds, "$.affectedNodeIds");
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
  const candidate = validateProgram(applyProposalOperations(accepted, proposal));
  const acceptedProjection = projectProgram(accepted);
  const proposedProjection = projectProgram(candidate);
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
    affectedNodeIds: review.proposal.affectedNodeIds,
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
    affectedRanges: review.affectedRanges,
    changes: review.diff,
    acceptedCode: review.acceptedProjection.code,
    proposedCode: review.proposedProjection.code,
  };
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

function createAuditEvent(
  proposal: ProgramProposal,
  decision: ProposalAuditEvent["decision"],
  resultProgram: ProjectProgram,
): ProposalAuditEvent {
  return {
    schema: "agorix/proposal-audit/v1",
    proposalId: proposal.id,
    decision,
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
      validateProgram({
        schema: "agorix/program/v1",
        scripts: [{ id: "probe", trigger: { type: "onStart" }, statements: [operation.statement] }],
      });
      return;
    case "replaceStatement":
      assertAllowedKeys(operation, path, ["type", "nodeId", "statement"]);
      assertBoundedString(operation.nodeId, `${path}.nodeId`, 1, 160);
      validateProgram({
        schema: "agorix/program/v1",
        scripts: [{ id: "probe", trigger: { type: "onStart" }, statements: [operation.statement] }],
      });
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

function assertStringArray(value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    fail("INVALID_PROPOSAL", path, "expected string array");
  }
  value.forEach((item, index) => assertBoundedString(item, `${path}[${index}]`, 1, 160));
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
