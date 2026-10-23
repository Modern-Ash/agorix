import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";

export type ScoreStatement = Extract<Statement, { type: "setVariable" | "changeVariable" }>;

export function scoreStatements(program: ProjectProgram): readonly ScoreStatement[] {
  return (
    program.scripts[0]?.statements.filter(
      (item): item is ScoreStatement =>
        item.type === "setVariable" || item.type === "changeVariable",
    ) ?? []
  );
}

function checked(program: ProjectProgram) {
  const valid = validateProgram(program);
  const script = valid.scripts[0];
  if (
    valid.scripts.length !== 1 ||
    script?.id !== "advanced-score" ||
    script.trigger.type !== "greenFlag" ||
    valid.variables?.length !== 1 ||
    valid.variables[0]?.id !== "score" ||
    valid.variables[0].visible !== true
  )
    throw new RangeError("invalid score project");
  return { valid, script };
}

export function editScoreStatements(
  history: EditorHistory,
  label: string,
  update: (items: readonly Statement[]) => readonly Statement[],
): EditorHistory {
  const { valid, script } = checked(history.current);
  const next = validateProgram({
    ...valid,
    scripts: [{ ...script, statements: [...update(script.statements)] }],
  });
  return recordCanonicalTransaction(history, { label, after: next }).history;
}

export type ScoreArithmeticOp = "add" | "subtract";

/** `score = score + n` or `score = score - n`, the only arithmetic the guided stage offers. */
export function scoreArithmeticStatement(op: ScoreArithmeticOp, amount: number): ScoreStatement {
  return {
    type: "setVariable",
    variableId: "score",
    value: {
      type: op,
      left: { type: "variable", variableId: "score" },
      right: { type: "numericLiteral", value: amount },
    },
  };
}

export function scoreArithmetic(
  statement: ScoreStatement,
): { readonly op: ScoreArithmeticOp; readonly amount: number } | null {
  if (statement.type !== "setVariable") return null;
  const { value } = statement;
  if (
    (value.type === "add" || value.type === "subtract") &&
    value.left.type === "variable" &&
    value.left.variableId === "score" &&
    value.right.type === "numericLiteral" &&
    Number.isInteger(value.right.value) &&
    value.right.value >= 1 &&
    value.right.value <= 5
  ) {
    return { op: value.type, amount: value.right.value };
  }
  return null;
}

export function addScoreStatement(
  history: EditorHistory,
  statement: ScoreStatement,
): EditorHistory {
  if (statement.variableId !== "score") throw new RangeError("unknown variable");
  if (scoreArithmetic(statement) !== null) {
    return editScoreStatements(history, "add score arithmetic", (items) => [...items, statement]);
  }
  const expression = statement.type === "setVariable" ? statement.value : statement.delta;
  if (
    expression.type !== "numericLiteral" ||
    !Number.isInteger(expression.value) ||
    expression.value < (statement.type === "setVariable" ? 0 : 1) ||
    expression.value > (statement.type === "setVariable" ? 10 : 3)
  )
    throw new RangeError("unsupported score value");
  return editScoreStatements(history, `add ${statement.type}`, (items) => [...items, statement]);
}

export function removeScoreStatement(history: EditorHistory, index: number): EditorHistory {
  const { script } = checked(history.current);
  if (index < 0 || index >= script.statements.length) throw new RangeError("missing score block");
  return editScoreStatements(history, "remove score block", (items) =>
    items.filter((_, at) => at !== index),
  );
}
