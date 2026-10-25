import type { ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import type { Clock } from "./types.js";

export type GalleryErrorCode = "NOT_ADMITTED" | "NOT_FOUND" | "GALLERY_FULL" | "INVALID_INPUT";

/** Fixed messages: neither a project nor a child's content is ever echoed. */
export class GalleryError extends Error {
  constructor(
    readonly code: GalleryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GalleryError";
  }
}

/** A team is a fixed id, never a name a child typed. */
const TEAM_ID = /^equipo-[1-4]$/;

export interface GalleryMeta {
  readonly teamId: `equipo-${1 | 2 | 3 | 4}`;
  /** Sequence number of the team project when it was shown. */
  readonly version: number;
  /** Generated aliases of who contributed. Visible only to devices admitted to the session. */
  readonly contributors: readonly string[];
}

export interface GalleryEntry {
  readonly entryId: string;
  readonly teamId: string;
  readonly version: number;
  readonly contributors: readonly string[];
  readonly programHash: string;
  readonly publishedAt: string;
}

export interface GalleryOptions {
  /** Is this device still in the session? Asked on every read, so expulsion closes access at once. */
  readonly isAdmitted: (slotId: string) => boolean;
  readonly clock?: Clock;
  readonly maxEntries?: number;
}

/**
 * The closed gallery of one group (ADR 0010, F4): a handful of project snapshots the organizer
 * chose to show, readable only by devices admitted to the session. No URL, index, search, comment
 * or remix exists; the data lives in memory and is cleared when the group closes.
 */
export class GroupGallery {
  private readonly entries = new Map<string, { entry: GalleryEntry; program: ProjectProgram }>();
  private readonly clock: Clock;
  private readonly maxEntries: number;
  private counter = 0;

  constructor(private readonly options: GalleryOptions) {
    this.clock = options.clock ?? { now: () => new Date() };
    this.maxEntries = options.maxEntries ?? 3;
  }

  /** Organizer action: show a snapshot of the team project to the group. */
  publish(program: ProjectProgram, meta: GalleryMeta): string {
    if (!TEAM_ID.test(meta.teamId) || !Number.isInteger(meta.version) || meta.version < 0) {
      throw new GalleryError("INVALID_INPUT", "Invalid project.");
    }
    if (this.entries.size >= this.maxEntries) {
      throw new GalleryError("GALLERY_FULL", "Withdraw a project first.");
    }
    const entryId = `gal_${++this.counter}`;
    this.entries.set(entryId, {
      entry: {
        entryId,
        teamId: meta.teamId,
        version: meta.version,
        contributors: [...meta.contributors],
        programHash: programSemanticHash(program),
        publishedAt: this.clock.now().toISOString(),
      },
      program: structuredClone(program),
    });
    return entryId;
  }

  /** Organizer action: takes effect immediately for every device. */
  withdraw(entryId: string): void {
    if (!this.entries.delete(entryId)) throw new GalleryError("NOT_FOUND", "No such project.");
  }

  list(slotId: string): readonly GalleryEntry[] {
    this.assertAdmitted(slotId);
    return [...this.entries.values()].map(({ entry }) => entry);
  }

  /** Organizer view of what is shown. The organizer is not a child device, so no slot is asked. */
  listAll(): readonly GalleryEntry[] {
    return [...this.entries.values()].map(({ entry }) => entry);
  }

  /** A copy of the snapshot, so a viewer can never alter what the others see. */
  open(entryId: string, slotId: string): ProjectProgram {
    this.assertAdmitted(slotId);
    const found = this.entries.get(entryId);
    if (found === undefined) throw new GalleryError("NOT_FOUND", "No such project.");
    return structuredClone(found.program);
  }

  clear(): void {
    this.entries.clear();
  }

  private assertAdmitted(slotId: string): void {
    if (!this.options.isAdmitted(slotId)) {
      throw new GalleryError("NOT_ADMITTED", "Not in this session.");
    }
  }
}
