import type { ProjectProgram } from "@agorix/program-model";
import type { ProposalDiffEntry } from "@agorix/proposals";

export interface Clock {
  now(): Date;
}

/**
 * What a child does in the team. Testers run and react but never edit. A role is a label from a
 * fixed list: nothing a child types is stored.
 */
export const TEAM_ROLES = ["characters", "scene", "rules", "testing"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** The only reactions that exist: no words, no phrases. */
export const REACTION_IDS = ["like", "party", "think", "heart"] as const;
export type ReactionId = (typeof REACTION_IDS)[number];

export type ReactionTarget =
  { readonly kind: "game" } | { readonly kind: "change"; readonly changeId: string };

export interface TeamMember {
  readonly slotId: string;
  /** Generated alias from the group roster. */
  readonly alias: string;
  readonly role: TeamRole;
}

/** v1 has no simultaneous editing: by turns, or by blocks (scripts) assigned to one member each. */
export type EditMode =
  | { readonly kind: "turns" }
  | { readonly kind: "blocks"; readonly assignments: Readonly<Record<string, string>> };

export interface TeamPolicy {
  readonly reactionsPerWindow: number;
  readonly reactionWindowMs: number;
  /** Bound on stored reactions so a noisy peer cannot grow memory. */
  readonly maxStoredReactions: number;
}

export const DEFAULT_TEAM_POLICY: TeamPolicy = {
  reactionsPerWindow: 5,
  reactionWindowMs: 10_000,
  maxStoredReactions: 200,
};

export type TeamErrorCode =
  | "NOT_A_MEMBER"
  | "NOT_YOUR_TURN"
  | "CANNOT_EDIT"
  | "SCOPE_VIOLATION"
  | "STALE_BASE"
  | "INVALID_PROPOSAL"
  | "ALREADY_PENDING"
  | "NOT_FOUND"
  | "NOT_OPEN"
  | "ALREADY_DECIDED"
  | "CANNOT_VOTE_OWN"
  | "NOTHING_TO_ROLL_BACK"
  | "INVALID_INPUT"
  | "RATE_LIMITED"
  | "REACTIONS_OFF";

/** Fixed messages: neither a program nor a child's content is ever echoed. */
export class TeamError extends Error {
  constructor(
    readonly code: TeamErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TeamError";
  }
}

export type ChangeOrigin = "child" | "ori";

/**
 * Lifecycle of a change. `awaiting-requester` only exists for Ori proposals: the child who asked
 * decides first; the team votes afterwards. `stale` means the program moved on under it.
 */
export type ChangeStatus = "awaiting-requester" | "pending" | "stale" | "applied" | "rejected";

export interface PendingChange {
  readonly changeId: string;
  readonly alias: string;
  readonly role: TeamRole;
  readonly origin: ChangeOrigin;
  readonly status: ChangeStatus;
  /** Deterministic preview of what would change, for the team to read before deciding. */
  readonly preview: readonly ProposalDiffEntry[];
  readonly accepted: number;
  readonly rejected: number;
}

export type HistoryEntry =
  | {
      readonly seq: number;
      readonly kind: "applied";
      readonly changeId: string;
      readonly alias: string;
      readonly role: TeamRole;
      readonly origin: ChangeOrigin;
      readonly baseHash: string;
      readonly resultHash: string;
      readonly at: string;
    }
  | {
      readonly seq: number;
      readonly kind: "rolled-back";
      readonly ofSeq: number;
      readonly baseHash: string;
      readonly resultHash: string;
      readonly at: string;
    };

/** What a (re)connecting member receives: the program, the order and attributed history. */
export interface TeamSnapshot {
  readonly program: ProjectProgram;
  readonly programHash: string;
  readonly seq: number;
  readonly history: readonly HistoryEntry[];
}

export interface TeamSessionOptions {
  readonly program: ProjectProgram;
  readonly members: readonly TeamMember[];
  readonly mode: EditMode;
  readonly policy?: Partial<TeamPolicy>;
  readonly clock?: Clock;
}
