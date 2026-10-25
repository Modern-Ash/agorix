import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { serializeAgorixProject } from "@agorix/persistence";
import { ProposalValidationError, parseProgramProposal } from "@agorix/proposals";
import {
  ContentGate,
  GalleryError,
  GateError,
  GroupGallery,
  REACTION_IDS,
  TeamError,
  TeamSession,
  type ContentKind,
  type GalleryEntry,
  type HistoryEntry,
  type LocalVerdict,
  type PendingChange,
  type QueuedItem,
  type ReactionId,
  type ReactionTarget,
  type TeamSummary,
  type TeamMember,
} from "@agorix/team-project";

export type HostMember = TeamMember;

/** One message from a team device. The host answers every one with a code and never throws. */
export type TeamMessage =
  | { readonly type: "propose"; readonly proposal: unknown }
  | { readonly type: "vote"; readonly changeId: string; readonly decision: "accept" | "reject" }
  | { readonly type: "withdraw"; readonly changeId: string }
  | { readonly type: "pass" }
  | { readonly type: "react"; readonly reaction: ReactionId; readonly target: ReactionTarget }
  | { readonly type: "share"; readonly kind: ContentKind; readonly payload: string }
  | { readonly type: "gallery" }
  | { readonly type: "gallery-open"; readonly entryId: string };

export type HostReply =
  | {
      readonly ok: true;
      readonly status?: string;
      readonly queued?: boolean;
      readonly shared?: false;
      readonly notice?: string;
      readonly gallery?: readonly GalleryEntry[];
      readonly program?: ProjectProgram;
    }
  | { readonly ok: false; readonly code: string };

export interface TeamHostOptions {
  readonly members: readonly HostMember[];
  readonly mode: "turns" | "blocks";
  readonly program?: ProjectProgram;
  /** On-device classifier. Absent means "unavailable", so nothing is ever shared. */
  readonly classify?: (kind: ContentKind, payload: string) => Promise<LocalVerdict>;
  readonly now?: () => Date;
  readonly messagesPerWindow?: number;
  readonly windowMs?: number;
  /** Malformed messages from one device before the host stops listening to it. */
  readonly violationsToBlock?: number;
}

export interface HostSnapshot {
  readonly program: ProjectProgram;
  readonly seq: number;
  readonly turn: string | undefined;
  readonly members: readonly HostMember[];
  readonly pending: readonly PendingChange[];
  readonly history: readonly HistoryEntry[];
}

const MAX_MESSAGE_CHARS = 256_000;
const MAX_ID_CHARS = 128;
const NAME = /^[\p{L}\p{N} _.-]{1,24}$/u;
const IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]{1,200000}$/;
const PHONE_LIKE = /\d[\d\s().-]{5,}\d/;

/** One script per editor, so block mode has something to assign. Testers get none. */
export function starterTeamProgram(members: readonly HostMember[]): ProjectProgram {
  const editors = members.filter((member) => member.role !== "testing");
  return {
    schema: SCHEMA_VERSION,
    scripts: editors.map((_, index) => ({
      id: `script-${index + 1}`,
      trigger: { type: "onStart" as const },
      statements: [],
    })),
  };
}

/** Deterministic first gate for anything that would reach another device. */
export function defaultSanitize(kind: ContentKind, payload: string): string | undefined {
  if (kind === "name") {
    const name = payload.trim();
    return NAME.test(name) && !PHONE_LIKE.test(name) ? name : undefined;
  }
  return IMAGE.test(payload) ? payload : undefined;
}

class Invalid extends Error {}
class TooLarge extends Invalid {}

/**
 * Host-side controller of one team project: validates every message from other devices (shape,
 * size, rate), drives the session and the content gate, and tells the organizer's UI to redraw.
 * The transport (F3) only has to call `handle`. Nothing here touches the network or storage.
 */
export class TeamHost {
  private readonly session: TeamSession;
  private readonly gate: ContentGate;
  private readonly gallery: GroupGallery;
  private readonly listeners = new Set<() => void>();
  private readonly blockedListeners = new Set<(slotId: string) => void>();
  private readonly recent = new Map<string, number[]>();
  private readonly violations = new Map<string, number>();
  private readonly blocked = new Set<string>();
  private readonly now: () => Date;
  private readonly perWindow: number;
  private readonly windowMs: number;
  private readonly toBlock: number;
  private readonly aliases = new Map<string, string>();

