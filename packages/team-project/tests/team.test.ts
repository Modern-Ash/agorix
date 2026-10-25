import { describe, expect, it } from "vitest";
import { programSemanticHash } from "@agorix/proposals";
import { TeamError } from "../src/index.js";
import { baseProgram, build, moveProposal } from "./support.js";

function code(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    if (error instanceof TeamError) return error.code;
    throw error;
  }
  return "OK";
}

/** Team vote that applies a change: two of the three other members accept. */
function applyByTeam(
  session: ReturnType<typeof build>["session"],
  changeId: string,
  proposer = "slt_a",
) {
  for (const slot of ["slt_a", "slt_b", "slt_c", "slt_d"]
    .filter((s) => s !== proposer)
    .slice(0, 2)) {
    session.vote(slot, changeId, "accept");
  }
}

describe("turn mode", () => {
  it("only the member whose turn it is can propose; testers never can", () => {
    const { session } = build();
    expect(session.turn()).toBe("slt_a");
    expect(code(() => session.submit("slt_b", moveProposal("p1")))).toBe("NOT_YOUR_TURN");
    expect(code(() => session.submit("slt_d", moveProposal("p1")))).toBe("CANNOT_EDIT");
    expect(code(() => session.submit("slt_x", moveProposal("p1")))).toBe("NOT_A_MEMBER");
    expect(code(() => session.submit("slt_a", moveProposal("p1")))).toBe("OK");
  });

  it("passes the turn on pass, after a decided change, and skips testers", () => {
    const { session } = build();
    session.passTurn("slt_a");
    expect(session.turn()).toBe("slt_b");
    session.submit("slt_b", moveProposal("p1"));
    applyByTeam(session, "p1", "slt_b");
    expect(session.turn()).toBe("slt_c");
    session.passTurn("slt_c");
    expect(session.turn()).toBe("slt_a");
    expect(code(() => session.passTurn("slt_b"))).toBe("NOT_YOUR_TURN");
  });
});

describe("block mode", () => {
  const mode = {
    kind: "blocks" as const,
    assignments: { "explorer-script": "slt_a", "beacon-script": "slt_b" },
  };

  it("lets a member change only the scripts assigned to them, in any order", () => {
    const { session } = build({ mode });
    expect(code(() => session.submit("slt_b", moveProposal("p1", baseProgram, 0)))).toBe(
      "SCOPE_VIOLATION",
    );
    expect(code(() => session.submit("slt_a", moveProposal("p1", baseProgram, 1)))).toBe(
      "SCOPE_VIOLATION",
    );
    expect(code(() => session.submit("slt_b", moveProposal("p2", baseProgram, 1)))).toBe("OK");
    expect(code(() => session.submit("slt_c", moveProposal("p3", baseProgram, 0)))).toBe(
      "SCOPE_VIOLATION",
    );
  });

  it("rejects a proposal that does not declare which scripts it touches", () => {
    const { session } = build({ mode });
    const proposal = { ...moveProposal("p1"), affectedScriptIds: undefined };
    expect(code(() => session.submit("slt_a", proposal as never))).toBe("SCOPE_VIOLATION");
  });
});

describe("team decision", () => {
  it("applies a change once a majority of the others accepts, in one global order", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    expect(session.vote("slt_b", "p1", "accept")).toBe("pending");
    expect(session.vote("slt_c", "p1", "accept")).toBe("applied");
    expect(session.seq).toBe(1);
    const [entry] = session.history();
    expect(entry).toMatchObject({
      seq: 1,
      kind: "applied",
      changeId: "p1",
      alias: "Zorro Azul",
      role: "characters",
      origin: "child",
    });
    expect(entry?.resultHash).toBe(programSemanticHash(session.program));
    expect(session.program.scripts[0]?.statements).toHaveLength(2);
  });

  it("rejects when acceptance can no longer be reached, leaving the program untouched", () => {
    const { session } = build();
    const before = session.program;
    session.submit("slt_a", moveProposal("p1"));
    session.vote("slt_b", "p1", "reject");
    expect(session.vote("slt_c", "p1", "reject")).toBe("rejected");
    expect(session.program).toBe(before);
    expect(session.seq).toBe(0);
    expect(session.history()).toEqual([]);
  });

  it("ignores the proposer's own vote and refuses double or unknown votes", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    expect(code(() => session.vote("slt_a", "p1", "accept"))).toBe("CANNOT_VOTE_OWN");
    session.vote("slt_b", "p1", "accept");
    expect(code(() => session.vote("slt_b", "p1", "accept"))).toBe("ALREADY_DECIDED");
    expect(code(() => session.vote("slt_c", "nope", "accept"))).toBe("NOT_FOUND");
    expect(code(() => session.vote("slt_x", "p1", "accept"))).toBe("NOT_A_MEMBER");
  });

  it("shows a preview and attribution before anyone decides", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    const [pending] = session.pending();
    expect(pending).toMatchObject({
      changeId: "p1",
      alias: "Zorro Azul",
      role: "characters",
      status: "pending",
    });
    expect(pending?.preview.length).toBeGreaterThan(0);
  });

  it("lets the proposer withdraw, and allows one open change per member", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    expect(code(() => session.submit("slt_a", moveProposal("p2")))).toBe("ALREADY_PENDING");
    session.withdraw("slt_a", "p1");
    expect(session.pending()).toEqual([]);
    expect(code(() => session.withdraw("slt_b", "p1"))).toBe("NOT_FOUND");
  });
});

