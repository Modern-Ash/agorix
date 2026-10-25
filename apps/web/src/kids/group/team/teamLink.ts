import { compactSdp, decodeBundle, encodeBundle, expandSdp } from "@agorix/group-lockstep";
import type { LockstepGuest, LockstepHost, Outgoing, WireMessage } from "@agorix/group-lockstep";
import type { HostReply, TeamHost } from "./teamHost.js";

/**
 * WebRTC transport for F3 (ADR 0010). The host already owns validation in `TeamHost.handle`;
 * this module only moves one request/reply pair per slot over an ordered data channel. The
 * compact bundle keeps the invitation small enough for one QR frame.
 */

export type TeamLinkErrorCode =
  | "INVALID"
  | "TOO_LARGE"
  | "SIGNALING"
  | "TIMEOUT"
  | "CLOSED"
  | "DUPLICATE_SLOT"
  | "NOT_INVITED"
  | "NOT_CONNECTED";

export class TeamLinkError extends Error {
  constructor(readonly code: TeamLinkErrorCode) {
    super(code);
    this.name = "TeamLinkError";
  }
}

export type TeamPeerFactory = (config: RTCConfiguration) => RTCPeerConnection;

export interface TeamLinkOptions {
  readonly createPeer?: TeamPeerFactory;
  readonly timeoutMs?: number;
  readonly iceTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const ICE_TIMEOUT_MS = 8_000;
const MAX_ENVELOPE_CHARS = 300_000;
const MAX_VIOLATIONS = 3;
const MAX_LOCKSTEP_OUTBOX = 64;

type RequestEnvelope = { readonly t: "request"; readonly id: number; readonly msg: unknown };
type ReplyEnvelope = { readonly t: "reply"; readonly id: number; readonly reply: unknown };
type LockstepEnvelope = { readonly t: "ls"; readonly msg: unknown };
type Envelope = RequestEnvelope | ReplyEnvelope | LockstepEnvelope;

function peer(config: RTCConfiguration, options: TeamLinkOptions): RTCPeerConnection {
  return options.createPeer?.(config) ?? new RTCPeerConnection(config);
}

function waitIce(pc: RTCPeerConnection, timeoutMs: number): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (pc.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const failed = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        cleanup();
        reject(new TeamLinkError("SIGNALING"));
      }
    };
    const cleanup = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      pc.removeEventListener("connectionstatechange", failed);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new TeamLinkError("TIMEOUT"));
    }, timeoutMs);
    pc.addEventListener("icegatheringstatechange", check);
    pc.addEventListener("connectionstatechange", failed);
    check();
  });
}

function waitOpen(channel: RTCDataChannel, timeoutMs: number): Promise<void> {
  if (channel.readyState === "open") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const opened = () => {
      cleanup();
      resolve();
    };
    const closed = () => {
      cleanup();
      reject(new TeamLinkError("CLOSED"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      channel.removeEventListener("open", opened);
      channel.removeEventListener("close", closed);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new TeamLinkError("TIMEOUT"));
    }, timeoutMs);
    channel.addEventListener("open", opened);
    channel.addEventListener("close", closed);
  });
}

function parseEnvelope(raw: unknown): Envelope | undefined {
  if (typeof raw !== "string") throw new TeamLinkError("INVALID");
  if (raw.length > MAX_ENVELOPE_CHARS) throw new TeamLinkError("TOO_LARGE");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new TeamLinkError("INVALID");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TeamLinkError("INVALID");
  }
  const object = value as Record<string, unknown>;
  const id = object["id"];
  if (object["t"] === "request") {
    if (
      Object.keys(object).sort().join() !== "id,msg,t" ||
      !Number.isSafeInteger(id) ||
      (id as number) < 0
    ) {
      throw new TeamLinkError("INVALID");
    }
    return { t: "request", id: id as number, msg: object["msg"] };
  }
  if (object["t"] === "reply") {
    if (
      Object.keys(object).sort().join() !== "id,reply,t" ||
      !Number.isSafeInteger(id) ||
      (id as number) < 0
    ) {
      throw new TeamLinkError("INVALID");
    }
    return { t: "reply", id: id as number, reply: object["reply"] };
  }
  if (object["t"] === "ls") {
    if (Object.keys(object).sort().join() !== "msg,t") throw new TeamLinkError("INVALID");
    return { t: "ls", msg: object["msg"] };
  }
  throw new TeamLinkError("INVALID");
}

