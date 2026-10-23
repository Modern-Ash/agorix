import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  NUMERIC_LITERAL_MAX,
  NUMERIC_LITERAL_MIN,
  validateProgram,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";

export type ScoreStatement = Extract<Statement, { type: "setVariable" | "changeVariable" }>;
export const SCORE_LIST_ID = "items";
export type ScoreListOperation = "add" | "remove" | "item" | "length";

/** The visual stack uses exactly the canonical script order. */
export function scoreDataStatements(program: ProjectProgram): readonly Statement[] {
  return program.scripts[0]?.statements ?? [];
}

export function scoreStatements(program: ProjectProgram): readonly ScoreStatement[] {
  return (
    program.scripts[0]?.statements.filter(
      (item): item is ScoreStatement =>
        item.type === "setVariable" || item.type === "changeVariable",
    ) ?? []
  );
}

function scoreStatementAllowed(statement: Statement): boolean {
  if (statement.type === "changeVariable")
    return (
      statement.variableId === "score" &&
      statement.delta.type === "numericLiteral" &&
      Number.isInteger(statement.delta.value) &&
      statement.delta.value >= 1 &&
      statement.delta.value <= 3
    );
  if (statement.type !== "setVariable" || statement.variableId !== "score") return false;
  if (statement.value.type === "listLength") return statement.value.listId === SCORE_LIST_ID;
  if (statement.value.type === "listItem")
    return (
      statement.value.listId === SCORE_LIST_ID &&
      statement.value.index.type === "numericLiteral" &&
      Number.isInteger(statement.value.index.value)
    );
  if (scoreArithmetic(statement)) return true;
  return (
    statement.value.type === "numericLiteral" &&
    Number.isInteger(statement.value.value) &&
    statement.value.value >= 0 &&
    statement.value.value <= 10
  );
}

export function validateScoreDataProgram(program: ProjectProgram): ProjectProgram {
  const valid = validateProgram(program);
  const script = valid.scripts[0];
  const list = valid.lists?.[0];
  if (
    valid.scripts.length !== 1 ||
    script?.id !== "advanced-score" ||
    script.trigger.type !== "greenFlag" ||
    valid.variables?.length !== 1 ||
    valid.variables[0]?.id !== "score" ||
    valid.variables[0].initialValue !== 0 ||
    valid.variables[0].visible !== true ||
    (valid.lists !== undefined &&
      (valid.lists.length !== 1 || list?.id !== SCORE_LIST_ID || list.visible !== true)) ||
    script.statements.some((statement) =>
      statement.type === "listAdd"
        ? !list ||
          statement.listId !== SCORE_LIST_ID ||
          statement.value.type !== "numericLiteral" ||
          !Number.isInteger(statement.value.value)
        : statement.type === "listRemoveAt"
          ? !list ||
            statement.listId !== SCORE_LIST_ID ||
            statement.index.type !== "numericLiteral" ||
            !Number.isInteger(statement.index.value)
          : !scoreStatementAllowed(statement) ||
            (statement.type === "setVariable" &&
              (statement.value.type === "listItem" || statement.value.type === "listLength") &&
              !list),
    )
  )
    throw new RangeError("invalid score project");
  return valid;
}

function checked(program: ProjectProgram) {
  const valid = validateScoreDataProgram(program);
  return { valid, script: valid.scripts[0]! };
}

export function createScoreList(history: EditorHistory, locale: "es" | "en" = "es") {
  const { valid } = checked(history.current);
  if (valid.lists?.length) return history;
  const next = validateScoreDataProgram({
    ...valid,
    lists: [
      {
        id: SCORE_LIST_ID,
        name: locale === "es" ? "Mi lista" : "My list",
        initialItems: [],
        visible: true,
      },
    ],
  });
  return recordCanonicalTransaction(history, { label: "create score list", after: next }).history;
}

export function addScoreListOperation(
  history: EditorHistory,
  operation: ScoreListOperation,
  value: number,
): EditorHistory {
  const { valid } = checked(history.current);
  if (!valid.lists?.some((list) => list.id === SCORE_LIST_ID))
    throw new RangeError("missing score list");
  if (!Number.isInteger(value) || value < NUMERIC_LITERAL_MIN || value > NUMERIC_LITERAL_MAX)
    throw new RangeError("invalid list number");
  const literal = { type: "numericLiteral" as const, value };
  const statement: Statement =
    operation === "add"
      ? { type: "listAdd", listId: SCORE_LIST_ID, value: literal }
      : operation === "remove"
        ? { type: "listRemoveAt", listId: SCORE_LIST_ID, index: literal }
        : operation === "item"
          ? {
              type: "setVariable",
              variableId: "score",
              value: { type: "listItem", listId: SCORE_LIST_ID, index: literal },
            }
          : {
              type: "setVariable",
              variableId: "score",
              value: { type: "listLength", listId: SCORE_LIST_ID },
            };
  return editScoreStatements(history, `add list ${operation}`, (items) => [...items, statement]);
}

export function editScoreStatements(
  history: EditorHistory,
  label: string,
  update: (items: readonly Statement[]) => readonly Statement[],
): EditorHistory {
  const { valid, script } = checked(history.current);
  const next = validateScoreDataProgram({
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
