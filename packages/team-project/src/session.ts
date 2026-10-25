import type { ProjectProgram } from "@agorix/program-model";
import {
  ProposalValidationError,
  acceptProposal,
  createProposalReview,
  programSemanticHash,
  type ProgramProposal,
  type ProposalReview,
} from "@agorix/proposals";
import {
  DEFAULT_TEAM_POLICY,
  REACTION_IDS,
  TeamError,
  type ChangeOrigin,
  type ChangeStatus,
  type Clock,
  type EditMode,
  type HistoryEntry,
  type PendingChange,
  type ReactionId,
  type ReactionTarget,
  type TeamMember,
  type TeamPolicy,
  type TeamSessionOptions,
  type TeamSnapshot,
} from "./types.js";

interface Change {
  readonly proposal: ProgramProposal;
  readonly proposerSlotId: string;
  readonly origin: ChangeOrigin;
  readonly review: ProposalReview;
  status: ChangeStatus;
  readonly accept: Set<string>;
  readonly reject: Set<string>;
}

interface StoredReaction {
  readonly from: string;
  readonly reaction: ReactionId;
  readonly target: string;
}

/**
 * The host's authoritative view of one team project (ADR 0010). It owns the order of changes:
 * every change is a reviewable proposal built on the current program, attributed to a generated
 * alias, accepted by the team and applied exactly once with a global sequence number. It holds
 * no network, no storage and no child text, so the transport (F3) can sit on top unchanged.
 */
export class TeamSession {
  private current: ProjectProgram;
  private readonly roster = new Map<string, TeamMember>();
  private readonly mode: EditMode;
  private readonly policy: TeamPolicy;
  private readonly clock: Clock;
  private readonly changes = new Map<string, Change>();
  private readonly log: HistoryEntry[] = [];
  /** Program before each applied entry, so the last change can be rolled back. */
  private readonly undo: { seq: number; program: ProjectProgram }[] = [];
  private turnSlot: string | undefined;
  private sequence = 0;
  private reactionsOn = true;
  private readonly reactions: StoredReaction[] = [];
  private readonly recent = new Map<string, number[]>();
  private readonly muted = new Map<string, Set<string>>();

  constructor(options: TeamSessionOptions) {
    this.current = options.program;
    this.mode = options.mode;
    this.policy = { ...DEFAULT_TEAM_POLICY, ...options.policy };
    this.clock = options.clock ?? { now: () => new Date() };
    for (const member of options.members) this.roster.set(member.slotId, member);
    if (!this.editors().length) throw new TeamError("INVALID_INPUT", "A team needs an editor.");
    this.turnSlot = this.mode.kind === "turns" ? this.editors()[0]?.slotId : undefined;
  }

  // ---- read side -------------------------------------------------------------------------

  get program(): ProjectProgram {
    return this.current;
  }

  get seq(): number {
    return this.sequence;
  }

  turn(): string | undefined {
    return this.turnSlot;
  }

  members(): readonly TeamMember[] {
    return [...this.roster.values()];
  }

  history(): readonly HistoryEntry[] {
    return [...this.log];
  }

  pending(): readonly PendingChange[] {
    return [...this.changes.values()].map((change) => this.view(change));
  }

  snapshotFor(slotId: string): TeamSnapshot {
    this.member(slotId);
    return {
      program: this.current,
      programHash: programSemanticHash(this.current),
      seq: this.sequence,
      history: this.history(),
    };
  }

  /** The only thing Ori ever sees: the program. No alias, slot, roster or group identity. */
  oriView(): { readonly program: ProjectProgram; readonly programHash: string } {
    return { program: this.current, programHash: programSemanticHash(this.current) };
  }

  // ---- changes ---------------------------------------------------------------------------

  /** Open a change. Returns its id. Throws unless the member may edit right now. */
  submit(slotId: string, proposal: ProgramProposal): string {
    const member = this.member(slotId);
    if (member.role === "testing") throw new TeamError("CANNOT_EDIT", "Testers do not edit.");
    this.assertMayEdit(slotId, proposal);
    for (const [id, change] of this.changes) {
      if (change.proposerSlotId !== slotId) continue;
      if (change.status === "stale") this.changes.delete(id);
      else throw new TeamError("ALREADY_PENDING", "Finish your open change first.");
    }
    if (this.changes.has(proposal.id)) throw new TeamError("ALREADY_PENDING", "Duplicate change.");

    let review: ProposalReview;
    try {
      review = createProposalReview(this.current, proposal);
    } catch (error) {
      if (error instanceof ProposalValidationError) {
        throw new TeamError(
          error.code === "STALE_PROPOSAL" ? "STALE_BASE" : "INVALID_PROPOSAL",
          "The change cannot be applied.",
        );
      }
      throw error;
    }
    const origin: ChangeOrigin = proposal.source.kind === "learning-companion" ? "ori" : "child";
    this.changes.set(proposal.id, {
      proposal,
      proposerSlotId: slotId,
      origin,
      review,
      status: origin === "ori" ? "awaiting-requester" : "pending",
      accept: new Set(),
      reject: new Set(),
    });
    return proposal.id;
  }

