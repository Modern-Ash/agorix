import type { Expression, ProjectProgram, Statement } from "./schema.js";

export type ProgramFindingKind = "loop-never-exits" | "loop-without-wait";

export interface ProgramFinding {
  readonly kind: ProgramFindingKind;
  /** Canonical node path; no learner text or runtime value is included. */
  readonly nodeId: string;
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
