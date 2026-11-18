import type { Expression, ProjectProgram, Statement } from "./schema.js";
import { PROCEDURE_MAX_CALL_DEPTH, REPEAT_UNTIL_MAX_PASSES } from "./limits.js";

export type ProgramFindingKind =
  | "loop-never-exits"
  | "loop-without-wait"
  | "shared-variable"
  | "shared-list"
  | "shared-position"
  | "performance-budget";

export interface ProgramFinding {
  readonly kind: ProgramFindingKind;
  /** Canonical node path; no learner text or runtime value is included. */
  readonly nodeId: string;
  /** A second canonical path for findings involving two scripts. */
  readonly relatedNodeId?: string;
}

function constantBoolean(expression: Expression): boolean | undefined {
  if (expression.type === "booleanLiteral") return expression.value;
  if (expression.type === "not") {
    const value = constantBoolean(expression.value);
    return value === undefined ? undefined : !value;
  }
  if (expression.type === "and" || expression.type === "or") {
    const left = constantBoolean(expression.left);
    const right = constantBoolean(expression.right);
    if (left === undefined || right === undefined) return undefined;
    return expression.type === "and" ? left && right : left || right;
  }
  return undefined;
}

function mayWait(statements: readonly Statement[]): boolean {
  return statements.some((statement) => {
    if (statement.type === "wait" || statement.type === "callProcedure") return true;
    if (statement.type === "repeat" || statement.type === "repeatUntil")
      return mayWait(statement.body);
    if (statement.type === "if") return mayWait(statement.then) || mayWait(statement.else ?? []);
    return false;
  });
}

function inspect(statements: readonly Statement[], prefix: string, out: ProgramFinding[]): void {
  statements.forEach((statement, index) => {
    const nodeId = `${prefix}[${index}]`;
    if (statement.type === "repeatUntil") {
      const condition = constantBoolean(statement.condition);
      if (condition === false) out.push({ kind: "loop-never-exits", nodeId });
      else if (condition === undefined && !mayWait(statement.body))
        out.push({ kind: "loop-without-wait", nodeId });
      inspect(statement.body, `${nodeId}/body`, out);
    } else if (statement.type === "repeat") {
      inspect(statement.body, `${nodeId}/body`, out);
    } else if (statement.type === "if") {
      inspect(statement.then, `${nodeId}/then`, out);
      if (statement.else !== undefined) inspect(statement.else, `${nodeId}/else`, out);
    }
  });
}

/** Conservative, pure review of canonical statements before runtime execution. */
export function analyzeProgramLoops(program: ProjectProgram): readonly ProgramFinding[] {
  const findings: ProgramFinding[] = [];
  program.scripts.forEach((script, index) => {
    inspect(script.statements, `scripts[${index}]/statements`, findings);
    script.procedures?.forEach((procedure, procedureIndex) =>
      inspect(procedure.body, `scripts[${index}]/procedures[${procedureIndex}]/body`, findings),
    );
  });
  return findings;
}

export interface ProgramAnalysisOptions {
  /** Runtime's statement budget, supplied by the caller. */
  readonly executionBudget: number;
  /** Trusted actor ownership; omitted legacy ownership leaves position findings out. */
  readonly actorByScriptId?: Readonly<Record<string, string>>;
}

interface Write {
  readonly resource: string;
  readonly nodeId: string;
}

function activationKey(
  program: ProjectProgram,
  scriptIndex: number,
  owners: Readonly<Record<string, string>>,
): string | undefined {
  const script = program.scripts[scriptIndex]!;
  const trigger = script.trigger;
  if (trigger.type === "onStart" || trigger.type === "greenFlag") return "greenFlag";
  if (trigger.type === "onMessage") return `message:${trigger.message}`;
  if (trigger.type === "onKeyPressed") return `key:${trigger.key}`;
  if (trigger.type === "onActorClicked" && owners[script.id] !== undefined)
    return `click:${owners[script.id]}`;
  return undefined;
}

