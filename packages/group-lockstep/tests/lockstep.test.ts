import { describe, expect, it } from "vitest";
import {
  LOCKSTEP_VERSION,
  LockstepGuest,
  LockstepHost,
  type GuestOptions,
  type HostOptions,
  type Outgoing,
  type Sim,
  type WireMessage,
} from "../src/index.js";

class CounterSim implements Sim {
  total = 0;
  readonly frames: { n: number; inputs: readonly (unknown | null)[] }[] = [];
  private state = { total: 0 };

  apply(frame: { n: number; inputs: readonly (unknown | null)[] }): void {
    this.frames.push(frame);
    for (const input of frame.inputs) {
      if (typeof input === "number") this.total += input;
    }
    this.state = { total: this.total };
  }

  digest(): number {
    return this.total;
  }

  snapshot(): unknown {
    return { ...this.state, frames: this.frames.length };
  }

  restore(snapshot: unknown): void {
    const value = snapshot as { total: number };
    this.total = value.total;
    this.state = { total: value.total };
  }
}

const host = (sim: Sim, overrides: Partial<HostOptions> = {}): LockstepHost =>
  new LockstepHost({
    players: ["a", "b", "c"],
    sim,
    seed: 7,
    programHash: "program-1",
    validateInput: (value) =>
      Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 9,
    ...overrides,
  });

const message = (out: Outgoing[], to: string): WireMessage[] =>
  out.filter((entry) => entry.to === to || entry.to === "all").map((entry) => entry.msg);

const input = (player: string, n: number, v: unknown, now: number) => ({
  player,
  msg: { t: "in", n, v },
  now,
});

describe("lockstep host", () => {
  it("numbers frames and applies one ordered input per player", () => {
    const sim = new CounterSim();
    const match = host(sim);
    for (const player of ["a", "b", "c"]) {
      expect(
        message(
          match.hello(player, {
            t: "hello",
            v: LOCKSTEP_VERSION,
            programHash: "program-1",
            seed: 7,
          }),
          player,
        ),
      ).toEqual([
        { t: "welcome", v: LOCKSTEP_VERSION, slot: ["a", "b", "c"].indexOf(player), players: 3 },
      ]);
    }

    expect(message(match.start(0), "all")).toEqual([{ t: "start" }, { t: "tick", n: 0 }]);

    expect(match.input(input("a", 0, 1, 1).player, input("a", 0, 1, 1).msg, 1)).toEqual([]);
    expect(match.input(input("b", 0, 2, 2).player, input("b", 0, 2, 2).msg, 2)).toEqual([]);
    expect(
      message(match.input(input("c", 0, 3, 3).player, input("c", 0, 3, 3).msg, 3), "all"),
    ).toEqual([
      { t: "frame", n: 0, inputs: [1, 2, 3] },
      { t: "tick", n: 1 },
    ]);
    expect(sim.frames).toEqual([{ n: 0, inputs: [1, 2, 3] }]);
    expect(match.status).toBe("running");
  });

  it("ignores late input but counts a wrong frame or invalid value as a violation", () => {
    const sim = new CounterSim();
    const match = host(sim);
    for (const player of ["a", "b", "c"]) {
      match.hello(player, { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 });
    }
    match.start(0);
    for (const player of ["a", "b", "c"]) {
      match.input(player, { t: "in", n: 0, v: 1 }, 1);
    }

    expect(match.input("a", { t: "in", n: 0, v: 8 }, 2)).toEqual([]);
    expect(match.input("a", { t: "in", n: 9, v: 8 }, 2)).toEqual([]);
    expect(match.input("b", { t: "in", n: 1, v: 99 }, 2)).toEqual([]);
    expect(match.stats().violations).toEqual({ a: 1, b: 1 });
    expect(match.frame).toBe(0);
  });

  it("paces frames with frameIntervalMs and closes on the next poll once inputs arrive", () => {
    const sim = new CounterSim();
    const match = host(sim, { frameIntervalMs: 100, frameTimeoutMs: 1_000 });
    match.hello("a", { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 });
    expect(message(match.start(0), "all")).toEqual([{ t: "start" }, { t: "tick", n: 0 }]);
    expect(match.input("a", { t: "in", n: 0, v: 1 }, 10)).toEqual([]);
    expect(match.poll(50)).toEqual([]);
    expect(sim.frames).toEqual([]);
    expect(message(match.poll(100), "all")).toEqual([
      { t: "frame", n: 0, inputs: [1, null, null] },
      { t: "tick", n: 1 },
    ]);
    expect(sim.frames).toEqual([{ n: 0, inputs: [1, null, null] }]);
    expect(match.joinedPlayers()).toEqual(["a"]);
  });

  it("pauses after three consecutive missed frames and resumes without the absent player", () => {
    const sim = new CounterSim();
    const match = host(sim, { frameTimeoutMs: 0, missedToAbsent: 3, digestEvery: 100 });
    match.hello("a", { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 });
    match.hello("b", { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 });
    match.start(0);

    let paused: Outgoing[] = [];
    for (let n = 0; n < 3; n += 1) {
      match.input("a", { t: "in", n, v: 1 }, n);
      paused = match.poll(n);
    }

    expect(match.status).toBe("paused");
    expect(message(paused, "all")).toContainEqual({ t: "paused", absent: [1] });
    expect(sim.frames).toEqual([
      { n: 0, inputs: [1, null, null] },
      { n: 1, inputs: [1, null, null] },
      { n: 2, inputs: [1, null, null] },
    ]);

    expect(message(match.resume(100), "all")).toEqual([{ t: "resumed" }, { t: "tick", n: 3 }]);
    expect(match.input("b", { t: "in", n: 3, v: 5 }, 101)).toEqual([]);
    expect(match.stats().frames).toBe(3);
  });

  it("resyncs a divergent device and drops it after the resync budget", () => {
    const sim = new CounterSim();
    const match = host(sim, { digestEvery: 2, maxResyncs: 2 });
    for (const player of ["a", "b", "c"]) {
      match.hello(player, { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 });
    }
    match.start(0);
    for (let n = 0; n < 2; n += 1) {
      for (const player of ["a", "b", "c"]) match.input(player, { t: "in", n, v: 1 }, n);
    }

    const first = match.digest("a", { t: "digest", n: 1, d: 999 });
    expect(first).toEqual([
      { to: "a", msg: { t: "resync", n: 1, snapshot: { total: 6, frames: 2 } } },
    ]);
    match.digest("a", { t: "digest", n: 1, d: 999 });
    const last = match.digest("a", { t: "digest", n: 1, d: 999 });
    expect(message(last, "a")).toEqual([{ t: "stop", reason: "host" }]);
  });

  it("routes device messages and counts unknown types as violations", () => {
    const sim = new CounterSim();
    const match = host(sim);
    expect(
      message(
        match.receive(
          "a",
          { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 },
          0,
        ),
        "a",
      ),
    ).toContainEqual({ t: "welcome", v: LOCKSTEP_VERSION, slot: 0, players: 3 });
    match.receive("b", { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 }, 0);
    match.receive("c", { t: "hello", v: LOCKSTEP_VERSION, programHash: "program-1", seed: 7 }, 0);
    match.start(0);
    match.receive("a", { t: "in", n: 0, v: 1 }, 0);
    match.receive("b", { t: "in", n: 0, v: 2 }, 0);
    expect(message(match.receive("c", { t: "in", n: 0, v: 3 }, 0), "all")).toContainEqual({
      t: "frame",
      n: 0,
      inputs: [1, 2, 3],
    });
    expect(match.receive("a", { t: "bogus" }, 0)).toEqual([]);
    expect(match.stats().violations).toEqual({ a: 1 });
  });

  it("refuses mismatched or unknown devices without throwing", () => {
    const match = host(new CounterSim());
    expect(message(match.hello("z", { t: "hello", v: 1, programHash: "x", seed: 1 }), "z")).toEqual(
      [{ t: "refuse", reason: "unknown" }],
    );
    expect(
      message(match.hello("a", { t: "hello", v: 99, programHash: "program-1", seed: 7 }), "a"),
    ).toEqual([{ t: "refuse", reason: "version" }]);
    expect(
      message(match.hello("a", { t: "hello", v: 1, programHash: "other", seed: 7 }), "a"),
    ).toEqual([{ t: "refuse", reason: "program" }]);
    expect(
      message(match.hello("a", { t: "hello", v: 1, programHash: "program-1", seed: 8 }), "a"),
    ).toEqual([{ t: "refuse", reason: "seed" }]);
  });
});

