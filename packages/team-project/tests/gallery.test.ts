import { describe, expect, it } from "vitest";
import { programSemanticHash } from "@agorix/proposals";
import { GalleryError, GroupGallery } from "../src/index.js";
import { FakeClock, baseProgram, build, moveProposal } from "./support.js";

function code(work: () => unknown): string {
  try {
    work();
  } catch (error) {
    if (error instanceof GalleryError) return error.code;
    throw error;
  }
  return "OK";
}

function gallery(admitted: string[] = ["slt_a", "slt_b"], maxEntries = 3) {
  const members = new Set(admitted);
  return {
    members,
    gallery: new GroupGallery({
      clock: new FakeClock(),
      isAdmitted: (slotId) => members.has(slotId),
      maxEntries,
    }),
  };
}

const meta = { teamId: "equipo-1" as const, version: 1, contributors: ["Zorro Azul"] };

describe("closed gallery", () => {
  it("shows a published project only to admitted devices, with no free text", () => {
    const { gallery: g } = gallery();
    const id = g.publish(baseProgram, meta);
    const [entry] = g.list("slt_a");
    expect(entry).toMatchObject({
      entryId: id,
      teamId: "equipo-1",
      version: 1,
      contributors: ["Zorro Azul"],
      programHash: programSemanticHash(baseProgram),
    });
    expect(Object.keys(entry!).sort()).toEqual([
      "contributors",
      "entryId",
      "programHash",
      "publishedAt",
      "teamId",
      "version",
    ]);
    expect(g.open(id, "slt_b")).toEqual(baseProgram);
  });

  it("denies a device that is not in the session, or that was removed", () => {
    const { gallery: g, members } = gallery();
    const id = g.publish(baseProgram, meta);
    expect(code(() => g.list("slt_x"))).toBe("NOT_ADMITTED");
    expect(code(() => g.open(id, "slt_x"))).toBe("NOT_ADMITTED");
    members.delete("slt_b");
    expect(code(() => g.list("slt_b"))).toBe("NOT_ADMITTED");
  });

  it("lets the organizer withdraw a project at once", () => {
    const { gallery: g } = gallery();
    const id = g.publish(baseProgram, meta);
    g.withdraw(id);
    expect(g.list("slt_a")).toEqual([]);
    expect(code(() => g.open(id, "slt_a"))).toBe("NOT_FOUND");
    expect(code(() => g.withdraw(id))).toBe("NOT_FOUND");
  });

  it("keeps a snapshot, so later edits do not change what was shown", () => {
    const { gallery: g } = gallery();
    type Mutable = { scripts: { statements: unknown[] }[] };
    const program = structuredClone(baseProgram);
    const id = g.publish(program, meta);
    (program as unknown as Mutable).scripts[0]!.statements.push({ type: "move", steps: 99 });
    expect(g.open(id, "slt_a").scripts[0]?.statements).toHaveLength(1);
    const opened = g.open(id, "slt_a");
    (opened as unknown as Mutable).scripts[0]!.statements.push({ type: "move", steps: 7 });
    expect(g.open(id, "slt_a").scripts[0]?.statements).toHaveLength(1);
  });

  it("bounds how many projects are shown and refuses a non-fixed team id", () => {
    const { gallery: g } = gallery(["slt_a"], 2);
    g.publish(baseProgram, meta);
    g.publish(baseProgram, { ...meta, version: 2 });
    expect(code(() => g.publish(baseProgram, { ...meta, version: 3 }))).toBe("GALLERY_FULL");
    expect(code(() => g.publish(baseProgram, { ...meta, teamId: "my team" as never }))).toBe(
      "INVALID_INPUT",
    );
  });

  it("forgets everything when the group closes", () => {
    const { gallery: g } = gallery();
    const id = g.publish(baseProgram, meta);
    g.clear();
    expect(g.list("slt_a")).toEqual([]);
    expect(code(() => g.open(id, "slt_a"))).toBe("NOT_FOUND");
  });
});

describe("organizer summary", () => {
  it("counts contributions per alias without any identity beyond the generated alias", () => {
    const { session } = build();
    session.submit("slt_a", moveProposal("p1"));
    session.vote("slt_b", "p1", "accept");
    session.vote("slt_c", "p1", "accept");
    session.submit("slt_b", moveProposal("p2", session.program, 1));
    const summary = session.summary();
    expect(summary.totals).toEqual({ applied: 1, rolledBack: 0, pending: 1, stale: 0 });
    expect(summary.turn).toBe("Gato Verde");
    expect(summary.members).toEqual([
      { alias: "Zorro Azul", role: "characters", applied: 1, openChange: false },
      { alias: "Gato Verde", role: "scene", applied: 0, openChange: true },
      { alias: "Búho Rojo", role: "rules", applied: 0, openChange: false },
      { alias: "Oso Dorado", role: "testing", applied: 0, openChange: false },
    ]);
    expect(JSON.stringify(summary)).not.toMatch(/slt_/);
  });
});

describe("organizer silence", () => {
  it("stops one device's reactions for everyone without touching the others", () => {
    const { session } = build();
    session.silence("slt_a", true);
    expect(() => session.react("slt_a", "like", { kind: "game" })).toThrow(/silenced|Silenced/i);
    session.react("slt_b", "like", { kind: "game" });
    expect(session.reactionsFor("slt_c", { kind: "game" })).toEqual({ like: 1 });
    session.silence("slt_a", false);
    session.react("slt_a", "like", { kind: "game" });
    expect(session.reactionsFor("slt_c", { kind: "game" })).toEqual({ like: 2 });
  });
});