function collectWrites(
  program: ProjectProgram,
  scriptIndex: number,
  statements: readonly Statement[],
  prefix: string,
  owner: string | undefined,
  visitedProcedures: ReadonlySet<string>,
  out: Write[],
): void {
  statements.forEach((statement, index) => {
    const nodeId = `${prefix}[${index}]`;
    switch (statement.type) {
      case "setVariable":
      case "changeVariable":
        out.push({ resource: `variable:${statement.variableId}`, nodeId });
        break;
      case "listAdd":
      case "listRemoveAt":
      case "listInsertAt":
      case "listReplaceAt":
        out.push({ resource: `list:${statement.listId}`, nodeId });
        break;
      case "move":
      case "goTo":
      case "glideTo":
      case "bounceOnEdge":
        if (owner !== undefined) out.push({ resource: `position:${owner}`, nodeId });
        break;
      case "repeat":
      case "repeatUntil":
        collectWrites(
          program,
          scriptIndex,
          statement.body,
          `${nodeId}/body`,
          owner,
          visitedProcedures,
          out,
        );
        break;
      case "if":
        collectWrites(
          program,
          scriptIndex,
          statement.then,
          `${nodeId}/then`,
          owner,
          visitedProcedures,
          out,
        );
        if (statement.else !== undefined)
          collectWrites(
            program,
            scriptIndex,
            statement.else,
            `${nodeId}/else`,
            owner,
            visitedProcedures,
            out,
          );
        break;
      case "callProcedure": {
        if (visitedProcedures.has(statement.procedureId)) break;
        const procedureIndex = program.scripts[scriptIndex]?.procedures?.findIndex(
          (procedure) => procedure.id === statement.procedureId,
        );
        if (procedureIndex === undefined || procedureIndex < 0) break;
        const procedure = program.scripts[scriptIndex]!.procedures![procedureIndex]!;
        collectWrites(
          program,
          scriptIndex,
          procedure.body,
          `scripts[${scriptIndex}]/procedures[${procedureIndex}]/body`,
          owner,
          new Set([...visitedProcedures, statement.procedureId]),
          out,
        );
        break;
      }
    }
  });
}

