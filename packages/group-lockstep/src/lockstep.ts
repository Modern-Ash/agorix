/**
 * Input lockstep for same-room games (ADR 0010, F3). The organizer's device is the host and the
 * only sequencer: it numbers frames, collects one input per child, broadcasts the ordered inputs
 * and every device folds them into the same deterministic simulation. Devices need only the same
 * program, seed and ordered inputs, and they compare a digest every few frames.
 *
 * Nothing here touches a network or a clock. The caller (a WebRTC adapter, a test) moves messages
 * and passes `nowMs`; every method returns the messages to send. The host never throws on input
 * from a device: it counts a violation and ignores it.
 */

export const LOCKSTEP_VERSION = 1;

/** The game logic both sides run. It must be deterministic and free of clocks and randomness. */
export interface Sim {
  apply(frame: { readonly n: number; readonly inputs: readonly (unknown | null)[] }): void;
  digest(): number;
  /** Serializable and bounded; used to resynchronize a device that diverged. */
  snapshot(): unknown;
  restore(snapshot: unknown): void;
}

export type WireMessage =
  | { readonly t: "hello"; readonly v: number; readonly programHash: string; readonly seed: number }
  | { readonly t: "welcome"; readonly v: number; readonly slot: number; readonly players: number }
  | { readonly t: "refuse"; readonly reason: "version" | "program" | "seed" | "full" | "unknown" }
  | { readonly t: "start" }
  | { readonly t: "tick"; readonly n: number }
  | { readonly t: "in"; readonly n: number; readonly v: unknown }
  | {
      readonly t: "frame";
      readonly n: number;
      readonly inputs: readonly (unknown | null)[];
    }
  | { readonly t: "digest"; readonly n: number; readonly d: number }
  | { readonly t: "resync"; readonly n: number; readonly snapshot: unknown }
  | { readonly t: "need-resync" }
  | { readonly t: "paused"; readonly absent: readonly number[] }
  | { readonly t: "resumed" }
  | { readonly t: "stop"; readonly reason: "host" | "end" };

export interface Outgoing {
  /** A player id, or "all" for every connected player. */
  readonly to: string;
  readonly msg: WireMessage;
}

export type HostStatus = "waiting" | "running" | "paused" | "stopped";

export interface HostOptions {
  /** Ordered ids of the children. The order fixes the order of inputs in every frame. */
  readonly players: readonly string[];
  readonly sim: Sim;
  readonly seed: number;
  readonly programHash: string;
  /** The game says what an input may look like. */
  readonly validateInput: (value: unknown) => boolean;
  /** Frames between digest checks. */
  readonly digestEvery?: number;
  /** How long a frame waits for the slowest child. */
  readonly frameTimeoutMs?: number;
  /** Minimum time a frame stays open, so a fast link does not spin the simulation. */
  readonly frameIntervalMs?: number;
  /** Consecutive missed frames before a child counts as absent and the game pauses. */
  readonly missedToAbsent?: number;
  /** Times one device may be resynchronized before the host drops it. */
  readonly maxResyncs?: number;
  /** Violations (invalid or out-of-order messages) before the host drops a device. */
  readonly maxViolations?: number;
  readonly maxInputChars?: number;
  readonly maxSnapshotChars?: number;
}

export interface HostStats {
  readonly frames: number;
  readonly violations: Readonly<Record<string, number>>;
  readonly resyncs: Readonly<Record<string, number>>;
}

const DEFAULTS = {
  digestEvery: 30,
  frameTimeoutMs: 150,
  frameIntervalMs: 0,
  missedToAbsent: 3,
  maxResyncs: 3,
  maxViolations: 20,
  maxInputChars: 256,
  maxSnapshotChars: 100_000,
};

export class LockstepHost {
  private readonly o: Required<
    Pick<
      HostOptions,
      | "digestEvery"
      | "frameTimeoutMs"
      | "frameIntervalMs"
      | "missedToAbsent"
      | "maxResyncs"
      | "maxViolations"
      | "maxInputChars"
      | "maxSnapshotChars"
    >
  > &
    HostOptions;
  private state: HostStatus = "waiting";
  private readonly joined = new Set<string>();
  private readonly dropped = new Set<string>();
  private readonly absent = new Set<string>();
  private readonly missed = new Map<string, number>();
  private readonly violationCount = new Map<string, number>();
  private readonly resyncCount = new Map<string, number>();
  private readonly digests = new Map<number, number>();
  private current: { n: number; openedAt: number; inputs: Map<string, unknown> } | undefined;
  private nextFrame = 0;
  private lastApplied = -1;

  constructor(options: HostOptions) {
    this.o = { ...DEFAULTS, ...options };
    if (new Set(options.players).size !== options.players.length || options.players.length === 0) {
      throw new Error("players must be a non-empty list of distinct ids");
    }
  }