describe("concurrent changes", () => {
  const mode = {
    kind: "blocks" as const,
    assignments: { "explorer-script": "slt_a", "beacon-script": "slt_b" },
  };

  it("marks a second proposal on the same base stale once the first is applied", () => {
    const { session } = build({ mode });
    session.submit("slt_a", moveProposal("p1", baseProgram, 0));
    session.submit("slt_b", moveProposal("p2", baseProgram, 1));
    applyByTeam(session, "p1");
    const p2 = session.pending().find((change) => change.changeId === "p2");
    expect(p2?.status).toBe("stale");
    expect(code(() => session.vote("slt_c", "p2", "accept"))).toBe("NOT_OPEN");
    // The owner proposes again on the new base and it goes through.
    expect(code(() => session.submit("slt_b", moveProposal("p3", session.program, 1)))).toBe("OK");
  });

  it("refuses a proposal built on an old program", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    applyByTeam(session, "p1");
    session.passTurn("slt_b");
    expect(code(() => session.submit("slt_c", moveProposal("old", baseProgram)))).toBe(
      "STALE_BASE",
    );
  });
});

describe("Ori proposals", () => {
  const ori = { kind: "learning-companion", capability: "program-proposal" } as const;

  it("wait for the requesting child to decide before the team sees a vote", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("o1", baseProgram, 0, ori));
    const [change] = session.pending();
    expect(change).toMatchObject({ status: "awaiting-requester", origin: "ori" });
    expect(code(() => session.vote("slt_b", "o1", "accept"))).toBe("NOT_OPEN");
    expect(session.vote("slt_a", "o1", "accept")).toBe("pending");
    applyByTeam(session, "o1");
    expect(session.history()[0]).toMatchObject({ origin: "ori", alias: "Zorro Azul" });
  });

  it("is closed when the requesting child rejects", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("o1", baseProgram, 0, ori));
    expect(session.vote("slt_a", "o1", "reject")).toBe("rejected");
    expect(session.program).toEqual(baseProgram);
  });

  it("gives Ori the program and nothing about the group", () => {
    const { session } = build();
    const view = session.oriView();
    expect(Object.keys(view).sort()).toEqual(["program", "programHash"]);
    const text = JSON.stringify(view);
    for (const member of ["Zorro Azul", "slt_a", "Gato Verde"]) expect(text).not.toContain(member);
  });
});

describe("rollback and membership", () => {
  it("rolls back the last applied change as a new ordered entry", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    applyByTeam(session, "p1");
    const rolled = session.rollbackLast();
    expect(rolled).toMatchObject({ seq: 2, kind: "rolled-back", ofSeq: 1 });
    expect(session.program).toEqual(baseProgram);
    expect(session.history().map((e) => e.kind)).toEqual(["applied", "rolled-back"]);
    expect(code(() => session.rollbackLast())).toBe("NOTHING_TO_ROLL_BACK");
  });

  it("removing a member drops their open change and skips their turn", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    session.removeMember("slt_a");
    expect(session.pending()).toEqual([]);
    expect(session.turn()).toBe("slt_b");
    expect(code(() => session.vote("slt_a", "p1", "accept"))).toBe("NOT_A_MEMBER");
    expect(session.members().map((m) => m.slotId)).not.toContain("slt_a");
  });

  it("a reconnecting member gets the program, the order and attributed history only", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    applyByTeam(session, "p1");
    const snap = session.snapshotFor("slt_c");
    expect(snap.seq).toBe(1);
    expect(snap.programHash).toBe(programSemanticHash(session.program));
    expect(snap.history).toHaveLength(1);
    expect(code(() => session.snapshotFor("slt_x"))).toBe("NOT_A_MEMBER");
  });
});

describe("reactions", () => {
  it("accepts only the fixed set and rate limits each member", () => {
    const { session, clock } = build();
    expect(code(() => session.react("slt_a", "hello" as never, { kind: "game" }))).toBe(
      "INVALID_INPUT",
    );
    for (let i = 0; i < 5; i += 1) session.react("slt_a", "like", { kind: "game" });
    expect(code(() => session.react("slt_a", "like", { kind: "game" }))).toBe("RATE_LIMITED");
    clock.advance(11_000);
    expect(code(() => session.react("slt_a", "like", { kind: "game" }))).toBe("OK");
  });

  it("can be muted per viewer and switched off by the organizer", () => {
    const { session } = build();
    session.react("slt_a", "party", { kind: "game" });
    session.react("slt_b", "party", { kind: "game" });
    expect(session.reactionsFor("slt_c", { kind: "game" })).toEqual({ party: 2 });
    session.mute("slt_c", "slt_a");
    expect(session.reactionsFor("slt_c", { kind: "game" })).toEqual({ party: 1 });
    session.unmute("slt_c", "slt_a");
    session.setReactionsEnabled(false);
    expect(code(() => session.react("slt_a", "like", { kind: "game" }))).toBe("REACTIONS_OFF");
    expect(session.reactionsFor("slt_c", { kind: "game" })).toEqual({});
  });
});
