import { describe, expect, it, vi } from "vitest";
import {
  compactSdp,
  encodeBundle,
  LockstepGuest,
  LockstepHost,
  type Sim,
} from "@agorix/group-lockstep";
import { GuestTeamLink, HostTeamLink, TeamLinkError } from "./teamLink.js";

const FP =
  "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF";
const SDP = [
  "v=0",
  "o=- 1 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=candidate:2999745851 1 udp 2113937151 192.168.1.20 54321 typ host",
  "a=ice-ufrag:Zx9k",
  "a=ice-pwd:Qm3vT8uYb2nL5cR7aHd0Wp",
  `a=fingerprint:sha-256 ${FP}`,
  "a=setup:actpass",
  "a=mid:0",
  "a=sctp-port:5000",
  "",
].join("\r\n");
const BUNDLE = encodeBundle(compactSdp(SDP));

type Listener = (event: unknown) => void;

class FakeChannel {
  readyState: RTCDataChannelState = "connecting";
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string): void {
    if (this.readyState !== "open") throw new Error("not open");
    this.sent.push(data);
  }

  close(): void {
    this.readyState = "closed";
    this.emit("close", {});
  }

  open(): void {
    this.readyState = "open";
    this.emit("open", {});
  }

  receive(data: string): void {
    this.emit("message", { data });
  }

  private emit(type: string, event: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

class FakePeer {
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  iceGatheringState: RTCIceGatheringState = "complete";
  connectionState: RTCPeerConnectionState = "new";
  readonly channels: FakeChannel[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  createDataChannel(): RTCDataChannel {
    const channel = new FakeChannel();
    this.channels.push(channel);
    return channel as unknown as RTCDataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: SDP };
  }

  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    return { type: "answer", sdp: SDP };
  }

  async setLocalDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = description;
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescription = description;
  }

  close(): void {
    this.connectionState = "closed";
    this.emit("connectionstatechange", {});
  }

  addEventListener(type: string, listener: Listener): void {
    const set = this.listeners.get(type) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  deliver(channel: FakeChannel): void {
    this.emit("datachannel", { channel });
  }

  private emit(type: string, event: unknown): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

const peerFactory = (peer: FakePeer) => vi.fn(() => peer as unknown as RTCPeerConnection);

class SumSim implements Sim {
  total = 0;
  private state = { total: 0 };

  apply(frame: { n: number; inputs: readonly (unknown | null)[] }): void {
    for (const input of frame.inputs) {
      if (typeof input === "number") this.total += input;
    }
    this.state = { total: this.total };
  }

  digest(): number {
    return this.total;
  }

  snapshot(): unknown {
    return this.state;
  }

  restore(snapshot: unknown): void {
    this.total = (snapshot as { total: number }).total;
    this.state = { total: this.total };
  }
}

function drain(from: FakeChannel, to: FakeChannel, cursor: { i: number }): void {
  while (cursor.i < from.sent.length) {
    const message = from.sent[cursor.i];
    cursor.i += 1;
    if (message !== undefined) to.receive(message);
  }
}

describe("HostTeamLink", () => {
  it("invites one slot, accepts its answer and forwards requests to TeamHost", async () => {
    const peer = new FakePeer();
    const handle = vi.fn(async () => ({ ok: true as const, status: "handled" }));
    const createPeer = peerFactory(peer);
    const link = new HostTeamLink({ host: { handle }, createPeer });

    const offer = await link.invite("slot-1");
    expect(offer.length).toBeLessThan(400);
    expect(offer).toBe(BUNDLE);
    await expect(link.invite("slot-1")).rejects.toMatchObject({ code: "DUPLICATE_SLOT" });

    const channel = peer.channels[0];
    expect(channel).toBeDefined();
    channel!.open();
    await link.accept("slot-1", BUNDLE);
    expect(peer.remoteDescription?.sdp).toContain("a=setup:active");

    channel!.receive(JSON.stringify({ t: "request", id: 7, msg: { type: "gallery" } }));
    await vi.waitFor(() => expect(handle).toHaveBeenCalledWith("slot-1", { type: "gallery" }));
    await vi.waitFor(() => expect(channel!.sent).toHaveLength(1));
    expect(JSON.parse(channel!.sent[0]!)).toEqual({
      t: "reply",
      id: 7,
      reply: { ok: true, status: "handled" },
    });
    expect(link.isOpen("slot-1")).toBe(true);
  });

  it("answers an unexpected TeamHost failure and closes after repeated garbage", async () => {
    const peer = new FakePeer();
    const handle = vi.fn(async () => {
      throw new Error("boom");
    });
    const link = new HostTeamLink({ host: { handle }, createPeer: peerFactory(peer) });
    await link.invite("slot-1");
    const channel = peer.channels[0]!;
    channel.open();
    await link.accept("slot-1", BUNDLE);

    channel.receive(JSON.stringify({ t: "request", id: 1, msg: { type: "gallery" } }));
    await vi.waitFor(() => expect(channel.sent).toHaveLength(1));
    expect(JSON.parse(channel.sent[0]!)).toEqual({
      t: "reply",
      id: 1,
      reply: { ok: false, code: "INVALID" },
    });

    for (let i = 0; i < 3; i += 1) channel.receive("not-json");
    expect(link.isOpen("slot-1")).toBe(false);
  });

  it("rejects an answer for a slot that was never invited", async () => {
    const link = new HostTeamLink({ host: { handle: vi.fn() } });
    await expect(link.accept("slot-x", BUNDLE)).rejects.toMatchObject({ code: "NOT_INVITED" });
  });
});

describe("GuestTeamLink", () => {
  it("joins an invitation, queues before the channel opens and resolves the reply", async () => {
    const peer = new FakePeer();
    const guest = new GuestTeamLink({ createPeer: peerFactory(peer), timeoutMs: 200 });
    const answer = await guest.join(BUNDLE);
    expect(answer.length).toBeLessThan(400);
    expect(peer.remoteDescription?.sdp).toContain("a=setup:actpass");

    const channel = new FakeChannel();
    peer.deliver(channel);
    const request = guest.request({ type: "gallery" });
    expect(channel.sent).toHaveLength(0);

    channel.open();
    await vi.waitFor(() => expect(channel.sent).toHaveLength(1));
    expect(JSON.parse(channel.sent[0]!)).toEqual({
      t: "request",
      id: 0,
      msg: { type: "gallery" },
    });
    channel.receive(JSON.stringify({ t: "reply", id: 0, reply: { ok: true, gallery: [] } }));
    await expect(request).resolves.toEqual({ ok: true, gallery: [] });
    expect(guest.isOpen).toBe(true);
  });

  it("times out a request with no host and rejects it on close", async () => {
    const peer = new FakePeer();
    const guest = new GuestTeamLink({ createPeer: peerFactory(peer), timeoutMs: 20 });
    await guest.join(BUNDLE);
    peer.deliver(new FakeChannel());
    await expect(guest.request({ type: "gallery" })).rejects.toMatchObject({ code: "TIMEOUT" });

    const pending = guest.request({ type: "gallery" });
    guest.close();
    await expect(pending).rejects.toMatchObject({ code: "CLOSED" });
  });

  it("ignores an unsolicited reply without throwing", async () => {
    const peer = new FakePeer();
    const guest = new GuestTeamLink({ createPeer: peerFactory(peer) });
    await guest.join(BUNDLE);
    const channel = new FakeChannel();
    peer.deliver(channel);
    channel.receive(JSON.stringify({ t: "reply", id: 99, reply: { ok: true } }));
    expect(guest.isOpen).toBe(false);
  });

  it("uses typed link errors", () => {
    expect(new TeamLinkError("TIMEOUT")).toMatchObject({ name: "TeamLinkError", code: "TIMEOUT" });
  });
});

describe("lockstep over the team channel", () => {
  it("runs ordered frames, checks digests and pauses when another slot is absent", async () => {
    const hostPeer = new FakePeer();
    const guestPeer = new FakePeer();
    const hostLink = new HostTeamLink({
      host: { handle: vi.fn() },
      createPeer: peerFactory(hostPeer),
    });
    const guestLink = new GuestTeamLink({
      createPeer: peerFactory(guestPeer),
      timeoutMs: 200,
    });
    const offer = await hostLink.invite("slot-1");
    const answer = await guestLink.join(offer);
    const hostChannel = hostPeer.channels[0]!;
    const guestChannel = new FakeChannel();
    guestPeer.deliver(guestChannel);
    hostChannel.open();

    const hostSim = new SumSim();
    const guestSim = new SumSim();
    const lockstepHost = new LockstepHost({
      players: ["slot-1", "slot-2"],
      sim: hostSim,
      seed: 1,
      programHash: "program-1",
      validateInput: (value) => Number.isInteger(value),
    });
    const lockstepGuest = new LockstepGuest({
      sim: guestSim,
      seed: 1,
      programHash: "program-1",
      input: () => 2,
      digestEvery: 1,
    });

    hostLink.attachLockstep(lockstepHost);
    guestLink.attachLockstep(lockstepGuest);
    expect(guestChannel.sent).toHaveLength(0);
    guestChannel.open();
    expect(JSON.parse(guestChannel.sent[0]!)).toMatchObject({ t: "ls", msg: { t: "hello" } });
    await hostLink.accept("slot-1", answer);

    const guestToHost = { i: 0 };
    const hostToGuest = { i: 0 };
    drain(guestChannel, hostChannel, guestToHost);
    drain(hostChannel, guestChannel, hostToGuest);
    expect(lockstepHost.status).toBe("waiting");

    hostLink.startLockstep(0);
    drain(hostChannel, guestChannel, hostToGuest);
    drain(guestChannel, hostChannel, guestToHost);
    drain(hostChannel, guestChannel, hostToGuest);

    expect(lockstepHost.frame).toBe(0);
    expect(hostSim.total).toBe(2);
    expect(guestSim.total).toBe(2);
    expect(hostSim.digest()).toBe(guestSim.digest());
    const digest = guestChannel.sent
      .map((raw) => JSON.parse(raw) as { t: string; msg: { t: string } })
      .find((entry) => entry.t === "ls" && entry.msg.t === "digest");
    expect(digest).toBeDefined();
    hostChannel.receive(JSON.stringify(digest));
    expect(lockstepHost.stats().resyncs).toEqual({});

    const now = Date.now();
    hostLink.pollLockstep(now + 1_000);
    hostLink.pollLockstep(now + 2_000);
    hostLink.pollLockstep(now + 3_000);
    expect(lockstepHost.status).toBe("paused");
    expect(lockstepHost.frame).toBe(3);

    drain(hostChannel, guestChannel, hostToGuest);
    expect(lockstepGuest.status).toBe("paused");
    expect(hostSim.digest()).toBe(guestSim.digest());
  });

  it("stops the guest when the host ends the match or the link closes", async () => {
    const hostPeer = new FakePeer();
    const guestPeer = new FakePeer();
    const hostLink = new HostTeamLink({
      host: { handle: vi.fn() },
      createPeer: peerFactory(hostPeer),
    });
    const guestLink = new GuestTeamLink({ createPeer: peerFactory(guestPeer) });
    const offer = await hostLink.invite("slot-1");
    const answer = await guestLink.join(offer);
    const hostChannel = hostPeer.channels[0]!;
    const guestChannel = new FakeChannel();
    guestPeer.deliver(guestChannel);
    hostChannel.open();
    guestChannel.open();
    await hostLink.accept("slot-1", answer);

    const lockstepHost = new LockstepHost({
      players: ["slot-1"],
      sim: new SumSim(),
      seed: 1,
      programHash: "program-1",
      validateInput: () => true,
    });
    const lockstepGuest = new LockstepGuest({
      sim: new SumSim(),
      seed: 1,
      programHash: "program-1",
      input: () => null,
    });
    hostLink.attachLockstep(lockstepHost);
    guestLink.attachLockstep(lockstepGuest);
    const guestToHost = { i: 0 };
    const hostToGuest = { i: 0 };
    drain(guestChannel, hostChannel, guestToHost);
    drain(hostChannel, guestChannel, hostToGuest);

    hostLink.stopLockstep("end");
    drain(hostChannel, guestChannel, hostToGuest);
    expect(lockstepGuest.status).toBe("stopped");

    guestLink.close();
    expect(lockstepGuest.status).toBe("stopped");
  });
});
