import { describe, expect, it } from "vitest";
import { createProgramProposal } from "@agorix/proposals";
import { parseAgorixProject } from "@agorix/persistence";
import { TeamHost, defaultSanitize, starterTeamProgram, type HostMember } from "./teamHost.js";

// Issue #567: the host validates everything that arrives from other devices.
const MEMBERS: readonly HostMember[] = [
  { slotId: "slt_a", alias: "Zorro Azul", role: "characters" },
  { slotId: "slt_b", alias: "Gato Verde", role: "scene" },
  { slotId: "slt_c", alias: "Búho Rojo", role: "rules" },
];

function host(options: Partial<ConstructorParameters<typeof TeamHost>[0]> = {}) {
  let now = Date.parse("2026-10-25T12:00:00.000Z");
  const h = new TeamHost({
    members: MEMBERS,
    mode: "turns",
    now: () => new Date(now),
    ...options,
  });
  return { h, advance: (ms: number) => void (now += ms) };
}

function proposal(h: TeamHost, id: string) {
  return createProgramProposal({
    id,
    baseProgram: h.program,
    source: { kind: "web" },
    purpose: "Add a move.",
    rationale: "Go further.",
    affectedScriptIds: [h.program.scripts[0]!.id],
    affectedNodeIds: [`scripts[0]/statements[${h.program.scripts[0]!.statements.length}]`],
    operations: [
      { type: "appendStatement", scriptIndex: 0, statement: { type: "move", steps: 20 } },
    ],
  });
}

describe("starter program", () => {
  it("has one script per editor and none for testers", () => {
    const program = starterTeamProgram([
      ...MEMBERS,
      { slotId: "slt_d", alias: "x", role: "testing" },
    ]);
    expect(program.scripts.map((s) => s.id)).toEqual(["script-1", "script-2", "script-3"]);
  });
});

describe("TeamHost messages", () => {
  it("runs propose and vote through the session and notifies subscribers", async () => {
    const { h } = host();
    let notified = 0;
    h.subscribe(() => (notified += 1));
    expect(await h.handle("slt_a", { type: "propose", proposal: proposal(h, "p1") })).toEqual({
      ok: true,
    });
    expect(await h.handle("slt_b", { type: "vote", changeId: "p1", decision: "accept" })).toEqual({
      ok: true,
      status: "pending",
    });
    expect(await h.handle("slt_c", { type: "vote", changeId: "p1", decision: "accept" })).toEqual({
      ok: true,
      status: "applied",
    });
    expect(h.snapshot().history).toHaveLength(1);
    expect(notified).toBeGreaterThan(0);
  });

  it("answers with a code and never throws or echoes on hostile input", async () => {
    const { h } = host();
    const hostile: unknown[] = [
      null,
      "propose",
      42,
      [],
      {},
      { type: "propose" },
      { type: "propose", proposal: { schema: "nope" } },
      { type: "vote", changeId: 7, decision: "accept" },
      { type: "vote", changeId: "p1", decision: "maybe" },
      { type: "react", reaction: "<script>", target: { kind: "game" } },
      { type: "react", reaction: "like", target: { kind: "elsewhere" } },
      { type: "share", kind: "video", payload: "x" },
      { type: "__proto__", constructor: { prototype: {} } },
      { type: "pass", extra: "A".repeat(100) },
    ];
    for (const message of hostile) {
      const reply = await h.handle("slt_a", message);
      expect(reply.ok).toBe(false);
      expect(JSON.stringify(reply)).not.toContain("<script>");
    }
  });

  it("rejects oversized messages and unknown senders", async () => {
    const { h } = host();
    const reply = await h.handle("slt_a", {
      type: "share",
      kind: "name",
      payload: "x".repeat(400_000),
    });
    expect(reply).toEqual({ ok: false, code: "TOO_LARGE" });
    expect(await h.handle("slt_zzz", { type: "pass" })).toEqual({
      ok: false,
      code: "NOT_A_MEMBER",
    });
  });

  it("rate limits a sender and blocks repeated offenders until the organizer removes them", async () => {
    const { h, advance } = host({ messagesPerWindow: 3, violationsToBlock: 3 });
    const violations: string[] = [];
    h.onBlocked((slotId) => violations.push(slotId));
    for (let i = 0; i < 3; i += 1) await h.handle("slt_b", { type: "pass" });
    expect(await h.handle("slt_b", { type: "pass" })).toEqual({ ok: false, code: "RATE_LIMITED" });
    advance(11_000);
    for (let i = 0; i < 3; i += 1) await h.handle("slt_c", { type: "garbage" });
    expect(violations).toEqual(["slt_c"]);
    expect(await h.handle("slt_c", { type: "pass" })).toEqual({ ok: false, code: "BLOCKED" });
  });

  it("keeps Ori proposals behind the requesting child", async () => {
    const { h } = host();
    const ori = createProgramProposal({
      id: "o1",
      baseProgram: h.program,
      source: { kind: "learning-companion", capability: "program-proposal" },
      purpose: "Add a move.",
      rationale: "Go further.",
      affectedScriptIds: ["script-1"],
      affectedNodeIds: ["scripts[0]/statements[0]"],
      operations: [
        { type: "appendStatement", scriptIndex: 0, statement: { type: "move", steps: 5 } },
      ],
    });
    await h.handle("slt_a", { type: "propose", proposal: ori });
    expect(await h.handle("slt_b", { type: "vote", changeId: "o1", decision: "accept" })).toEqual({
      ok: false,
      code: "NOT_OPEN",
    });
    expect(h.oriView()).not.toHaveProperty("members");
  });
});