  get status(): HostStatus {
    return this.state;
  }

  get frame(): number {
    return this.lastApplied;
  }

  /** Devices that completed the handshake, in roster order. */
  joinedPlayers(): readonly string[] {
    return this.o.players.filter((player) => this.live(player));
  }

  /** Roster ids the match is not waiting for anymore: absent during a pause or dropped. */
  inactivePlayers(): readonly string[] {
    return this.o.players.filter((player) => !this.live(player) || this.absent.has(player));
  }

  stats(): HostStats {
    return {
      frames: this.lastApplied + 1,
      violations: Object.fromEntries(this.violationCount),
      resyncs: Object.fromEntries(this.resyncCount),
    };
  }

  /** A device announces itself. It must match the host's protocol version, program and seed. */
  hello(player: string, msg: unknown): Outgoing[] {
    if (!this.o.players.includes(player) || this.dropped.has(player)) {
      return [{ to: player, msg: { t: "refuse", reason: "unknown" } }];
    }
    const m = msg as { t?: unknown; v?: unknown; programHash?: unknown; seed?: unknown };
    if (m?.t !== "hello") return this.violation(player);
    if (this.state !== "waiting") return [{ to: player, msg: { t: "refuse", reason: "full" } }];
    if (m.v !== LOCKSTEP_VERSION) return [{ to: player, msg: { t: "refuse", reason: "version" } }];
    if (m.programHash !== this.o.programHash) {
      return [{ to: player, msg: { t: "refuse", reason: "program" } }];
    }
    if (m.seed !== this.o.seed) return [{ to: player, msg: { t: "refuse", reason: "seed" } }];
    this.joined.add(player);
    return [
      {
        to: player,
        msg: {
          t: "welcome",
          v: LOCKSTEP_VERSION,
          slot: this.o.players.indexOf(player),
          players: this.o.players.length,
        },
      },
    ];
  }

  /**
   * Route one wire message from a device. The transport only has to parse the envelope and call
   * this; unknown or invalid messages become violations instead of exceptions.
   */
  receive(player: string, msg: unknown, nowMs: number): Outgoing[] {
    const m = msg as { t?: unknown };
    if (m === null || typeof m !== "object") return this.violation(player);
    switch (m.t) {
      case "hello":
        return this.hello(player, msg);
      case "in":
        return this.input(player, msg, nowMs);
      case "digest":
        return this.digest(player, msg);
      case "need-resync":
        return this.needResync(player);
      default:
        return this.violation(player);
    }
  }

  /** The organizer starts the game with whoever joined. Others are dropped from the match. */
  start(nowMs: number): Outgoing[] {
    if (this.state !== "waiting" || this.joined.size === 0) return [];
    for (const player of this.o.players) if (!this.joined.has(player)) this.dropped.add(player);
    this.state = "running";
    return [{ to: "all", msg: { t: "start" } }, ...this.openFrame(nowMs)];
  }

  input(player: string, msg: unknown, nowMs: number): Outgoing[] {
    if (!this.live(player)) return [];
    const m = msg as { t?: unknown; n?: unknown; v?: unknown };
    if (m === null || typeof m !== "object" || m.t !== "in" || !Number.isInteger(m.n)) {
      return this.violation(player);
    }
    // A late input for a frame already closed is normal on a slow link: ignore it, no penalty.
    if (this.current === undefined || (m.n as number) < this.current.n) return [];
    if (m.n !== this.current.n) return this.violation(player);
    if (this.current.inputs.has(player)) return this.violation(player);
    if (!this.inputOk(m.v)) return this.violation(player);
    this.current.inputs.set(player, m.v);
    return this.closeIfComplete(nowMs);
  }

  digest(player: string, msg: unknown): Outgoing[] {
    if (!this.live(player)) return [];
    const m = msg as { t?: unknown; n?: unknown; d?: unknown };
    if (m === null || typeof m !== "object" || m.t !== "digest" || !Number.isInteger(m.n)) {
      return this.violation(player);
    }
    const expected = this.digests.get(m.n as number);
    if (expected === undefined || m.d === expected) return [];
    return this.resync(player);
  }

  /** A device asked to be resynchronized (it noticed a gap). */
  needResync(player: string): Outgoing[] {
    return this.live(player) ? this.resync(player) : [];
  }

  /** Call regularly. Closes a frame that waited too long and marks silent devices absent. */
  poll(nowMs: number): Outgoing[] {
    if (this.state !== "running" || this.current === undefined) return [];
    const elapsed = nowMs - this.current.openedAt;
    if (elapsed < this.o.frameIntervalMs) return [];
    if (this.waitingFor().length === 0) return this.closeFrame(nowMs);
    if (elapsed < this.o.frameTimeoutMs) return [];
    return this.closeFrame(nowMs);
  }

