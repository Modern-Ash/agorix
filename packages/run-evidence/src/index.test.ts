import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
  type Script,
} from "@agorix/program-model";
import { runMultiActorProgram } from "@agorix/runtime";
import { diagnoseRun, surfacedFinding, toProviderFinding } from "./index.js";

const program = (scripts: Script[]): ProjectProgram => ({ schema: SCHEMA_VERSION, scripts });
const creative = (scripts: Script[]): ProjectCreativeState => ({
  actors: scripts.map((script, index) => ({
    id: `actor:${index + 1}`,
    name: `A${index + 1}`,
    x: 0,
    y: 0,
    direction: 0,
    size: 100,
    visible: true,
    scripts: [script.id],
  })),
});
const diagnose = (scripts: Script[], extra: Partial<Parameters<typeof diagnoseRun>[0]> = {}) => {
  const p = program(scripts);
  const c = creative(scripts);
  return diagnoseRun({ program: p, creative: c, run: runMultiActorProgram(p, c), ...extra });
};

const flag = { type: "greenFlag" } as const;

describe("run evidence findings", () => {
  it("says a message nobody sends is why its script never started", () => {
    const [finding] = diagnose([
      { id: "a", trigger: flag, statements: [{ type: "move", steps: 20 }] },
      { id: "b", trigger: { type: "onMessage", message: "hola" }, statements: [{ type: "hide" }] },
    ]);
    expect(finding).toMatchObject({
      kind: "neverStarted",
      actorId: "actor:2",
      nodeIds: ["scripts[1]"],
      counts: { senders: 0 },
      event: { type: "message", name: "hola", senders: 0 },
    });
    expect(finding!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("is less sure when a sender exists but did not run, and quiet when the message arrived", () => {
    const scripts: Script[] = [
      { id: "a", trigger: flag, statements: [{ type: "broadcast", message: "hola" }] },
      { id: "b", trigger: { type: "onMessage", message: "hola" }, statements: [{ type: "hide" }] },
    ];
    expect(diagnose(scripts)).toEqual([]);
    const notRun = diagnose([
      {
        id: "a",
        trigger: { type: "onKeyPressed", key: "Space" },
        statements: [{ type: "broadcast", message: "hola" }],
      },
      scripts[1]!,
    ]);
    const heard = notRun.find((item) => item.nodeIds[0] === "scripts[1]")!;
    expect(heard.counts).toEqual({ senders: 1 });
    expect(heard.confidence).toBeLessThan(0.9);
  });

  it("treats a key or a tap not yet done as a weak finding that is not surfaced", () => {
    const findings = diagnose([
      {
        id: "a",
        trigger: { type: "onKeyPressed", key: "ArrowUp" },
        statements: [{ type: "move", steps: 20 }],
      },
    ]);
    expect(findings[0]).toMatchObject({
      kind: "neverStarted",
      event: { type: "key", name: "ArrowUp" },
    });
    expect(surfacedFinding(findings)).toBeUndefined();
  });

  it("does not call an unfinished live run a failure", () => {
    expect(
      diagnose(
        [
          {
            id: "b",
            trigger: { type: "onMessage", message: "hola" },
            statements: [{ type: "hide" }],
          },
        ],
        { final: false },
      ),
    ).toEqual([]);
  });

  it("finds a message that was sent and that nothing receives", () => {
    const [finding] = diagnose([
      { id: "a", trigger: flag, statements: [{ type: "broadcast", message: "listo" }] },
    ]);
    expect(finding).toMatchObject({
      kind: "messageUnheard",
      nodeIds: ["scripts[0]/statements[0]"],
      counts: { sent: 1 },
    });
  });

  it("finds an if that always said no, with how many times it was asked", () => {
    const findings = diagnose([
      {
        id: "a",
        trigger: flag,
        statements: [
          {
            type: "repeat",
            count: 3,
            body: [
              {
                type: "if",
                condition: {
                  type: "greaterThan",
                  left: { type: "xPosition" },
                  right: { type: "numericLiteral", value: 100 },
                },
                then: [{ type: "hide" }],
              },
            ],
          },
        ],
      },
    ]);
    expect(findings[0]).toMatchObject({
      kind: "conditionNeverTrue",
      nodeIds: ["scripts[0]/statements[0]/body[0]"],
      counts: { yes: 0, no: 3 },
    });
    expect(surfacedFinding(findings)).toBe(findings[0]);
  });

  it("stays silent for an if that sometimes said yes", () => {
    expect(
      diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [
            { type: "move", steps: 40 },
            {
              type: "if",
              condition: {
                type: "greaterThan",
                left: { type: "xPosition" },
                right: { type: "numericLiteral", value: 10 },
              },
              then: [{ type: "turn", degrees: 90 }],
            },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it("adds the prediction that did not match", () => {
    const [finding] = diagnose(
      [{ id: "a", trigger: flag, statements: [{ type: "move", steps: 20 }] }],
      {
        predictionMatched: false,
      },
    );
    expect(finding).toMatchObject({ kind: "predictionMismatch" });
  });

  it("limits the diagnosis to one character", () => {
    const scripts: Script[] = [
      { id: "a", trigger: { type: "onMessage", message: "hola" }, statements: [{ type: "hide" }] },
      { id: "b", trigger: { type: "onMessage", message: "vamos" }, statements: [{ type: "hide" }] },
    ];
    const only = diagnose(scripts, { actorId: "actor:2" });
    expect(only.map((item) => item.actorId)).toEqual(["actor:2"]);
  });

  it("is deterministic and orders by confidence", () => {
    const scripts: Script[] = [
      { id: "a", trigger: { type: "onKeyPressed", key: "Space" }, statements: [{ type: "hide" }] },
      { id: "b", trigger: { type: "onMessage", message: "hola" }, statements: [{ type: "hide" }] },
    ];
    const first = diagnose(scripts);
    expect(JSON.stringify(diagnose(scripts))).toBe(JSON.stringify(first));
    expect(first.map((item) => item.confidence)).toEqual(
      [...first.map((i) => i.confidence)].sort((a, b) => b - a),
    );
  });

  it("sends a provider only the shape: no ids, names or learner values", () => {
    const [finding] = diagnose([
      { id: "b", trigger: { type: "onMessage", message: "hola" }, statements: [{ type: "hide" }] },
    ]);
    const sent = toProviderFinding(finding!);
    expect(sent).toEqual({ kind: "neverStarted", counts: { senders: 0 }, eventType: "message" });
    expect(JSON.stringify(sent)).not.toMatch(/hola|actor|scripts\[/);
  });

  it("says when in the run it happened, as an index into the trace", () => {
    const sent = diagnose([
      {
        id: "a",
        trigger: flag,
        statements: [
          { type: "move", steps: 20 },
          { type: "broadcast", message: "listo" },
        ],
      },
    ]);
    expect(sent[0]).toMatchObject({ kind: "messageUnheard", traceIndex: 1 });
    const asked = diagnose([
      {
        id: "a",
        trigger: flag,
        statements: [
          { type: "move", steps: 20 },
          { type: "move", steps: 20 },
          {
            type: "if",
            condition: {
              type: "greaterThan",
              left: { type: "xPosition" },
              right: { type: "numericLiteral", value: 900 },
            },
            then: [{ type: "hide" }],
          },
        ],
      },
    ]);
    expect(asked[0]).toMatchObject({ kind: "conditionNeverTrue", traceIndex: 2 });
    // Something that never happened has no moment.
    const never = diagnose([
      { id: "b", trigger: { type: "onMessage", message: "hola" }, statements: [{ type: "hide" }] },
    ]);
    expect(never[0]!.traceIndex).toBeUndefined();
    expect(JSON.stringify(toProviderFinding(sent[0]!))).not.toMatch(/traceIndex/);
  });

  it("notices a character that acted but ends hidden, with the hide as its moment", () => {
    const findings = diagnose([
      {
        id: "a",
        trigger: flag,
        statements: [{ type: "hide" }, { type: "move", steps: 40 }, { type: "say", text: "hola" }],
      },
    ]);
    expect(findings[0]).toMatchObject({
      kind: "hiddenCharacter",
      actorId: "actor:1",
      nodeIds: ["scripts[0]/statements[0]"],
      counts: { actions: 2 },
      traceIndex: 0,
    });
    expect(surfacedFinding(findings)).toBe(findings[0]);
  });

  it("is quiet about a hidden character that did nothing visible, or that is shown again", () => {
    expect(diagnose([{ id: "a", trigger: flag, statements: [{ type: "hide" }] }])).toEqual([]);
    expect(
      diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [{ type: "hide" }, { type: "move", steps: 40 }, { type: "show" }],
        },
      ]),
    ).toEqual([]);
  });

  it("notices a sound played with the volume at zero", () => {
    const withSound = (statements: Script["statements"]) => {
      const scripts: Script[] = [{ id: "a", trigger: flag, statements }];
      const p = program(scripts);
      const c: ProjectCreativeState = {
        ...creative(scripts),
        assets: [
          { id: "kids:pop", kind: "sound", name: "Pop", source: "builtin:kids-sound:kids:pop" },
        ],
      };
      return diagnoseRun({ program: p, creative: c, run: runMultiActorProgram(p, c) });
    };
    const findings = withSound([
      { type: "setVolume", volume: 0 },
      { type: "playSound", soundId: "kids:pop" },
    ]);
    expect(findings[0]).toMatchObject({
      kind: "soundSilent",
      nodeIds: ["scripts[0]/statements[1]"],
      counts: { played: 1 },
      traceIndex: 1,
    });
    expect(withSound([{ type: "playSound", soundId: "kids:pop" }])).toEqual([]);
  });

  describe("two scripts of one character", () => {
    const sameCharacter = (left: number, right: number) => {
      const scripts: Script[] = [
        {
          id: "a",
          trigger: flag,
          statements: [{ type: "repeat", count: 3, body: [{ type: "changeX", dx: left }] }],
        },
        {
          id: "b",
          trigger: flag,
          statements: [{ type: "repeat", count: 3, body: [{ type: "changeX", dx: right }] }],
        },
      ];
      const p = program(scripts);
      const c: ProjectCreativeState = {
        actors: [
          {
            id: "actor:1",
            name: "A",
            x: 160,
            y: 0,
            direction: 0,
            size: 100,
            visible: true,
            scripts: ["a", "b"],
          },
        ],
      };
      return diagnoseRun({ program: p, creative: c, run: runMultiActorProgram(p, c) });
    };
    it("notices them pushing it back and forth", () => {
      const found = sameCharacter(40, -40).find((item) => item.kind === "workingAgainstEachOther");
      expect(found).toMatchObject({ actorId: "actor:1", counts: { scripts: 2 } });
      expect(found!.nodeIds).toHaveLength(2);
    });
    it("is quiet when they add up to a real move", () => {
      expect(sameCharacter(40, 20).some((item) => item.kind === "workingAgainstEachOther")).toBe(
        false,
      );
    });
  });

  describe("a loop that does not end", () => {
    it("finds a forever the run had to cut off, with how many blocks ran inside it", () => {
      const [finding] = diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [{ type: "forever", body: [{ type: "move", steps: 1 }] }],
        },
      ]).filter((item) => item.kind === "loopNeverEnds");
      expect(finding).toMatchObject({
        loop: "forever",
        nodeIds: ["scripts[0]/statements[0]"],
        traceIndex: 0,
      });
      expect(finding!.counts["passes"]).toBeGreaterThan(100);
    });

    it("finds a repeat until that never reached its end", () => {
      const found = diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [
            {
              type: "repeatUntil",
              condition: {
                type: "greaterThan",
                left: { type: "xPosition" },
                right: { type: "numericLiteral", value: 900 },
              },
              body: [{ type: "turn", degrees: 1 }],
            },
          ],
        },
      ]).filter((item) => item.kind === "loopNeverEnds");
      expect(found[0]).toMatchObject({ loop: "repeatUntil" });
    });

    it("finds a wait until that timed out", () => {
      const found = diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [{ type: "waitUntil", condition: { type: "keyDown", key: "Space" } }],
        },
      ]).filter((item) => item.kind === "loopNeverEnds");
      expect(found[0]).toMatchObject({ loop: "waitUntil" });
    });

    it("is quiet for loops that ended, and a provider only learns which loop", () => {
      const ended = diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [{ type: "repeat", count: 3, body: [{ type: "move", steps: 20 }] }],
        },
      ]);
      expect(ended.some((item) => item.kind === "loopNeverEnds")).toBe(false);
      const [finding] = diagnose([
        {
          id: "a",
          trigger: flag,
          statements: [{ type: "forever", body: [{ type: "move", steps: 1 }] }],
        },
      ]).filter((item) => item.kind === "loopNeverEnds");
      expect(toProviderFinding(finding!)).toEqual({
        kind: "loopNeverEnds",
        counts: { passes: finding!.counts["passes"] },
        loop: "forever",
      });
    });
  });

  describe("the same blocks written out again and again", () => {
    const move = { type: "move", steps: 40 } as const;
    const turn = { type: "turn", degrees: 90 } as const;
    const say = { type: "say", text: "Hola" } as const;
    const kinds = (statements: Script["statements"]) =>
      diagnose([{ id: "a", trigger: flag, statements }]).filter(
        (item) => item.kind === "repeatedBlocks" || item.kind === "repeatedApart",
      );

    it("finds one block written three times in a row, and where it starts", () => {
      const [found] = kinds([say, move, move, move]);
      expect(found).toMatchObject({
        kind: "repeatedBlocks",
        nodeIds: ["scripts[0]/statements[1]"],
        counts: { period: 1, times: 3 },
      });
    });

    it("finds a group of two or three blocks written out in a row", () => {
      const [two] = kinds([move, turn, move, turn, move, turn]);
      expect(two).toMatchObject({ kind: "repeatedBlocks", counts: { period: 2, times: 3 } });
      const [three] = kinds([move, turn, say, move, turn, say, move, turn, say]);
      expect(three).toMatchObject({ counts: { period: 3, times: 3 } });
    });

    it("finds a group that comes back apart, which a repeat cannot hold", () => {
      const [found] = kinds([move, turn, say, move, turn, say, say, move, turn]);
      expect(found).toMatchObject({ kind: "repeatedApart", counts: { period: 2, times: 3 } });
    });

    it("stays quiet for two copies, for different values and for a loop already there", () => {
      expect(kinds([move, move])).toEqual([]);
      expect(
        kinds([move, { type: "move", steps: 80 }, move, { type: "move", steps: 120 }]),
      ).toEqual([]);
      expect(kinds([{ type: "repeat", count: 3, body: [move] }])).toEqual([]);
    });

    it("is a weak finding that a failure outranks", () => {
      const findings = diagnose([
        { id: "a", trigger: flag, statements: [move, move, move] },
        { id: "b", trigger: { type: "onMessage", message: "hola" }, statements: [say] },
      ]);
      expect(findings[0]!.kind).toBe("neverStarted");
      expect(findings.some((item) => item.kind === "repeatedBlocks")).toBe(true);
    });
  });
});
