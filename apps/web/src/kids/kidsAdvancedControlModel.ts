import { recordCanonicalTransaction, type EditorHistory } from "@agorix/block-editor";
import {
  validateProgram,
  type Expression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";

export type ControlStage = "control" | "message";
export type ControlOperation = "atLeast" | "lessThan" | "random" | "wait";
export type MessageOperation = "send" | "oriReceive" | "friendReceive";
const MESSAGE = "go";

const number = (value: number): Expression => ({ type: "numericLiteral", value });
const score: Expression = { type: "variable", variableId: "score" };

export function controlStatement(
  operation: ControlOperation,
  first: number,
  second = 0,
): Statement {
  if (!Number.isInteger(first) || first < 0 || first > 100) throw new RangeError("first number");
  if (operation === "wait") {
    if (first > 10) throw new RangeError("wait seconds");
    return { type: "wait", seconds: first };
  }
  if (operation === "random") {
    if (!Number.isInteger(second) || second < first || second > 100)
      throw new RangeError("random bounds");
    return {
      type: "setVariable",
      variableId: "score",
      value: { type: "randomInteger", min: number(first), max: number(second) },
    };
  }
  return {
    type: "if",
    condition: {
      type: operation === "atLeast" ? "greaterOrEqual" : "lessThan",
      left: score,
      right: number(first),
    },
    then: [{ type: "setVariable", variableId: "score", value: number(1) }],
    else: [{ type: "setVariable", variableId: "score", value: number(2) }],
  };
}

export function messageStatement(operation: MessageOperation): Statement {
  return operation === "send"
    ? { type: "broadcast", message: MESSAGE }
    : { type: "move", steps: 1 };
}

function allowedControl(statement: Statement): boolean {
  if (statement.type === "wait")
    return Number.isInteger(statement.seconds) && statement.seconds <= 10;
  if (statement.type === "setVariable" && statement.value.type === "randomInteger") {
    const { min, max } = statement.value;
    return (
      statement.variableId === "score" &&
      min.type === "numericLiteral" &&
      max.type === "numericLiteral" &&
      Number.isInteger(min.value) &&
      Number.isInteger(max.value) &&
      min.value >= 0 &&
      min.value <= max.value &&
      max.value <= 100
    );
  }
  if (statement.type !== "if") return false;
  const { condition, then: yes, else: no } = statement;
  return (
    (condition.type === "greaterOrEqual" || condition.type === "lessThan") &&
    condition.left.type === "variable" &&
    condition.left.variableId === "score" &&
    condition.right.type === "numericLiteral" &&
    Number.isInteger(condition.right.value) &&
    condition.right.value >= 0 &&
    condition.right.value <= 100 &&
    JSON.stringify(yes) ===
      JSON.stringify([{ type: "setVariable", variableId: "score", value: number(1) }]) &&
    JSON.stringify(no) ===
      JSON.stringify([{ type: "setVariable", variableId: "score", value: number(2) }])
  );
}

export function validateControlStageProgram(
  input: ProjectProgram,
  stage: ControlStage,
): ProjectProgram {
  const program = validateProgram(input);
  if (stage === "control") {
    const script = program.scripts[0];
    if (
      program.scripts.length !== 1 ||
      script?.id !== "advanced-control" ||
      script.trigger.type !== "greenFlag" ||
      program.variables?.length !== 1 ||
      program.variables[0]?.id !== "score" ||
      program.variables[0].initialValue !== 0 ||
      program.variables[0].visible !== true ||
      (program.lists?.length ?? 0) !== 0 ||
      script.statements.some((statement) => !allowedControl(statement))
    )
      throw new RangeError("unsupported control program");
  } else {
    const [sender, ori, friend] = program.scripts;
    if (
      program.scripts.length !== 3 ||
      (program.variables?.length ?? 0) !== 0 ||
      (program.lists?.length ?? 0) !== 0 ||
      sender?.id !== "advanced-message" ||
      sender.trigger.type !== "greenFlag" ||
      sender.statements.some(
        (statement) => statement.type !== "broadcast" || statement.message !== MESSAGE,
      ) ||
      ori?.id !== "advanced-message-ori" ||
      ori.trigger.type !== "onMessage" ||
      ori.trigger.message !== MESSAGE ||
      ori.statements.some((statement) => statement.type !== "move" || statement.steps !== 1) ||
      friend?.id !== "advanced-message-friend" ||
      friend.trigger.type !== "onMessage" ||
      friend.trigger.message !== MESSAGE ||
      friend.statements.some((statement) => statement.type !== "move" || statement.steps !== 1)
    )
      throw new RangeError("unsupported message program");
  }
  return program;
}

export function addAdvancedOperation(
  history: EditorHistory,
  stage: ControlStage,
  operation: ControlOperation | MessageOperation,
  first = 0,
  second = 0,
): EditorHistory {
  const current = validateControlStageProgram(history.current, stage);
  const index =
    stage === "control" || operation === "send" ? 0 : operation === "oriReceive" ? 1 : 2;
  const statement =
    stage === "control"
      ? controlStatement(operation as ControlOperation, first, second)
      : messageStatement(operation as MessageOperation);
  const scripts = [...current.scripts];
  const script = scripts[index]!;
  scripts[index] = { ...script, statements: [...script.statements, statement] };
  const next = validateControlStageProgram({ ...current, scripts }, stage);
  return recordCanonicalTransaction(history, { label: `add ${operation}`, after: next }).history;
}

export function removeAdvancedOperation(
  history: EditorHistory,
  stage: ControlStage,
  scriptIndex: number,
  at: number,
): EditorHistory {
  const current = validateControlStageProgram(history.current, stage);
  const script = current.scripts[scriptIndex];
  if (!script || at < 0 || at >= script.statements.length) throw new RangeError("missing block");
  const scripts = [...current.scripts];
  scripts[scriptIndex] = { ...script, statements: script.statements.filter((_, i) => i !== at) };
  const next = validateControlStageProgram({ ...current, scripts }, stage);
  return recordCanonicalTransaction(history, { label: "remove block", after: next }).history;
}
