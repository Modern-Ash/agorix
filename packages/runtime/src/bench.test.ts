import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createLiveRuntime, LIVE_TICK_SECONDS, runMultiActorProgram } from "./index.js";

/**
 * How much work the runtime does for scenes of the size a child can build, and how long it takes
 * here. The counts (steps, trace entries) are exact and fail the test if they change by accident;
 * the times are only checked against a generous budget, because a clock on a shared machine is not
 * a fact. Run with `pnpm vitest run bench` and read the table printed at the end.
 */
const STEP = { type: "move", steps: 40 } as const;
const TURN = { type: "turn", degrees: 15 } as const;

function actorsOf(count: number, scriptsOf: (index: number) => string[]) {
  return Array.from({ length: count }, (_, index) => ({
    id: `actor:bench-${index + 1}`,
    name: `A${index + 1}`,
    x: 20 * index,
    y: 0,
    direction: 90,
    size: 100,
    visible: true,
    scripts: scriptsOf(index),
  }));
}

function programOf(scripts: { id: string; statements: unknown[] }[]): ProjectProgram {
  return validateProgram({
    schema: SCHEMA_VERSION,
    scripts: scripts.map((script) => ({ ...script, trigger: { type: "greenFlag" } })),
  } as never);
}

interface Row {
  readonly scene: string;
  readonly steps: number;
  readonly entries: number;
  readonly ms: number;
}
const rows: Row[] = [];

// The numbers in docs/product/RUNTIME_BENCHMARK.md come from these scenes.

function batch(scene: string, program: ProjectProgram, creative: unknown) {
  const started = performance.now();
  const run = runMultiActorProgram(program, creative as never);
  const ms = performance.now() - started;
  rows.push({ scene, steps: run.stepsUsed, entries: run.trace.length, ms });
  return { run, ms };
}

describe("runtime work on scenes a child can build", () => {
  it("twelve characters with a script each", () => {
    const body = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? STEP : TURN));
    const program = programOf(
      Array.from({ length: 12 }, (_, i) => ({ id: `s${i + 1}`, statements: body })),
    );
    const { run, ms } = batch("12 characters x 10 blocks", program, {
      actors: actorsOf(12, (i) => [`s${i + 1}`]),
    });
    expect(run.trace).toHaveLength(120);
    expect(run.stepsUsed).toBe(120);
    expect(ms).toBeLessThan(3000);
  });

  it("a long script with nested repeats", () => {
    const inner = { type: "repeat", count: 10, body: [STEP, TURN, STEP, TURN, STEP] };
    const program = programOf([
      { id: "s1", statements: [{ type: "repeat", count: 10, body: [inner] }] },
    ]);
    const { run, ms } = batch("10 x 10 x 5 nested repeats", program, {
      actors: actorsOf(1, () => ["s1"]),
    });
    expect(run.trace.length).toBe(run.stepsUsed);
    expect(run.stepsUsed).toBe(511);
    expect(ms).toBeLessThan(3000);
  });

  it("a forever loop runs until the step budget ends it, never past it", () => {
    const program = programOf([
      { id: "s1", statements: [{ type: "forever", body: [STEP, TURN] }] },
    ]);
    const { run, ms } = batch("forever, until the budget", program, {
      actors: actorsOf(1, () => ["s1"]),
    });
    expect(run.outcome).not.toBe("completed");
    expect(run.stepsUsed).toBe(1000);
    expect(ms).toBeLessThan(3000);
  });

  it("copies at their cap", () => {
    const program = programOf([
      {
        id: "s1",
        statements: [
          { type: "createCopies", count: 10, rule: "fall" },
          { type: "createCopies", count: 10, rule: "fall" },
          { type: "repeat", count: 10, body: [STEP] },
        ],
      },
    ]);
    const { run, ms } = batch("20 copies and a loop", program, {
      actors: actorsOf(1, () => ["s1"]),
    });
    expect(run.outcome).toBe("completed");
    expect(run.stepsUsed).toBe(13);
    expect(ms).toBeLessThan(3000);
  });

  it("a live session of twelve characters, ten seconds, one tick at a time", () => {
    const program = programOf(
      Array.from({ length: 12 }, (_, i) => ({
        id: `s${i + 1}`,
        statements: [{ type: "forever", body: [STEP, TURN, { type: "wait", seconds: 0.1 }] }],
      })),
    );
    const live = createLiveRuntime(program, {
      actors: actorsOf(12, (i) => [`s${i + 1}`]),
    } as never);
    live.fire({ type: "start" });
    const started = performance.now();
    let worstTick = 0;
    const ticks = Math.round(10 / LIVE_TICK_SECONDS);
    for (let tick = 0; tick < ticks; tick += 1) {
      const before = performance.now();
      live.advance(LIVE_TICK_SECONDS);
      worstTick = Math.max(worstTick, performance.now() - before);
    }
    const ms = performance.now() - started;
    rows.push({
      scene: "live: 12 characters, 10 s",
      steps: live.result().stepsUsed,
      entries: live.result().trace.length,
      ms,
    });
    expect(live.result().stepsUsed).toBe(1812);
    // One tick must fit in a frame (about 33 ms at 30 ticks a second) with room to spare.
    expect(worstTick).toBeLessThan(200);
    expect(ms).toBeLessThan(5000);
  });
});