interface HostLink {
  readonly pc: RTCPeerConnection;
  readonly channel: RTCDataChannel;
  violations: number;
}

export interface HostTeamLinkOptions extends TeamLinkOptions {
  readonly host: Pick<TeamHost, "handle">;
}

/** Organizer side: one peer connection per approved child slot. */
export class HostTeamLink {
  private readonly options: HostTeamLinkOptions;
  private readonly links = new Map<string, HostLink>();
  private lockstep: LockstepHost | undefined;

  constructor(options: HostTeamLinkOptions) {
    this.options = options;
  }

  /** Attach the sequencer; each data channel then carries lockstep frames for its slot. */
  attachLockstep(lockstep: LockstepHost): void {
    this.lockstep = lockstep;
  }

  startLockstep(nowMs: number = Date.now()): void {
    this.emit(this.lockstep?.start(nowMs) ?? []);
  }

  pollLockstep(nowMs: number = Date.now()): void {
    this.emit(this.lockstep?.poll(nowMs) ?? []);
  }

  resumeLockstep(nowMs: number = Date.now()): void {
    this.emit(this.lockstep?.resume(nowMs) ?? []);
  }

  stopLockstep(reason: "host" | "end" = "host"): void {
    this.emit(this.lockstep?.stop(reason) ?? []);
  }

  /** Build the compact invitation for one approved slot. */
  async invite(slotId: string): Promise<string> {
    if (slotId.length === 0 || slotId.length > 128) throw new TeamLinkError("INVALID");
    if (this.links.has(slotId)) throw new TeamLinkError("DUPLICATE_SLOT");
    const pc = peer({ iceServers: [] }, this.options);
    const channel = pc.createDataChannel("team", { ordered: true });
    const link: HostLink = { pc, channel, violations: 0 };
    this.links.set(slotId, link);
    this.listen(slotId, link);
    try {
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce(pc, this.options.iceTimeoutMs ?? ICE_TIMEOUT_MS);
      const description = pc.localDescription;
      if (description === null || description.sdp.length === 0) {
        throw new TeamLinkError("SIGNALING");
      }
      return encodeBundle(compactSdp(description.sdp));
    } catch (error) {
      this.closeSlot(slotId);
      throw error instanceof TeamLinkError ? error : new TeamLinkError("SIGNALING");
    }
  }

