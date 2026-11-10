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

describe("the fix Ori can offer for a character that ends hidden", () => {
  const base = program({ type: "onMessage", message: "hola" });
  const hidden: Finding = {
    id: "hiddenCharacter:actor:studio-2-nova",
    kind: "hiddenCharacter",
    actorId: "actor:studio-2-nova",
    nodeIds: ["scripts[1]/statements[0]"],
    counts: { actions: 2 },
    traceIndex: 0,
    confidence: 0.8,
  };
  it("offers to show it again at the end of the script that hid it", () => {
    expect(fixFor(hidden, base)).toMatchObject({
      scriptIndex: 1,
      statement: { type: "show" },
      actorId: "actor:studio-2-nova",
    });
    const proposal = proposeRunFix(base, hidden, "es");
    expect(proposal.rationale).toContain("«Mostrar»");
    const accepted = acceptProposal(base, reviewRunFix(base, hidden, proposal)).program;
    expect(accepted.scripts[1]!.statements.at(-1)).toEqual({ type: "show" });
    expect(base.scripts[1]!.statements).toHaveLength(1);
  });
  it("offers nothing without a place to put it", () => {
    expect(fixFor({ ...hidden, nodeIds: [] }, base)).toBeNull();
  });
});

describe("the fix Ori can offer for blocks written out in a row", () => {
  const move = { type: "move", steps: 40 } as const;
  const turn = { type: "turn", degrees: 90 } as const;
  const withStatements = (statements: ProjectProgram["scripts"][number]["statements"]) =>
    validateStudioProgram({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "studio-actor-1-mika", trigger: { type: "greenFlag" }, statements }],
    });
  const finding = (start: number, period: number, times: number): Finding => ({
    id: `repeatedBlocks:scripts[0]/statements[${start}]`,
    kind: "repeatedBlocks",
    actorId: "actor:studio-1-mika",
    nodeIds: [`scripts[0]/statements[${start}]`],
    counts: { period, times },
    confidence: 0.62,
  });

  it("puts a run of three into one repeat of three, and changes nothing until accepted", () => {
    const program = withStatements([move, move, move]);
    const proposal = proposeRunFix(program, finding(0, 1, 3), "es");
    expect(proposal.rationale).toContain("«Repetir»");
    const accepted = acceptProposal(program, reviewRunFix(program, finding(0, 1, 3), proposal));
    expect(accepted.program.scripts[0]!.statements).toEqual([
      { type: "repeat", count: 3, body: [move] },
    ]);
    expect(program.scripts[0]!.statements).toHaveLength(3);
  });

  it("keeps a leftover copy when the run is not a count the repeat block holds", () => {
    const program = withStatements([turn, move, move, move, move]);
    const accepted = acceptProposal(
      program,
      reviewRunFix(program, finding(1, 1, 4), proposeRunFix(program, finding(1, 1, 4), "es")),
    ).program;
    expect(accepted.scripts[0]!.statements).toEqual([
      turn,
      { type: "repeat", count: 3, body: [move] },
      move,
    ]);
  });

  it("repeats a group of two or three blocks, up to five times", () => {
    const program = withStatements([move, turn, move, turn, move, turn, move, turn, move, turn]);
    const accepted = acceptProposal(
      program,
      reviewRunFix(program, finding(0, 2, 5), proposeRunFix(program, finding(0, 2, 5), "en")),
    ).program;
    expect(accepted.scripts[0]!.statements).toEqual([
      { type: "repeat", count: 5, body: [move, turn] },
    ]);
  });

  it("offers nothing if the run is not really there, or for blocks that are apart", () => {
    const program = withStatements([move, move, turn]);
    expect(fixFor(finding(0, 1, 3), program)).toBeNull();
    expect(fixFor({ ...finding(0, 1, 3), kind: "repeatedApart" }, program)).toBeNull();
    expect(fixFor({ ...finding(0, 4, 3) }, withStatements([move, move, move]))).toBeNull();
  });

  it("refuses a proposal that is not exactly the fix", () => {
    const program = withStatements([move, move, move]);
    const proposal = proposeRunFix(program, finding(0, 1, 3), "es");
    expect(() =>
      reviewRunFix(program, finding(0, 1, 3), {
        ...proposal,
        operations: proposal.operations.slice(0, 2),
      }),
    ).toThrow();
  });
});

describe("the shared block Ori proposes for blocks repeated apart", () => {
  const move = { type: "move", steps: 20 } as const;
  const turn = { type: "turn", degrees: 90 } as const;
  const pause = { type: "wait", seconds: 1 } as const;
  const base = validateStudioProgram({
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "studio-actor-1-mika",
        trigger: { type: "greenFlag" },
        statements: [move, turn, pause, move, turn, pause, move, turn],
      },
    ],
  });
  const finding: Finding = {
    id: "repeatedApart:scripts[0]/statements[0]",
    kind: "repeatedApart",
    actorId: "actor:studio-1-mika",
    nodeIds: ["scripts[0]/statements[0]"],
    counts: { period: 2, times: 3 },
    confidence: 0.62,
  };

  it("previews a shared body and all call replacements before acceptance", () => {
    const proposal = proposeRunFix(base, finding, "es");
    expect(proposal.operations[0]).toMatchObject({
      type: "addSharedProcedure",
      procedure: { id: "shared-1", body: [move, turn] },
    });
    expect(proposal.operations.filter((item) => item.type === "replaceStatement")).toHaveLength(3);
    expect(base.sharedProcedures).toBeUndefined();
    const review = reviewRunFix(base, finding, proposal);
    const accepted = acceptProposal(base, review).program;
    expect(accepted.sharedProcedures?.[0]?.body).toEqual([move, turn]);
    expect(accepted.scripts[0]?.statements).toEqual([
      { type: "callProcedure", procedureId: "shared-1" },
      pause,
      { type: "callProcedure", procedureId: "shared-1" },
      pause,
      { type: "callProcedure", procedureId: "shared-1" },
    ]);
    rejectProposal(base, review);
    expect(base.sharedProcedures).toBeUndefined();
  });

  it("rejects stale or altered sharing proposals and invalid findings", () => {
    const proposal = proposeRunFix(base, finding, "en");
    expect(() =>
      reviewRunFix(base, finding, { ...proposal, operations: proposal.operations.slice(1) }),
    ).toThrow();
    expect(() =>
      reviewRunFix(
        {
          ...base,
          scripts: [{ ...base.scripts[0]!, statements: [pause, ...base.scripts[0]!.statements] }],
        },
        finding,
        proposal,
      ),
    ).toThrow();
    expect(fixFor({ ...finding, counts: { period: 3, times: 3 } }, base)).toBeNull();
  });
});