  withdraw(slotId: string, changeId: string): void {
    this.member(slotId);
    const change = this.changes.get(changeId);
    if (change === undefined || change.proposerSlotId !== slotId) {
      throw new TeamError("NOT_FOUND", "No such change.");
    }
    this.changes.delete(changeId);
    this.advanceTurnFrom(slotId);
  }

  /**
   * A team member votes on an open change. For an Ori proposal the requesting child decides first
   * (accepting hands it to the team); nobody else can vote until then.
   */
  vote(slotId: string, changeId: string, decision: "accept" | "reject"): ChangeStatus {
    this.member(slotId);
    const change = this.changes.get(changeId);
    if (change === undefined) throw new TeamError("NOT_FOUND", "No such change.");
    if (change.status === "awaiting-requester") {
      if (slotId !== change.proposerSlotId) throw new TeamError("NOT_OPEN", "Not open yet.");
      if (decision === "reject") return this.close(change, "rejected");
      change.status = "pending";
      return change.status;
    }
    if (change.status !== "pending") throw new TeamError("NOT_OPEN", "Not open.");
    if (slotId === change.proposerSlotId) {
      throw new TeamError("CANNOT_VOTE_OWN", "The team decides, not the author.");
    }
    if (change.accept.has(slotId) || change.reject.has(slotId)) {
      throw new TeamError("ALREADY_DECIDED", "You already voted.");
    }
    (decision === "accept" ? change.accept : change.reject).add(slotId);

    const others = this.roster.size - 1;
    const needed = Math.floor(others / 2) + 1;
    if (change.accept.size >= needed) return this.apply(change);
    if (change.reject.size > others - needed) return this.close(change, "rejected");
    return change.status;
  }

  passTurn(slotId: string): void {
    this.member(slotId);
    if (this.mode.kind !== "turns" || this.turnSlot !== slotId) {
      throw new TeamError("NOT_YOUR_TURN", "It is not your turn.");
    }
    this.advanceTurnFrom(slotId);
  }

  /** Undo the most recent applied change as a new ordered entry (host / organizer action). */
  rollbackLast(): HistoryEntry {
    const last = this.undo.pop();
    if (last === undefined) throw new TeamError("NOTHING_TO_ROLL_BACK", "Nothing to undo.");
    const baseHash = programSemanticHash(this.current);
    this.current = last.program;
    const entry: HistoryEntry = {
      seq: ++this.sequence,
      kind: "rolled-back",
      ofSeq: last.seq,
      baseHash,
      resultHash: programSemanticHash(this.current),
      at: this.clock.now().toISOString(),
    };
    this.log.push(entry);
    this.markStale();
    return entry;
  }

  /** Expulsion or leaving: their open change goes, their turn and blocks are released. */
  removeMember(slotId: string): void {
    this.member(slotId);
    for (const [id, change] of this.changes) {
      if (change.proposerSlotId === slotId) this.changes.delete(id);
      change.accept.delete(slotId);
      change.reject.delete(slotId);
    }
    const wasTurn = this.turnSlot === slotId;
    this.roster.delete(slotId);
    this.muted.delete(slotId);
    if (this.mode.kind === "turns" && wasTurn) {
      this.turnSlot = this.nextEditorAfter(slotId, [...this.roster.keys()]);
    }
  }

  // ---- reactions -------------------------------------------------------------------------

  react(slotId: string, reaction: ReactionId, target: ReactionTarget): void {
    this.member(slotId);
    if (!this.reactionsOn) throw new TeamError("REACTIONS_OFF", "Reactions are off.");
    if (!(REACTION_IDS as readonly unknown[]).includes(reaction)) {
      throw new TeamError("INVALID_INPUT", "Unknown reaction.");
    }
    const key = this.targetKey(target);
    const now = this.clock.now().getTime();
    const window = (this.recent.get(slotId) ?? []).filter(
      (at) => now - at < this.policy.reactionWindowMs,
    );
    if (window.length >= this.policy.reactionsPerWindow) {
      this.recent.set(slotId, window);
      throw new TeamError("RATE_LIMITED", "Slow down.");
    }
    window.push(now);
    this.recent.set(slotId, window);
    this.reactions.push({ from: slotId, reaction, target: key });
    if (this.reactions.length > this.policy.maxStoredReactions) this.reactions.shift();
  }