describe("TeamHost shared content", () => {
  it("shares nothing without a local classifier, and says so neutrally", async () => {
    const { h } = host();
    const reply = await h.handle("slt_a", { type: "share", kind: "name", payload: "Mi robot" });
    expect(reply).toMatchObject({ ok: true, shared: false });
    expect(h.contentQueue()).toEqual([]);
  });

  it("queues safe content for the organizer, who approves before anyone else gets it", async () => {
    const { h } = host({ classify: async () => "safe" });
    await h.handle("slt_a", { type: "share", kind: "name", payload: "Mi robot" });
    const [item] = h.contentQueue();
    expect(item).toMatchObject({ alias: "Zorro Azul", kind: "name" });
    expect(h.inspectContent(item!.itemId)).toBe("Mi robot");
    h.decideContent(item!.itemId, "approve");
    expect(h.approvedContent(item!.itemId)).toBe("Mi robot");
  });

  it("sanitizes names and images deterministically", () => {
    expect(defaultSanitize("name", "  Mi robot  ")).toBe("Mi robot");
    expect(defaultSanitize("name", "llamame al 555-1234 <b>")).toBeUndefined();
    expect(defaultSanitize("name", "x".repeat(40))).toBeUndefined();
    expect(defaultSanitize("image", "data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(defaultSanitize("image", "data:text/html;base64,AAAA")).toBeUndefined();
    expect(defaultSanitize("image", "https://evil.example/x.png")).toBeUndefined();
  });
});

describe("TeamHost organizer actions", () => {
  it("rolls back, removes members, switches reactions and exports a normal .agorix file", async () => {
    const { h } = host();
    await h.handle("slt_a", { type: "propose", proposal: proposal(h, "p1") });
    await h.handle("slt_b", { type: "vote", changeId: "p1", decision: "accept" });
    await h.handle("slt_c", { type: "vote", changeId: "p1", decision: "accept" });

    const exported = parseAgorixProject(h.exportAgorix()).project;
    expect(exported.program.scripts[0]?.statements).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain("Zorro Azul");
    expect(JSON.stringify(exported)).not.toContain("slt_");

    h.rollbackLast();
    expect(h.program.scripts[0]?.statements).toHaveLength(0);

    h.setReactionsEnabled(false);
    expect(
      await h.handle("slt_a", { type: "react", reaction: "like", target: { kind: "game" } }),
    ).toEqual({ ok: false, code: "REACTIONS_OFF" });

    h.removeMember("slt_c");
    expect(await h.handle("slt_c", { type: "pass" })).toEqual({ ok: false, code: "NOT_A_MEMBER" });
  });
});
