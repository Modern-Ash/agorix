import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "move-hero",
      trigger: { type: "onStart" },
      statements: [{ type: "move", steps: 10 }],
    },
    {
      id: "turn-villain",
      trigger: { type: "onStart" },
      statements: [
        { type: "turn", degrees: 90 },
        { type: "move", steps: 5 },
      ],
    },
  ],
};

const creative: ProjectCreativeState = {
  actors: [
    {
      id: "actor:hero",
      name: "Hero",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["move-hero"],
    },
    {
      id: "actor:villain",
      name: "Villain",
      x: 20,
      y: 0,
      direction: 0,
      size: 80,
      visible: true,
      scripts: ["turn-villain"],
    },
  ],
  stage: { actorOrder: ["actor:villain", "actor:hero"] },
};

describe("runMultiActorProgram", () => {
  it("runs actor-scoped scripts in deterministic stage actor order", () => {
    const result = runMultiActorProgram(program, creative);

    expect(result.outcome).toBe("completed");
    expect(result.stepsUsed).toBe(3);
    expect(result.trace.map((entry) => [entry.actorId, entry.scriptId, entry.nodeId])).toEqual([
      ["actor:villain", "turn-villain", "scripts[1]/statements[0]"],
      ["actor:villain", "turn-villain", "scripts[1]/statements[1]"],
      ["actor:hero", "move-hero", "scripts[0]/statements[0]"],
    ]);
    expect(result.actors.map((actor) => [actor.id, actor.world.sprite])).toMatchObject([
      ["actor:villain", { x: 20, y: 5, heading: 90 }],
      ["actor:hero", { x: 10, y: 0, heading: 0 }],
    ]);
  });

  it("produces stable frames and trace across repeated runs", () => {
    const a = runMultiActorProgram(program, creative);
    const b = runMultiActorProgram(structuredClone(program), structuredClone(creative));

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.frames).toHaveLength(3);
    expect(a.frames[0]?.actors.map((actor) => actor.id)).toEqual(["actor:villain", "actor:hero"]);
    expect(a.frames[0]?.actorId).toBe("actor:villain");
    expect(a.frames[0]?.actors[0]?.world.sprite).toMatchObject({ x: 20, y: 0, heading: 90 });
    expect(a.frames[1]?.actors[0]?.world.sprite).toMatchObject({ x: 20, y: 5, heading: 90 });
  });

  it("supports default compatibility actor that runs existing onStart scripts", () => {
    const result = runMultiActorProgram(program);
    const singleActor = result.actors[0];

    expect(result.outcome).toBe("completed");
    expect(singleActor?.id).toBe("actor:main");
    expect(singleActor?.world.sprite).toMatchObject({ x: 10, y: 5, heading: 90 });
  });

  it("preserves program variables when running actor-scoped scripts", () => {
    const variableProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [{ id: "score", name: "score", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "score-script",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "changeVariable",
              variableId: "score",
              delta: { type: "numericLiteral", value: 4 },
            },
            {
              type: "if",
              condition: {
                type: "lessThan",
                left: { type: "variable", variableId: "score" },
                right: { type: "numericLiteral", value: 10 },
              },
              then: [{ type: "move", steps: 6 }],
            },
          ],
        },
      ],
    };

    const result = runMultiActorProgram(variableProgram);

    expect(result.outcome).toBe("completed");
    expect(result.actors[0]?.world.variables).toEqual({
      score: { value: 4, visible: true },
    });
    expect(result.actors[0]?.world.sprite.x).toBe(6);
  });

  it("shares the existing budget guardrail without changing runProgram behavior", () => {
    const result = runMultiActorProgram(program, creative, { maxSteps: 1 });

    expect(result.outcome).toBe("budget-exceeded");
    expect(result.stepsUsed).toBe(1);
    expect(result.trace).toHaveLength(1);
    expect(runProgram(program, createWorldState()).stepsUsed).toBe(3);
  });

  it("rejects invalid budgets like the single-actor runtime", () => {
    expect(() => runMultiActorProgram(program, creative, { maxSteps: -1 })).toThrow(RangeError);
  });

  it("runs key press scripts only when the queued key matches", () => {
    const keyProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "right",
          trigger: { type: "onKeyPressed", key: "ArrowRight" },
          statements: [{ type: "move", steps: 7 }],
        },
        {
          id: "left",
          trigger: { type: "onKeyPressed", key: "ArrowLeft" },
          statements: [{ type: "move", steps: -7 }],
        },
      ],
    };

    const result = runMultiActorProgram(keyProgram, undefined, {
      events: [{ type: "keyPressed", key: "ArrowRight" }],
    });

    expect(result.outcome).toBe("completed");
    expect(result.stepsUsed).toBe(1);
    expect(result.trace.map((entry) => [entry.scriptId, entry.event])).toEqual([
      ["right", { type: "keyPressed", key: "ArrowRight" }],
    ]);
    expect(result.actors[0]?.world.sprite.x).toBe(7);
  });

  it("runs click scripts for the clicked actor only", () => {
    const clickProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "clicked",
          trigger: { type: "onActorClicked" },
          statements: [{ type: "turn", degrees: 45 }],
        },
      ],
    };
    const clickCreative: ProjectCreativeState = {
      actors: [
        { id: "actor:a", name: "A", x: 0, y: 0, direction: 0, size: 100, visible: true },
        { id: "actor:b", name: "B", x: 0, y: 0, direction: 0, size: 100, visible: true },
      ],
      stage: { actorOrder: ["actor:a", "actor:b"] },
    };

    const result = runMultiActorProgram(clickProgram, clickCreative, {
      events: [{ type: "actorClicked", actorId: "actor:b" }],
    });

    expect(result.trace.map((entry) => entry.actorId)).toEqual(["actor:b"]);
    expect(result.actors.map((actor) => [actor.id, actor.world.sprite.heading])).toEqual([
      ["actor:a", 0],
      ["actor:b", 45],
    ]);
  });

  it("queues broadcasts deterministically and explains every activation", () => {
    const broadcastProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "starter",
          trigger: { type: "onStart" },
          statements: [
            { type: "broadcast", message: "go" },
            { type: "move", steps: 1 },
          ],
        },
        {
          id: "receiver",
          trigger: { type: "onMessage", message: "go" },
          statements: [{ type: "turn", degrees: 90 }],
        },
      ],
    };

    const a = runMultiActorProgram(broadcastProgram);
    const b = runMultiActorProgram(structuredClone(broadcastProgram));

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.outcome).toBe("completed");
    expect(a.trace.map((entry) => [entry.scriptId, entry.statementType])).toEqual([
      ["starter", "broadcast"],
      ["starter", "move"],
      ["receiver", "turn"],
    ]);
    expect(a.activations.map((activation) => [activation.scriptId, activation.event])).toEqual([
      ["starter", { type: "start" }],
      ["receiver", { type: "message", message: "go", senderActorId: "actor:main" }],
    ]);
    expect(a.trace[2]?.activationId).toBe(a.activations[1]?.id);
    expect(a.activations[1]?.reason).toContain("broadcast by actor:main");
  });

  it("stops broadcast loops at the shared execution budget", () => {
    const loopingProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "starter",
          trigger: { type: "onStart" },
          statements: [{ type: "broadcast", message: "again" }],
        },
        {
          id: "loop",
          trigger: { type: "onMessage", message: "again" },
          statements: [{ type: "broadcast", message: "again" }],
        },
      ],
    };

    const result = runMultiActorProgram(loopingProgram, undefined, { maxSteps: 3 });

    expect(result.outcome).toBe("budget-exceeded");
    expect(result.stepsUsed).toBe(3);
    expect(result.trace.map((entry) => entry.scriptId)).toEqual(["starter", "loop", "loop"]);
  });

  it("replays mixed start, key, click and broadcast events in deterministic order", () => {
    const mixedProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "hero-start",
          trigger: { type: "onStart" },
          statements: [{ type: "broadcast", message: "wake" }],
        },
        {
          id: "helper-wake",
          trigger: { type: "onMessage", message: "wake" },
          statements: [{ type: "turn", degrees: 30 }],
        },
        {
          id: "hero-key",
          trigger: { type: "onKeyPressed", key: "ArrowRight" },
          statements: [{ type: "move", steps: 6 }],
        },
        {
          id: "helper-click",
          trigger: { type: "onActorClicked" },
          statements: [
            { type: "broadcast", message: "clicked" },
            { type: "move", steps: 4 },
          ],
        },
        {
          id: "hero-clicked-message",
          trigger: { type: "onMessage", message: "clicked" },
          statements: [{ type: "say", text: "received" }],
        },
      ],
    };
    const mixedCreative: ProjectCreativeState = {
      actors: [
        {
          id: "actor:hero",
          name: "Hero",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["hero-start", "hero-key", "hero-clicked-message"],
        },
        {
          id: "actor:helper",
          name: "Helper",
          x: 10,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["helper-wake", "helper-click"],
        },
      ],
      stage: { actorOrder: ["actor:helper", "actor:hero"] },
    };
    const events = [
      { type: "start" as const },
      { type: "keyPressed" as const, key: "ArrowRight" },
      { type: "actorClicked" as const, actorId: "actor:helper" },
    ];

    const first = runMultiActorProgram(mixedProgram, mixedCreative, { events });
    const second = runMultiActorProgram(
      structuredClone(mixedProgram),
      structuredClone(mixedCreative),
      {
        events: structuredClone(events),
      },
    );

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.outcome).toBe("completed");
    expect(
      first.activations.map((activation) => [activation.actorId, activation.scriptId]),
    ).toEqual([
      ["actor:hero", "hero-start"],
      ["actor:hero", "hero-key"],
      ["actor:helper", "helper-click"],
      ["actor:helper", "helper-wake"],
      ["actor:hero", "hero-clicked-message"],
    ]);
    expect(
      first.trace.map((entry) => [entry.actorId, entry.scriptId, entry.statementType]),
    ).toEqual([
      ["actor:hero", "hero-start", "broadcast"],
      ["actor:hero", "hero-key", "move"],
      ["actor:helper", "helper-click", "broadcast"],
      ["actor:helper", "helper-click", "move"],
      ["actor:helper", "helper-wake", "turn"],
      ["actor:hero", "hero-clicked-message", "say"],
    ]);
    expect(first.actors.map((actor) => [actor.id, actor.world.sprite])).toMatchObject([
      ["actor:helper", { x: 14, y: 0, heading: 30 }],
      ["actor:hero", { x: 6, y: 0, heading: 0, bubble: { kind: "say", text: "received" } }],
    ]);
  });
});