  /** The link to a device closed. Treated like an immediate absence. */
  playerLeft(player: string, nowMs: number): Outgoing[] {
    if (!this.live(player) || this.state === "stopped") return [];
    this.absent.add(player);
    return this.state === "running" ? this.closeIfComplete(nowMs) : [];
  }

  /** Organizer: continue without the absent devices. They are out of the match for good. */
  resume(nowMs: number): Outgoing[] {
    if (this.state !== "paused") return [];
    for (const player of this.absent) this.dropped.add(player);
    this.absent.clear();
    this.state = "running";
    return [{ to: "all", msg: { t: "resumed" } }, ...this.openFrame(nowMs)];
  }

  stop(reason: "host" | "end" = "host"): Outgoing[] {
    if (this.state === "stopped") return [];
    this.state = "stopped";
    this.current = undefined;
    return [{ to: "all", msg: { t: "stop", reason } }];
  }

  // ---- internals -------------------------------------------------------------------------

  private live(player: string): boolean {
    return this.o.players.includes(player) && this.joined.has(player) && !this.dropped.has(player);
  }

  private waitingFor(): string[] {
    return this.o.players.filter(
      (p) => this.live(p) && !this.absent.has(p) && !this.current?.inputs.has(p),
    );
  }

  private inputOk(value: unknown): boolean {
    let text: string | undefined;
    try {
      text = JSON.stringify(value);
    } catch {
      return false;
    }
    return text !== undefined && text.length <= this.o.maxInputChars && this.o.validateInput(value);
  }

  private openFrame(nowMs: number): Outgoing[] {
    this.current = { n: this.nextFrame, openedAt: nowMs, inputs: new Map() };
    const out: Outgoing[] = [{ to: "all", msg: { t: "tick", n: this.current.n } }];
    return out.concat(this.closeIfComplete(nowMs));
  }

  private closeIfComplete(nowMs: number): Outgoing[] {
    if (this.state !== "running" || this.current === undefined) return [];
    if (this.waitingFor().length > 0) return [];
    return nowMs - this.current.openedAt < this.o.frameIntervalMs ? [] : this.closeFrame(nowMs);
  }

  private closeFrame(nowMs: number): Outgoing[] {
    const frame = this.current;
    if (this.state !== "running" || frame === undefined) return [];
    const inputs = this.o.players.map((p) =>
      this.live(p) && frame.inputs.has(p) ? frame.inputs.get(p)! : null,
    );
    for (const p of this.o.players) {
      if (!this.live(p) || this.absent.has(p)) continue;
      const missed = frame.inputs.has(p) ? 0 : (this.missed.get(p) ?? 0) + 1;
      this.missed.set(p, missed);
      if (missed >= this.o.missedToAbsent) this.absent.add(p);
    }
    this.o.sim.apply({ n: frame.n, inputs });
    this.lastApplied = frame.n;
    this.nextFrame = frame.n + 1;
    this.current = undefined;
    if ((frame.n + 1) % this.o.digestEvery === 0) this.digests.set(frame.n, this.o.sim.digest());
    this.digests.delete(frame.n - this.o.digestEvery * 4);

    const out: Outgoing[] = [{ to: "all", msg: { t: "frame", n: frame.n, inputs } }];
    if (this.absent.size > 0) {
      this.state = "paused";
      out.push({
        to: "all",
        msg: {
          t: "paused",
          absent: [...this.absent].map((p) => this.o.players.indexOf(p)).sort((a, b) => a - b),
        },
      });
      return out;
    }
    return out.concat(this.openFrame(nowMs));
  }

  private resync(player: string): Outgoing[] {
    const count = (this.resyncCount.get(player) ?? 0) + 1;
    this.resyncCount.set(player, count);
    if (count > this.o.maxResyncs) return this.drop(player);
    const snapshot = this.o.sim.snapshot();
    let size = 0;
    try {
      size = JSON.stringify(snapshot)?.length ?? 0;
    } catch {
      size = Infinity;
    }
    if (size > this.o.maxSnapshotChars) return this.drop(player);
    return [{ to: player, msg: { t: "resync", n: this.lastApplied, snapshot } }];
  }

  private violation(player: string): Outgoing[] {
    if (!this.live(player)) return [];
    const count = (this.violationCount.get(player) ?? 0) + 1;
    this.violationCount.set(player, count);
    return count >= this.o.maxViolations ? this.drop(player) : [];
  }

  private drop(player: string): Outgoing[] {
    this.dropped.add(player);
    this.absent.delete(player);
    const out: Outgoing[] = [{ to: player, msg: { t: "stop", reason: "host" } }];
    return this.state === "running" ? out.concat(this.closeIfComplete(0)) : out;
  }
}

export type GuestStatus =
  "connecting" | "ready" | "running" | "paused" | "host-lost" | "refused" | "stopped";

