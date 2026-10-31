import { describe, expect, it } from "vitest";
import { acceptProposal } from "@agorix/proposals";
import { createEditorHistory } from "@agorix/block-editor";
import { runMultiActorProgram } from "@agorix/runtime";
import type { Statement } from "@agorix/program-model";
import {
  appendStudioStatement,
  createStudioProgram,
  creativeForStudio,
  validateStudioProgram,
} from "./kidsStudioModel.js";
import {
  diagnoseLoop,
  explainTrigger,
  proposeForeverExit,
  reviewForeverExit,
} from "./kidsOriLoopDebug.js";

const NOVA = "actor:studio-1-nova";

function programWith(...statements: Statement[]) {
  let history = createEditorHistory(createStudioProgram("nova"));
  for (const statement of statements) history = appendStudioStatement(history, NOVA, statement);
  return validateStudioProgram(history.current);
}
const run = (program: ReturnType<typeof programWith>) =>
  runMultiActorProgram(program, creativeForStudio(program, "forest", "es"));

describe("Ori and the loop that does not end (issue #1132)", () => {
  it("finds a forever that the runtime cut off, from the trace", () => {
    const program = programWith({ type: "forever", body: [{ type: "turn", degrees: 90 }] });
    const result = run(program);
    expect(result.outcome).toBe("budget-exceeded");
    const diagnosis = diagnoseLoop(program, result, NOVA, "es");
    expect(diagnosis?.kind).toBe("forever");
    expect(diagnosis?.evidence[0]).toContain("Por siempre");
  });

  it("finds a repeat-until whose condition never became true", () => {
    const program = programWith({
      type: "repeatUntil",
      condition: { type: "mouseDown" },
      body: [{ type: "turn", degrees: 90 }],
    });
    const diagnosis = diagnoseLoop(program, run(program), NOVA, "en");
    expect(diagnosis?.kind).toBe("repeatUntil");
    expect(diagnosis?.evidence[0]).toContain("always said");
  });

  it("finds a wait-until that timed out", () => {
    const program = programWith({ type: "waitUntil", condition: { type: "mouseDown" } });
    expect(diagnoseLoop(program, run(program), NOVA, "es")?.kind).toBe("waitUntil");
  });

  it("says nothing about a program that ended normally", () => {
    const program = programWith({ type: "move", steps: 40 });
    expect(diagnoseLoop(program, run(program), NOVA, "es")).toBeNull();
  });

  it("offers a visible exit for forever; accepting adds it, and a stale or tampered one is refused", () => {
    const program = programWith({ type: "forever", body: [{ type: "move", steps: 40 }] });
    const diagnosis = diagnoseLoop(program, run(program), NOVA, "es")!;
    const proposal = proposeForeverExit(program, diagnosis, "es");
    expect(JSON.stringify(program)).not.toContain('"stop"');
    const review = reviewForeverExit(program, diagnosis, proposal);
    const accepted = validateStudioProgram(acceptProposal(program, review).program);
    expect(JSON.stringify(accepted.scripts[0]!.statements[0])).toContain('"stop"');
    expect(run(accepted).outcome).not.toBe("budget-exceeded");
    const other = programWith({ type: "forever", body: [{ type: "turn", degrees: 90 }] });
    expect(() => reviewForeverExit(other, diagnosis, proposal)).toThrow();
    const tampered = {
      ...proposal,
      operations: [{ ...proposal.operations[0]!, statement: { type: "hide" as const } }],
    } as typeof proposal;
    expect(() => reviewForeverExit(program, diagnosis, tampered)).toThrow();
  });

  it("explains when a script starts", () => {
    expect(explainTrigger({ type: "onKeyPressed", key: "Space" }, "es")).toContain("Space");
    expect(explainTrigger({ type: "onMessage", message: "hola" }, "en")).toContain("hola");
    expect(explainTrigger({ type: "onStart" }, "en")).toContain("Play");
  });
});
