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

export function addScoreStatement(
  history: EditorHistory,
  statement: ScoreStatement,
): EditorHistory {
  if (statement.variableId !== "score") throw new RangeError("unknown variable");
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