/** Possible shared writes only when two scripts can respond to the same event. */
export function analyzeProgramSharedWrites(
  program: ProjectProgram,
  actorByScriptId: Readonly<Record<string, string>> = {},
): readonly ProgramFinding[] {
  const groups = new Map<string, number[]>();
  program.scripts.forEach((_, index) => {
    const key = activationKey(program, index, actorByScriptId);
    if (key !== undefined) groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const writes = program.scripts.map((script, index) => {
    const out: Write[] = [];
    collectWrites(
      program,
      index,
      script.statements,
      `scripts[${index}]/statements`,
      actorByScriptId[script.id],
      new Set(),
      out,
    );
    return out;
  });
  const findings: ProgramFinding[] = [];
  for (const indices of groups.values()) {
    for (let left = 0; left < indices.length; left++) {
      for (let right = left + 1; right < indices.length; right++) {
        const first = writes[indices[left]!]!;
        const second = writes[indices[right]!]!;
        const seen = new Set<string>();
        for (const write of first) {
          if (seen.has(write.resource)) continue;
          const other = second.find((candidate) => candidate.resource === write.resource);
          if (other === undefined) continue;
          seen.add(write.resource);
          const kind = write.resource.startsWith("variable:")
            ? "shared-variable"
            : write.resource.startsWith("list:")
              ? "shared-list"
              : "shared-position";
          findings.push({ kind, nodeId: write.nodeId, relatedNodeId: other.nodeId });
        }
      }
    }
  }
  return findings;
}

function cappedAdd(left: number, right: number, cap: number): number {
  return Math.min(cap, left + right);
}

function estimateStatement(
  program: ProjectProgram,
  scriptIndex: number,
  statement: Statement,
  cap: number,
  depth: number,
): number {
  if (statement.type === "repeat")
    return cappedAdd(
      1,
      Math.min(
        cap,
        statement.count * estimateList(program, scriptIndex, statement.body, cap, depth),
      ),
      cap,
    );
  if (statement.type === "repeatUntil")
    return cappedAdd(
      1,
      Math.min(
        cap,
        REPEAT_UNTIL_MAX_PASSES * estimateList(program, scriptIndex, statement.body, cap, depth),
      ),
      cap,
    );
  if (statement.type === "if")
    return cappedAdd(
      1,
      Math.max(
        estimateList(program, scriptIndex, statement.then, cap, depth),
        estimateList(program, scriptIndex, statement.else ?? [], cap, depth),
      ),
      cap,
    );
  if (statement.type === "callProcedure") {
    if (depth >= PROCEDURE_MAX_CALL_DEPTH) return cap;
    const procedure = program.scripts[scriptIndex]?.procedures?.find(
      (candidate) => candidate.id === statement.procedureId,
    );
    return procedure === undefined
      ? 1
      : cappedAdd(1, estimateList(program, scriptIndex, procedure.body, cap, depth + 1), cap);
  }
  return 1;
}

function estimateList(
  program: ProjectProgram,
  scriptIndex: number,
  statements: readonly Statement[],
  cap: number,
  depth: number,
): number {
  return statements.reduce(
    (total, statement) =>
      cappedAdd(total, estimateStatement(program, scriptIndex, statement, cap, depth), cap),
    0,
  );
}

function costliestStatementPath(
  program: ProjectProgram,
  scriptIndex: number,
  cap: number,
): string | undefined {
  const statements = program.scripts[scriptIndex]?.statements ?? [];
  let bestIndex = -1;
  let bestCost = -1;
  statements.forEach((statement, index) => {
    const cost = estimateStatement(program, scriptIndex, statement, cap, 0);
    if (cost > bestCost) {
      bestCost = cost;
      bestIndex = index;
    }
  });
  return bestIndex < 0 ? undefined : `scripts[${scriptIndex}]/statements[${bestIndex}]`;
}

/** Conservative upper estimate of one event's block executions before the runtime budget. */
export function analyzeProgramBudget(
  program: ProjectProgram,
  executionBudget: number,
  actorByScriptId: Readonly<Record<string, string>> = {},
): readonly ProgramFinding[] {
  if (!Number.isSafeInteger(executionBudget) || executionBudget < 1) return [];
  const cap = executionBudget + 1;
  const groups = new Map<string, number[]>();
  program.scripts.forEach((_, index) => {
    const key = activationKey(program, index, actorByScriptId);
    if (key !== undefined) groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  const findings: ProgramFinding[] = [];
  for (const indices of groups.values()) {
    const costs = indices.map((index) => ({
      index,
      cost: estimateList(program, index, program.scripts[index]!.statements, cap, 0),
    }));
    const total = costs.reduce((sum, item) => cappedAdd(sum, item.cost, cap), 0);
    if (total <= executionBudget) continue;
    const ranked = [...costs].sort((a, b) => b.cost - a.cost || a.index - b.index);
    const first = ranked[0];
    if (first === undefined) continue;
    const nodeId = costliestStatementPath(program, first.index, cap);
    if (nodeId === undefined) continue;
    const relatedNodeId =
      ranked[1] === undefined ? undefined : costliestStatementPath(program, ranked[1].index, cap);
    findings.push({
      kind: "performance-budget",
      nodeId,
      ...(relatedNodeId === undefined ? {} : { relatedNodeId }),
    });
  }
  return findings;
}

export function analyzeProgramBeforePlay(
  program: ProjectProgram,
  options: ProgramAnalysisOptions,
): readonly ProgramFinding[] {
  return [
    ...analyzeProgramLoops(program),
    ...analyzeProgramSharedWrites(program, options.actorByScriptId),
    ...analyzeProgramBudget(program, options.executionBudget, options.actorByScriptId),
  ].slice(0, 100);
}