  constructor(options: TeamHostOptions) {
    this.now = options.now ?? (() => new Date());
    this.perWindow = options.messagesPerWindow ?? 30;
    this.windowMs = options.windowMs ?? 10_000;
    this.toBlock = options.violationsToBlock ?? 5;
    for (const member of options.members) this.aliases.set(member.slotId, member.alias);
    const program = options.program ?? starterTeamProgram(options.members);
    const editors = options.members.filter((member) => member.role !== "testing");
    this.session = new TeamSession({
      program,
      members: options.members,
      mode:
        options.mode === "turns"
          ? { kind: "turns" }
          : {
              kind: "blocks",
              assignments: Object.fromEntries(
                program.scripts.map((script, index) => [script.id, editors[index]?.slotId ?? ""]),
              ),
            },
      clock: { now: this.now },
    });
    this.gallery = new GroupGallery({
      clock: { now: this.now },
      // Admission is the session roster itself: an expelled device loses the gallery at once.
      isAdmitted: (slotId) => this.session.members().some((member) => member.slotId === slotId),
    });
    this.gate = new ContentGate({
      clock: { now: this.now },
      sanitize: defaultSanitize,
      classify: options.classify ?? (async () => "unavailable"),
    });
  }

  get program(): ProjectProgram {
    return this.session.program;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  onBlocked(listener: (slotId: string) => void): () => void {
    this.blockedListeners.add(listener);
    return () => void this.blockedListeners.delete(listener);
  }

  snapshot(): HostSnapshot {
    const turn = this.session.turn();
    return {
      program: this.session.program,
      seq: this.session.seq,
      turn,
      members: this.session.members(),
      pending: this.session.pending(),
      history: this.session.history(),
    };
  }

  oriView() {
    return this.session.oriView();
  }

  // ---- messages from team devices ---------------------------------------------------------

  async handle(slotId: string, raw: unknown): Promise<HostReply> {
    if (!this.aliases.has(slotId) || !this.session.members().some((m) => m.slotId === slotId)) {
      return { ok: false, code: "NOT_A_MEMBER" };
    }
    if (this.blocked.has(slotId)) return { ok: false, code: "BLOCKED" };
    if (!this.withinRate(slotId)) return { ok: false, code: "RATE_LIMITED" };
    try {
      const reply = await this.dispatch(slotId, this.parse(raw));
      this.notify();
      return reply;
    } catch (error) {
      if (error instanceof TooLarge) return this.violation(slotId, "TOO_LARGE");
      if (error instanceof Invalid) return this.violation(slotId, "INVALID");
      if (error instanceof TeamError) return { ok: false, code: error.code };
      if (error instanceof GateError) return { ok: false, code: error.code };
      if (error instanceof GalleryError) return { ok: false, code: error.code };
      return this.violation(slotId, "INVALID");
    }
  }

  private async dispatch(slotId: string, message: TeamMessage): Promise<HostReply> {
    switch (message.type) {
      case "propose": {
        let proposal;
        try {
          proposal = parseProgramProposal(message.proposal);
        } catch (error) {
          if (error instanceof ProposalValidationError) throw new Invalid();
          throw error;
        }
        this.session.submit(slotId, proposal);
        return { ok: true };
      }
      case "vote":
        return { ok: true, status: this.session.vote(slotId, message.changeId, message.decision) };
      case "withdraw":
        this.session.withdraw(slotId, message.changeId);
        return { ok: true };
      case "pass":
        this.session.passTurn(slotId);
        return { ok: true };
      case "react":
        this.session.react(slotId, message.reaction, message.target);
        return { ok: true };
      case "gallery":
        return { ok: true, gallery: this.gallery.list(slotId) };
      case "gallery-open":
        return { ok: true, program: this.gallery.open(message.entryId, slotId) };
      case "share": {
        const result = await this.gate.submit(
          slotId,
          this.aliases.get(slotId) ?? "",
          message.kind,
          message.payload,
        );
        return result.status === "queued"
          ? { ok: true, queued: true }
          : { ok: true, shared: false, notice: result.notice };
      }
    }
  }

  /** Strict: exactly the keys of one known message, bounded strings, fixed enumerations. */
  private parse(raw: unknown): TeamMessage {
    let size: number;
    try {
      size = JSON.stringify(raw)?.length ?? 0;
    } catch {
      throw new Invalid();
    }
    if (size > MAX_MESSAGE_CHARS) throw new TooLarge();
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Invalid();
    const message = raw as Record<string, unknown>;
    const only = (...keys: string[]) => {
      const present = Object.keys(message).sort().join(",");
      if (present !== ["type", ...keys].sort().join(",")) throw new Invalid();
    };
    const id = (value: unknown): string => {
      if (typeof value !== "string" || value === "" || value.length > MAX_ID_CHARS) {
        throw new Invalid();
      }
      return value;
    };
    switch (message["type"]) {
      case "propose":
        only("proposal");
        return { type: "propose", proposal: message["proposal"] };
      case "vote":
        only("changeId", "decision");
        if (message["decision"] !== "accept" && message["decision"] !== "reject")
          throw new Invalid();
        return { type: "vote", changeId: id(message["changeId"]), decision: message["decision"] };
      case "withdraw":
        only("changeId");
        return { type: "withdraw", changeId: id(message["changeId"]) };
      case "pass":
        only();
        return { type: "pass" };
      case "react": {
        only("reaction", "target");
        if (!(REACTION_IDS as readonly unknown[]).includes(message["reaction"]))
          throw new Invalid();
        const target = message["target"] as Record<string, unknown> | null;
        if (typeof target !== "object" || target === null) throw new Invalid();
        const reaction = message["reaction"] as ReactionId;
        if (target["kind"] === "game" && Object.keys(target).length === 1) {
          return { type: "react", reaction, target: { kind: "game" } };
        }
        if (target["kind"] === "change" && Object.keys(target).length === 2) {
          return {
            type: "react",
            reaction,
            target: { kind: "change", changeId: id(target["changeId"]) },
          };
        }
        throw new Invalid();
      }
      case "gallery":
        only();
        return { type: "gallery" };
      case "gallery-open":
        only("entryId");
        return { type: "gallery-open", entryId: id(message["entryId"]) };
      case "share": {
        only("kind", "payload");
        if (message["kind"] !== "image" && message["kind"] !== "name") throw new Invalid();
        if (typeof message["payload"] !== "string") throw new Invalid();
        return { type: "share", kind: message["kind"], payload: message["payload"] };
      }
      default:
        throw new Invalid();
    }
  }

  private withinRate(slotId: string): boolean {
    const now = this.now().getTime();
    const window = (this.recent.get(slotId) ?? []).filter((at) => now - at < this.windowMs);
    if (window.length >= this.perWindow) {
      this.recent.set(slotId, window);
      return false;
    }
    window.push(now);
    this.recent.set(slotId, window);
    return true;
  }

  private violation(slotId: string, code: string): HostReply {
    const count = (this.violations.get(slotId) ?? 0) + 1;
    this.violations.set(slotId, count);
    if (count >= this.toBlock && !this.blocked.has(slotId)) {
      this.blocked.add(slotId);
      for (const listener of this.blockedListeners) listener(slotId);
    }
    return { ok: false, code };
  }

  // ---- organizer actions ------------------------------------------------------------------

  rollbackLast(): void {
    this.session.rollbackLast();
    this.notify();
  }

  removeMember(slotId: string): void {
    if (this.session.members().some((member) => member.slotId === slotId)) {
      this.session.removeMember(slotId);
    }
    this.gate.forgetMember(slotId);
    this.recent.delete(slotId);
    this.violations.delete(slotId);
    this.blocked.delete(slotId);
    this.notify();
  }

  /** Organizer: stop one device's reactions for everyone. */
  silence(slotId: string, silenced: boolean): void {
    this.session.silence(slotId, silenced);
    this.notify();
  }

  summary(): TeamSummary {
    return this.session.summary();
  }

  /** Organizer: show a snapshot of the team project to the admitted devices. */
  publishToGallery(): string {
    const summary = this.session.summary();
    const id = this.gallery.publish(this.session.program, {
      teamId: "equipo-1",
      version: this.session.seq,
      contributors: summary.members.filter((member) => member.applied > 0).map((m) => m.alias),
    });
    this.notify();
    return id;
  }

  /** Organizer: takes effect at once on every device. */
  withdrawFromGallery(entryId: string): void {
    this.gallery.withdraw(entryId);
    this.notify();
  }

  galleryEntries(): readonly GalleryEntry[] {
    return this.gallery.listAll();
  }

  setReactionsEnabled(enabled: boolean): void {
    this.session.setReactionsEnabled(enabled);
    this.notify();
  }

  contentQueue(): readonly QueuedItem[] {
    return this.gate.queue();
  }

  inspectContent(itemId: string): string {
    return this.gate.inspect(itemId);
  }

  decideContent(itemId: string, decision: "approve" | "reject"): void {
    this.gate.decide(itemId, decision);
    this.notify();
  }

  /** The only way content reaches another device: an item the organizer approved. */
  approvedContent(itemId: string): string {
    return this.gate.sharedPayload(itemId);
  }

  /** Explicit export of a normal `.agorix` file: the program only, no aliases, slots or history. */
  exportAgorix(): string {
    const at = this.now().toISOString();
    return serializeAgorixProject({
      schemaVersion: SCHEMA_VERSION,
      program: this.session.program,
      metadata: { createdAt: at, updatedAt: at, missionProgress: 0, hintLevel: 0 },
    });
  }

  /** Group closed: forget the content, the queue and the listeners. */
  close(): void {
    this.gate.clear();
    this.gallery.clear();
    this.listeners.clear();
    this.blockedListeners.clear();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