  /** Counts per fixed reaction, without the ones from peers this viewer muted. */
  reactionsFor(viewerSlotId: string, target: ReactionTarget): Partial<Record<ReactionId, number>> {
    this.member(viewerSlotId);
    if (!this.reactionsOn) return {};
    const key = this.targetKey(target);
    const mutedByViewer = this.muted.get(viewerSlotId);
    const counts: Partial<Record<ReactionId, number>> = {};
    for (const item of this.reactions) {
      if (item.target !== key || mutedByViewer?.has(item.from)) continue;
      counts[item.reaction] = (counts[item.reaction] ?? 0) + 1;
    }
    return counts;
  }

  mute(viewerSlotId: string, peerSlotId: string): void {
    this.member(viewerSlotId);
    this.member(peerSlotId);
    const set = this.muted.get(viewerSlotId) ?? new Set<string>();
    set.add(peerSlotId);
    this.muted.set(viewerSlotId, set);
  }

  unmute(viewerSlotId: string, peerSlotId: string): void {
    this.member(viewerSlotId);
    this.muted.get(viewerSlotId)?.delete(peerSlotId);
  }

  /** Organizer switch. */
  setReactionsEnabled(enabled: boolean): void {
    this.reactionsOn = enabled;
  }

  // ---- internals -------------------------------------------------------------------------

  private member(slotId: string): TeamMember {
    const member = this.roster.get(slotId);
    if (member === undefined) throw new TeamError("NOT_A_MEMBER", "Not in this team.");
    return member;
  }

  private editors(): TeamMember[] {
    return [...this.roster.values()].filter((member) => member.role !== "testing");
  }

  private assertMayEdit(slotId: string, proposal: ProgramProposal): void {
    if (this.mode.kind === "turns") {
      if (this.turnSlot !== slotId) throw new TeamError("NOT_YOUR_TURN", "It is not your turn.");
      return;
    }
    const scripts = proposal.affectedScriptIds;
    if (scripts === undefined || scripts.length === 0) {
      throw new TeamError("SCOPE_VIOLATION", "Say which blocks the change touches.");
    }
    for (const scriptId of scripts) {
      if (this.mode.assignments[scriptId] !== slotId) {
        throw new TeamError("SCOPE_VIOLATION", "Those blocks belong to someone else.");
      }
    }
  }

  private apply(change: Change): ChangeStatus {
    const baseHash = programSemanticHash(this.current);
    const result = acceptProposal(this.current, change.review);
    const member = this.member(change.proposerSlotId);
    this.undo.push({ seq: this.sequence + 1, program: this.current });
    this.current = result.program;
    this.log.push({
      seq: ++this.sequence,
      kind: "applied",
      changeId: change.proposal.id,
      alias: member.alias,
      role: member.role,
      origin: change.origin,
      baseHash,
      resultHash: programSemanticHash(this.current),
      at: this.clock.now().toISOString(),
    });
    change.status = "applied";
    this.changes.delete(change.proposal.id);
    this.markStale();
    this.advanceTurnFrom(change.proposerSlotId);
    return "applied";
  }

  private close(change: Change, status: "rejected"): ChangeStatus {
    change.status = status;
    this.changes.delete(change.proposal.id);
    this.advanceTurnFrom(change.proposerSlotId);
    return status;
  }

  /** Any open change whose base is no longer the current program can no longer be applied. */
  private markStale(): void {
    const hash = programSemanticHash(this.current);
    for (const change of this.changes.values()) {
      if (change.proposal.baseProgramHash !== hash) change.status = "stale";
    }
  }

  private advanceTurnFrom(slotId: string): void {
    if (this.mode.kind !== "turns" || this.turnSlot !== slotId) return;
    this.turnSlot = this.nextEditorAfter(slotId, [...this.roster.keys()]);
  }

  private nextEditorAfter(slotId: string, order: readonly string[]): string | undefined {
    const editors = new Set(this.editors().map((member) => member.slotId));
    const start = order.indexOf(slotId);
    for (let step = 1; step <= order.length; step += 1) {
      const candidate = order[(start + step) % order.length];
      if (candidate !== undefined && editors.has(candidate)) return candidate;
    }
    return undefined;
  }

  private targetKey(target: ReactionTarget): string {
    if (target.kind === "game") return "game";
    if (target.kind === "change" && this.changes.has(target.changeId)) {
      return `change:${target.changeId}`;
    }
    throw new TeamError("NOT_FOUND", "No such change.");
  }

  private view(change: Change): PendingChange {
    const member = this.member(change.proposerSlotId);
    return {
      changeId: change.proposal.id,
      alias: member.alias,
      role: member.role,
      origin: change.origin,
      status: change.status,
      preview: change.review.diff,
      accepted: change.accept.size,
      rejected: change.reject.size,
    };
  }
}