export interface GuestOptions {
  readonly sim: Sim;
  readonly seed: number;
  readonly programHash: string;
  /** This device's input for frame `n`, or null for "no action". */
  readonly input: (n: number) => unknown;
  readonly digestEvery?: number;
  readonly maxSnapshotChars?: number;
}

/** The child's device. It trusts nothing it cannot check: shape, order and size of every message. */
export class LockstepGuest {
  private state: GuestStatus = "connecting";
  private expected = 0;
  private resyncing = false;
  private mySlot: number | undefined;
  private playerCount: number | undefined;
  private absentSlots: readonly number[] = [];
  private readonly every: number;
  private readonly maxSnapshot: number;

  constructor(private readonly o: GuestOptions) {
    this.every = o.digestEvery ?? DEFAULTS.digestEvery;
    this.maxSnapshot = o.maxSnapshotChars ?? DEFAULTS.maxSnapshotChars;
  }

  get status(): GuestStatus {
    return this.state;
  }

  /** The roster slot assigned by the host, once its welcome arrived. */
  get slot(): number | undefined {
    return this.mySlot;
  }

  get players(): number | undefined {
    return this.playerCount;
  }

  /** Slots the host paused or dropped, as indices into the original roster. */
  get absent(): readonly number[] {
    return this.absentSlots;
  }

  hello(): WireMessage {
    return { t: "hello", v: LOCKSTEP_VERSION, programHash: this.o.programHash, seed: this.o.seed };
  }

  receive(raw: unknown): WireMessage[] {
    const m = raw as {
      t?: unknown;
      v?: unknown;
      slot?: unknown;
      players?: unknown;
      n?: unknown;
      inputs?: unknown;
      snapshot?: unknown;
      absent?: unknown;
    };
    if (this.state === "host-lost" || this.state === "refused" || this.state === "stopped") {
      return [];
    }
    if (m === null || typeof m !== "object") return [];
    switch (m.t) {
      case "welcome": {
        if (m.v !== LOCKSTEP_VERSION) {
          this.state = "refused";
          return [];
        }
        const slot = m.slot;
        const players = m.players;
        if (
          !Number.isInteger(slot) ||
          !Number.isInteger(players) ||
          (slot as number) < 0 ||
          (players as number) < 1 ||
          (slot as number) >= (players as number)
        ) {
          return [];
        }
        if (this.state === "connecting") {
          this.mySlot = slot as number;
          this.playerCount = players as number;
          this.state = "ready";
        }
        return [];
      }
      case "refuse":
        this.state = "refused";
        return [];
      case "start":
        if (this.state === "ready") this.state = "running";
        return [];
      case "tick":
        if (this.state !== "running" || !Number.isInteger(m.n)) return [];
        return [{ t: "in", n: m.n as number, v: this.o.input(m.n as number) }];
      case "frame":
        return this.frame(m.n, m.inputs);
      case "resync":
        return this.resync(m.n, m.snapshot);
      case "paused": {
        if (this.state === "running") this.state = "paused";
        const absent = m.absent;
        if (Array.isArray(absent)) {
          this.absentSlots = absent.filter(
            (slot): slot is number => Number.isInteger(slot) && (slot as number) >= 0,
          );
        }
        return [];
      }
      case "resumed":
        if (this.state === "paused") this.state = "running";
        return [];
      case "stop":
        this.state = "stopped";
        return [];
      default:
        return [];
    }
  }

  /** The link to the host closed. There is no host migration: stop safely. */
  linkClosed(): void {
    if (this.state !== "stopped") this.state = "host-lost";
  }

  private frame(n: unknown, inputs: unknown): WireMessage[] {
    if (this.state !== "running" && this.state !== "paused") return [];
    if (!Number.isInteger(n) || !Array.isArray(inputs) || inputs.length > 8) return [];
    if (this.resyncing) return [];
    if (n !== this.expected) {
      // A gap or a repeat: do not guess, ask the host for the state.
      this.resyncing = true;
      return [{ t: "need-resync" }];
    }
    this.o.sim.apply({ n: n as number, inputs: inputs as unknown[] });
    this.expected = (n as number) + 1;
    return ((n as number) + 1) % this.every === 0
      ? [{ t: "digest", n: n as number, d: this.o.sim.digest() }]
      : [];
  }

  private resync(n: unknown, snapshot: unknown): WireMessage[] {
    if (this.state !== "running" && this.state !== "paused") return [];
    if (!Number.isInteger(n) || (n as number) < -1) return [];
    let size = 0;
    try {
      size = JSON.stringify(snapshot)?.length ?? 0;
    } catch {
      return [];
    }
    if (size > this.maxSnapshot) return [];
    this.o.sim.restore(snapshot);
    this.expected = (n as number) + 1;
    this.resyncing = false;
    return [];
  }
}
