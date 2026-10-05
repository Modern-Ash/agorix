import type { ProjectProgram, Statement } from "@agorix/program-model";
import { ProposalValidationError, type ProgramProposal, type ProposalOperation } from "./index.js";

export type EditableField = "steps" | "degrees" | "count";

export interface EditableValue {
  readonly field: EditableField;
  readonly value: number;
}

export interface OperationOverride {
  readonly index: number;
  readonly value: number;
}

export interface OperationSelection {
  readonly include: readonly number[];
  readonly overrides?: readonly OperationOverride[];
}

function editableOfStatement(statement: Statement): EditableValue | undefined {
  switch (statement.type) {
    case "move":
      return { field: "steps", value: statement.steps };
    case "turn":
      return { field: "degrees", value: statement.degrees };
    case "repeat":
      return { field: "count", value: statement.count };
    default:
      return undefined;
  }
}

/** The numeric field a learner may edit on an operation, or undefined when it has none. */
export function operationEditable(operation: ProposalOperation): EditableValue | undefined {
  switch (operation.type) {
    case "appendStatement":
    case "replaceStatement":
      return editableOfStatement(operation.statement);
    case "replaceStatementField":
      return { field: operation.field, value: operation.value };
    case "removeStatement":
      return undefined;
  }
}

function withValue(statement: Statement, field: EditableField, value: number): Statement {
  return { ...statement, [field]: value } as unknown as Statement;
}

function applyOverride(
  operation: ProposalOperation,
  override: OperationOverride,
  path: string,
): ProposalOperation {
  if (!Number.isInteger(override.value)) {
    throw new ProposalValidationError("INVALID_PROPOSAL", path, "expected an integer value");
  }
  const editable = operationEditable(operation);
  if (editable === undefined) {
    throw new ProposalValidationError("INVALID_PROPOSAL", path, "operation has no editable field");
  }
  if (operation.type === "replaceStatementField") {
    return { ...operation, value: override.value };
  }
  if (operation.type === "appendStatement" || operation.type === "replaceStatement") {
    return {
      ...operation,
      statement: withValue(operation.statement, editable.field, override.value),
    };
  }
  return operation;
}

/**
 * Narrows a proposal to the chosen operations, optionally editing numeric values.
 * The result keeps the same base hash and must still be reviewed (validated) before it applies.
 * Returns undefined for an empty selection, which callers treat as a rejection.
 */
export function selectProposalOperations(
  proposal: ProgramProposal,
  selection: OperationSelection,
): ProgramProposal | undefined {
  const chosen = [...new Set(selection.include)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < proposal.operations.length)
    .sort((a, b) => a - b);
  const overrides = new Map((selection.overrides ?? []).map((o) => [o.index, o]));
  for (const index of overrides.keys()) {
    if (chosen.length > 0 && !chosen.includes(index)) {
      throw new ProposalValidationError(
        "INVALID_PROPOSAL",
        `$.overrides[${index}]`,
        "override targets an operation that is not selected",
      );
    }
  }
  if (chosen.length === 0) {
    return undefined;
  }
  const operations = chosen.map((index) => {
    const operation = proposal.operations[index] as ProposalOperation;
    const override = overrides.get(index);
    return override === undefined
      ? operation
      : applyOverride(operation, override, `$.overrides[${index}]`);
  });
  return { ...proposal, id: `${proposal.id}:selection`, operations };
}

const TOP_LEVEL = /^scripts\[(\d+)\]\/statements\[(\d+)\]$/;

/**
 * For each operation, the original (base program) node it touches, or undefined for
 * appends and nested paths. Simulates index shifting so repeated removals resolve correctly.
 */
export function resolveOperationTargets(
  program: ProjectProgram,
  proposal: ProgramProposal,
): (string | undefined)[] {
  const lists = program.scripts.map((script, scriptIndex) =>
    script.statements.map((_, index) => `scripts[${scriptIndex}]/statements[${index}]`),
  );
  const placeholder = undefined;
  const live: (string | undefined)[][] = lists.map((list) => [...list]);
  return proposal.operations.map((operation) => {
    if (operation.type === "appendStatement") {
      live[operation.scriptIndex]?.push(placeholder);
      return undefined;
    }
    const match = TOP_LEVEL.exec(operation.nodeId);
    if (match === null) return undefined;
    const list = live[Number(match[1])];
    const index = Number(match[2]);
    const target = list?.[index];
    if (operation.type === "removeStatement") {
      list?.splice(index, 1);
    }
    return target;
  });
}
