import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { acceptProposal, rejectProposal } from "@agorix/proposals";
import type { Finding } from "@agorix/run-evidence";
import { fixFor, proposeRunFix, reviewRunFix } from "./kidsRunFixes.js";
import { validateStudioProgram } from "./kidsStudioModel.js";

const program = (second: ProjectProgram["scripts"][number]["trigger"]): ProjectProgram =>
  validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [
      { id: "studio-actor-1-mika", trigger: { type: "greenFlag" }, statements: [{ type: "show" }] },
      { id: "studio-actor-2-nova", trigger: second, statements: [{ type: "hide" }] },
    ],
  });

const waiting: Finding = {
  id: "neverStarted:studio-actor-2-nova",
  kind: "neverStarted",
  actorId: "actor:studio-2-nova",
  nodeIds: ["scripts[1]"],
  counts: { senders: 0 },
  event: { type: "message", name: "hola", senders: 0 },
  confidence: 0.9,
};

describe("the fix Ori can offer for a message nobody sends", () => {
  const base = program({ type: "onMessage", message: "hola" });

  it("offers to send the message from the first green-flag character", () => {
    expect(fixFor(waiting, base)).toMatchObject({
      scriptIndex: 0,
      statement: { type: "broadcast", message: "hola" },
      actorId: "actor:studio-1-mika",
    });
  });

  it("offers nothing where the fix is not obvious", () => {
    expect(fixFor({ ...waiting, counts: { senders: 1 } }, base)).toBeNull();
    expect(fixFor({ ...waiting, event: { type: "key", name: "Space" } }, base)).toBeNull();
    expect(fixFor({ ...waiting, kind: "conditionNeverTrue" }, base)).toBeNull();
    const noFlag = program({ type: "onMessage", message: "hola" });
    const onlyKeys = validateStudioProgram({
      ...noFlag,
      scripts: noFlag.scripts.map((script, index) =>
        index === 0 ? { ...script, trigger: { type: "onActorClicked" } } : script,
      ),
    });
    expect(fixFor(waiting, onlyKeys)).toBeNull();
  });

  it("is a reviewable proposal that changes nothing until accepted", () => {
    const proposal = proposeRunFix(base, waiting, "es");
    const review = reviewRunFix(base, waiting, proposal);
    expect(proposal.source).toMatchObject({ kind: "learning-companion", capability: "builder" });
    expect(proposal.rationale).toContain("«hola»");
    expect(base.scripts[0]!.statements).toHaveLength(1);
    const accepted = acceptProposal(base, review).program;
    expect(accepted.scripts[0]!.statements.at(-1)).toEqual({ type: "broadcast", message: "hola" });
    expect(base.scripts[0]!.statements).toHaveLength(1);
    rejectProposal(base, review);
    expect(base.scripts[0]!.statements).toHaveLength(1);
  });

  it("refuses a proposal that is not exactly the fix for the finding", () => {
    const proposal = proposeRunFix(base, waiting, "en");
    const tampered = {
      ...proposal,
      operations: [
        { type: "appendStatement" as const, scriptIndex: 0, statement: { type: "hide" as const } },
      ],
    };
    expect(() => reviewRunFix(base, waiting, tampered)).toThrow();
    expect(() =>
      reviewRunFix(base, waiting, {
        ...proposal,
        source: { kind: "deterministic-scaffold", capability: "first-step" },
      }),
    ).toThrow();
  });
});
