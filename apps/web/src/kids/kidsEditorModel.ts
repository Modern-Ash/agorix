import {
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
  type EditorHistory,
} from "@agorix/block-editor";
import {
  evaluateKidsGoalRun,
  kidsMoveSteps,
  type KidsGoalCheck,
  type KidsRunEvaluation,
} from "@agorix/curriculum";
import type { MissionDefinition } from "@agorix/curriculum";
import { validateProgram, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram, type RunResult } from "@agorix/runtime";

export type KidsBlockKind = "move" | "turnL" | "turnR" | "repeat" | "sound";
export type KidsEditor = EditorHistory;

export function createKidsEditor(mission: MissionDefinition): KidsEditor {
  return createEditorHistory(mission.starterProject);
}

export function kidsStatement(kind: KidsBlockKind): Statement {
  switch (kind) {
    case "move":
      return { type: "move", steps: kidsMoveSteps(1) };
    case "turnL":
      return { type: "turn", degrees: -90 };
    case "turnR":
      return { type: "turn", degrees: 90 };
    case "repeat":
      return { type: "repeat", count: 2, body: [] };
    case "sound":
      return { type: "playSound", soundId: "kids-tone" };
  }
}

function edit(
  history: KidsEditor,
  label: string,
  change: (statements: Statement[]) => Statement[],
): KidsEditor {
  const program = history.current;
  const script = program.scripts[0];
  if (script === undefined) return history;
  const after: ProjectProgram = validateProgram({
    ...program,
    scripts: [
      { ...script, statements: change([...script.statements]) },
      ...program.scripts.slice(1),
    ],
  });
  return recordCanonicalTransaction(history, { label, after }).history;
}

export function addKidsBlock(
  history: KidsEditor,
  kind: KidsBlockKind,
  repeatIndex?: number,
): KidsEditor {
  return edit(history, `add ${kind}`, (statements) => {
    if (repeatIndex === undefined) return [...statements, kidsStatement(kind)];
    const repeat = statements[repeatIndex];
    if (repeat?.type !== "repeat") return statements;
    statements[repeatIndex] = { ...repeat, body: [...repeat.body, kidsStatement(kind)] };
    return statements;
  });
}

export function removeKidsBlock(
  history: KidsEditor,
  index: number,
  childIndex?: number,
): KidsEditor {
  return edit(history, "remove block", (statements) => {
    if (childIndex === undefined) return statements.filter((_, at) => at !== index);
    const repeat = statements[index];
    if (repeat?.type !== "repeat") return statements;
    statements[index] = { ...repeat, body: repeat.body.filter((_, at) => at !== childIndex) };
    return statements;
  });
}

export function setKidsBlockNumber(
  history: KidsEditor,
  index: number,
  value: number,
  childIndex?: number,
): KidsEditor {
  if (!Number.isInteger(value)) return history;
  return edit(history, "change block number", (statements) => {
    const parent = statements[index];
    const block =
      childIndex === undefined
        ? parent
        : parent?.type === "repeat"
          ? parent.body[childIndex]
          : undefined;
    if (block === undefined) return statements;
    let replacement: Statement;
    if (block.type === "move" && value >= 1 && value <= 5) {
      replacement = { ...block, steps: kidsMoveSteps(value) };
    } else if (block.type === "repeat" && value >= 2 && value <= 6) {
      replacement = { ...block, count: value };
    } else return statements;
    if (childIndex === undefined) statements[index] = replacement;
    else if (parent?.type === "repeat") {
      statements[index] = {
        ...parent,
        body: parent.body.map((item, at) => (at === childIndex ? replacement : item)),
      };
    }
    return statements;
  });
}

export function undoKidsEdit(history: KidsEditor): KidsEditor {
  return undoCanonicalTransaction(history).history;
}

export function redoKidsEdit(history: KidsEditor): KidsEditor {
  return redoCanonicalTransaction(history).history;
}

export interface KidsPlayedRun {
  readonly result: RunResult;
  readonly evaluation: KidsRunEvaluation;
}

export function playKidsProgram(
  history: KidsEditor,
  mission: MissionDefinition,
  check: KidsGoalCheck = "touches-goal",
): KidsPlayedRun {
  const result = runProgram(history.current, createWorldState(mission.starterStage));
  return { result, evaluation: evaluateKidsGoalRun(mission, result, check) };
}