describe("lockstep guest", () => {
  const options = (sim: Sim): GuestOptions => ({
    sim,
    seed: 7,
    programHash: "program-1",
    input: (n) => (n === 0 ? "right" : null),
    digestEvery: 2,
  });

  it("follows ordered frames and asks for a snapshot when one is missing", () => {
    const sim = new CounterSim();
    const guest = new LockstepGuest(options(sim));
    expect(guest.hello()).toEqual({
      t: "hello",
      v: LOCKSTEP_VERSION,
      programHash: "program-1",
      seed: 7,
    });
    expect(guest.receive({ t: "welcome", v: 1, slot: 1, players: 2 })).toEqual([]);
    expect(guest.slot).toBe(1);
    expect(guest.players).toBe(2);
    expect(guest.receive({ t: "start" })).toEqual([]);
    expect(guest.receive({ t: "tick", n: 0 })).toEqual([{ t: "in", n: 0, v: "right" }]);
    expect(guest.receive({ t: "frame", n: 0, inputs: ["right"] })).toEqual([]);
    expect(sim.frames).toEqual([{ n: 0, inputs: ["right"] }]);

    expect(guest.receive({ t: "frame", n: 2, inputs: [null] })).toEqual([{ t: "need-resync" }]);
    expect(guest.receive({ t: "frame", n: 3, inputs: [null] })).toEqual([]);
    expect(guest.receive({ t: "resync", n: 2, snapshot: { total: 9, frames: 9 } })).toEqual([]);
    expect(guest.receive({ t: "frame", n: 3, inputs: [null, 4] })).toEqual([
      { t: "digest", n: 3, d: 13 },
    ]);
    expect(sim.frames.at(-1)).toEqual({ n: 3, inputs: [null, 4] });
  });

  it("refuses a welcome from another protocol and ignores impossible slots", () => {
    const guest = new LockstepGuest(options(new CounterSim()));
    expect(guest.receive({ t: "welcome", v: 99, slot: 0, players: 2 })).toEqual([]);
    expect(guest.status).toBe("refused");

    const other = new LockstepGuest(options(new CounterSim()));
    expect(other.receive({ t: "welcome", v: 1, slot: 2, players: 2 })).toEqual([]);
    expect(other.status).toBe("connecting");
    expect(other.slot).toBeUndefined();
  });

  it("stops safely when the host link closes or the host stops", () => {
    const guest = new LockstepGuest(options(new CounterSim()));
    guest.receive({ t: "welcome", v: 1, slot: 0, players: 2 });
    guest.receive({ t: "start" });
    guest.linkClosed();
    expect(guest.status).toBe("host-lost");
    expect(guest.receive({ t: "tick", n: 0 })).toEqual([]);
  });
});