  /** Apply the child's compact answer and wait until its data channel is usable. */
  async accept(slotId: string, answer: string): Promise<void> {
    const link = this.links.get(slotId);
    if (link === undefined) throw new TeamLinkError("NOT_INVITED");
    try {
      const remote = decodeBundle(answer);
      await link.pc.setRemoteDescription({ type: "answer", sdp: expandSdp(remote, "active") });
      await waitOpen(link.channel, this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    } catch (error) {
      this.closeSlot(slotId);
      throw error instanceof TeamLinkError ? error : new TeamLinkError("SIGNALING");
    }
  }

  isOpen(slotId: string): boolean {
    return this.links.get(slotId)?.channel.readyState === "open";
  }

  closeSlot(slotId: string): void {
    const link = this.links.get(slotId);
    if (link === undefined) return;
    this.links.delete(slotId);
    try {
      link.channel.close();
    } finally {
      link.pc.close();
    }
  }

  close(): void {
    this.stopLockstep("end");
    this.lockstep = undefined;
    for (const slotId of [...this.links.keys()]) this.closeSlot(slotId);
  }

  private listen(slotId: string, link: HostLink): void {
    link.channel.addEventListener("message", (event: MessageEvent) => {
      void this.receive(slotId, link, event.data);
    });
    link.channel.addEventListener("close", () => {
      this.links.delete(slotId);
      this.emit(this.lockstep?.playerLeft(slotId, Date.now()) ?? []);
    });
    link.pc.addEventListener("connectionstatechange", () => {
      if (link.pc.connectionState === "failed" || link.pc.connectionState === "closed") {
        this.closeSlot(slotId);
      }
    });
  }

  private violate(slotId: string, link: HostLink): void {
    link.violations += 1;
    if (link.violations >= MAX_VIOLATIONS) this.closeSlot(slotId);
  }

  private emit(out: readonly Outgoing[]): void {
    for (const entry of out) {
      if (entry.to === "all") {
        for (const slotId of [...this.links.keys()]) this.sendLockstep(slotId, entry.msg);
      } else {
        this.sendLockstep(entry.to, entry.msg);
      }
    }
  }

  private sendLockstep(slotId: string, msg: WireMessage): void {
    const link = this.links.get(slotId);
    if (link === undefined || link.channel.readyState !== "open") return;
    try {
      link.channel.send(JSON.stringify({ t: "ls", msg } satisfies LockstepEnvelope));
    } catch {
      this.closeSlot(slotId);
    }
  }

  private async receive(slotId: string, link: HostLink, raw: unknown): Promise<void> {
    let envelope: Envelope;
    try {
      envelope = parseEnvelope(raw) as Envelope;
    } catch {
      this.violate(slotId, link);
      return;
    }
    if (envelope.t === "ls") {
      const lockstep = this.lockstep;
      if (lockstep === undefined) {
        this.violate(slotId, link);
        return;
      }
      try {
        this.emit(lockstep.receive(slotId, envelope.msg, Date.now()));
      } catch {
        this.violate(slotId, link);
      }
      return;
    }
    if (envelope.t !== "request") {
      this.violate(slotId, link);
      return;
    }
    if (link.channel.readyState !== "open") return;
    let reply: HostReply;
    try {
      reply = await this.options.host.handle(slotId, envelope.msg);
    } catch {
      // `TeamHost` promises not to throw; a transport failure must still answer the child.
      reply = { ok: false, code: "INVALID" };
    }
    try {
      link.channel.send(
        JSON.stringify({ t: "reply", id: envelope.id, reply } satisfies ReplyEnvelope),
      );
    } catch {
      this.closeSlot(slotId);
    }
  }
}

interface Pending {
  readonly resolve: (reply: unknown) => void;
  readonly reject: (error: TeamLinkError) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Child side: joins one invitation and sends validated messages to the organizer. */
export class GuestTeamLink {
  private readonly options: TeamLinkOptions;
  private pc: RTCPeerConnection | undefined;
  private channel: RTCDataChannel | undefined;
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();
  private readonly outbox = new Map<number, unknown>();
  private readonly lockstepOutbox: WireMessage[] = [];
  private lockstep: LockstepGuest | undefined;
  private violations = 0;
  private closed = false;

  constructor(options: TeamLinkOptions = {}) {
    this.options = options;
  }

  /** Attach the local simulation; the guest sends its hello now or as soon as the channel opens. */
  attachLockstep(lockstep: LockstepGuest): void {
    this.lockstep = lockstep;
    this.queueLockstep(lockstep.hello());
  }

  /** Consume the organizer's invitation and return the compact answer to paste back. */
  async join(offer: string): Promise<string> {
    if (this.pc !== undefined || this.closed) throw new TeamLinkError("SIGNALING");
    const pc = peer({ iceServers: [] }, this.options);
    this.pc = pc;
    pc.addEventListener("datachannel", (event: RTCDataChannelEvent) => {
      this.attach(event.channel);
    });
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") this.close();
    });
    try {
      const remote = decodeBundle(offer);
      await pc.setRemoteDescription({ type: "offer", sdp: expandSdp(remote, "actpass") });
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce(pc, this.options.iceTimeoutMs ?? ICE_TIMEOUT_MS);
      const description = pc.localDescription;
      if (description === null || description.sdp.length === 0) {
        throw new TeamLinkError("SIGNALING");
      }
      return encodeBundle(compactSdp(description.sdp));
    } catch (error) {
      this.close();
      throw error instanceof TeamLinkError ? error : new TeamLinkError("SIGNALING");
    }
  }

  /** Send one message to `TeamHost.handle` and resolve with its reply. */
  request(msg: unknown): Promise<unknown> {
    if (this.closed) return Promise.reject(new TeamLinkError("CLOSED"));
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TeamLinkError("TIMEOUT"));
      }, this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.send(id, msg);
    });
  }

  get isOpen(): boolean {
    return this.channel?.readyState === "open";
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.channel?.close();
    this.channel = undefined;
    this.pc?.close();
    this.pc = undefined;
    this.outbox.clear();
    this.lockstepOutbox.length = 0;
    this.lockstep?.linkClosed();
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new TeamLinkError("CLOSED"));
    }
    this.pending.clear();
  }

  private attach(channel: RTCDataChannel): void {
    if (this.closed) {
      channel.close();
      return;
    }
    this.channel = channel;
    channel.addEventListener("message", (event: MessageEvent) => this.receive(event.data));
    channel.addEventListener("close", () => this.close());
    channel.addEventListener(
      "open",
      () => {
        this.flush();
        this.flushLockstep();
      },
      { once: true },
    );
    this.flush();
    this.flushLockstep();
  }

  private send(id: number, msg: unknown): void {
    if (!this.isOpen) {
      // The answer can be pasted before the host applies it; hold the message until open.
      this.outbox.set(id, msg);
      return;
    }
    this.sendNow(id, msg);
  }

  private flush(): void {
    if (!this.isOpen) return;
    for (const [id, msg] of this.outbox) {
      this.outbox.delete(id);
      if (this.pending.has(id)) this.sendNow(id, msg);
    }
  }

  private sendNow(id: number, msg: unknown): void {
    try {
      this.channel?.send(JSON.stringify({ t: "request", id, msg } satisfies RequestEnvelope));
    } catch {
      const pending = this.pending.get(id);
      if (pending === undefined) return;
      this.pending.delete(id);
      clearTimeout(pending.timer);
      pending.reject(new TeamLinkError("NOT_CONNECTED"));
    }
  }

  private violate(): void {
    this.violations += 1;
    if (this.violations >= MAX_VIOLATIONS) this.close();
  }

  private queueLockstep(msg: WireMessage): void {
    if (this.closed) return;
    if (!this.isOpen) {
      if (this.lockstepOutbox.length < MAX_LOCKSTEP_OUTBOX) this.lockstepOutbox.push(msg);
      return;
    }
    try {
      this.channel?.send(JSON.stringify({ t: "ls", msg } satisfies LockstepEnvelope));
    } catch {
      this.close();
    }
  }

  private flushLockstep(): void {
    if (!this.isOpen) return;
    for (const msg of this.lockstepOutbox.splice(0)) this.queueLockstep(msg);
  }

  private receive(raw: unknown): void {
    let envelope: Envelope;
    try {
      envelope = parseEnvelope(raw) as Envelope;
    } catch {
      this.violate();
      return;
    }
    if (envelope.t === "ls") {
      const lockstep = this.lockstep;
      if (lockstep === undefined) {
        this.violate();
        return;
      }
      try {
        for (const msg of lockstep.receive(envelope.msg)) this.queueLockstep(msg);
      } catch {
        this.close();
      }
      return;
    }
    if (envelope.t !== "reply") {
      this.violate();
      return;
    }
    const pending = this.pending.get(envelope.id);
    if (pending === undefined) return;
    this.pending.delete(envelope.id);
    clearTimeout(pending.timer);
    pending.resolve(envelope.reply);
  }
}
