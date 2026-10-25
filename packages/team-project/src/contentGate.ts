import type { Clock } from "./types.js";

/** Things a child makes that could reach other devices. Local-only content never comes here. */
export type ContentKind = "image" | "name";

/** What the on-device classifier says. Anything but `safe` keeps the content on its own device. */
export type LocalVerdict = "safe" | "unsafe" | "uncertain" | "unavailable";

export type RejectionReason = "invalid" | "unsafe" | "uncertain" | "unavailable";

export type GateErrorCode =
  "NOT_FOUND" | "NOT_QUEUED" | "NOT_APPROVED" | "QUEUE_FULL" | "PAYLOAD_TOO_LARGE";

/** Fixed messages: the content itself is never echoed. */
export class GateError extends Error {
  constructor(
    readonly code: GateErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "GateError";
  }
}

export interface GateOptions {
  /** Deterministic sanitizer (for images `kidsImage.ts`). Returns undefined when it must not pass. */
  readonly sanitize: (kind: ContentKind, payload: string) => string | undefined;
  /** On-device model. No network: nothing is sent to any provider. */
  readonly classify: (kind: ContentKind, payload: string) => Promise<LocalVerdict>;
  readonly clock?: Clock;
  /**
   * Admin setting. False lets content the model called safe go straight to approved; the default
   * (true) holds everything for the organizer. Content that is not safe never gets here either way.
   */
  readonly holdAll?: boolean;
  readonly maxQueuedPerMember?: number;
  readonly maxPayloadChars?: number;
}

export interface QueuedItem {
  readonly itemId: string;
  readonly alias: string;
  readonly kind: ContentKind;
  /** The model's verdict is a hint for the organizer, never the decision. */
  readonly hint: "safe";
}

export type SubmitResult =
  | { readonly status: "queued"; readonly itemId: string }
  | { readonly status: "approved"; readonly itemId: string }
  | {
      readonly status: "rejected";
      /** Neutral and identical for every reason: it never describes or echoes the content. */
      readonly notice: string;
    };

export const NEUTRAL_NOTICE = "Este dibujo se queda solo en tu dispositivo.";

interface Entry {
  readonly itemId: string;
  readonly slotId: string;
  readonly alias: string;
  readonly kind: ContentKind;
  readonly payload: string;
  status: "queued" | "approved";
}

/**
 * Pipeline for content that would be shown to the rest of the group: deterministic sanitizer, then
 * the local model, failing closed, then the organizer's approval. It keeps content only while it
 * waits for a decision or while it is approved for distribution, and logs only coarse counts.
 */
export class ContentGate {
  private readonly entries = new Map<string, Entry>();
  private readonly counts: Record<RejectionReason, number> = {
    invalid: 0,
    unsafe: 0,
    uncertain: 0,
    unavailable: 0,
  };
  private counter = 0;
  private readonly maxQueued: number;
  private readonly maxChars: number;

  constructor(private readonly options: GateOptions) {
    this.maxQueued = options.maxQueuedPerMember ?? 5;
    this.maxChars = options.maxPayloadChars ?? 1_000_000;
  }

  async submit(
    slotId: string,
    alias: string,
    kind: ContentKind,
    payload: string,
  ): Promise<SubmitResult> {
    if (payload.length > this.maxChars) {
      throw new GateError("PAYLOAD_TOO_LARGE", "Too large.");
    }
    const waiting = [...this.entries.values()].filter(
      (entry) => entry.slotId === slotId && entry.status === "queued",
    ).length;
    if (waiting >= this.maxQueued) throw new GateError("QUEUE_FULL", "Too many waiting.");

    const clean = this.options.sanitize(kind, payload);
    if (clean === undefined) return this.reject("invalid");

    let verdict: LocalVerdict;
    try {
      verdict = await this.options.classify(kind, clean);
    } catch {
      verdict = "unavailable";
    }
    if (verdict !== "safe") return this.reject(verdict === "unsafe" ? "unsafe" : verdict);

    const itemId = `item_${++this.counter}`;
    const auto = this.options.holdAll === false;
    this.entries.set(itemId, {
      itemId,
      slotId,
      alias,
      kind,
      payload: clean,
      status: auto ? "approved" : "queued",
    });
    return { status: auto ? "approved" : "queued", itemId };
  }

  /** What waits for the organizer. No content: they open one item at a time with `inspect`. */
  queue(): readonly QueuedItem[] {
    return [...this.entries.values()]
      .filter((entry) => entry.status === "queued")
      .map((entry) => ({
        itemId: entry.itemId,
        alias: entry.alias,
        kind: entry.kind,
        hint: "safe" as const,
      }));
  }

  /** Organizer only: the sanitized content of one waiting item. */
  inspect(itemId: string): string {
    const entry = this.entries.get(itemId);
    if (entry === undefined || entry.status !== "queued") {
      throw new GateError("NOT_FOUND", "No such item.");
    }
    return entry.payload;
  }

  decide(itemId: string, decision: "approve" | "reject"): void {
    const entry = this.entries.get(itemId);
    if (entry === undefined || entry.status !== "queued") {
      throw new GateError("NOT_QUEUED", "Not waiting.");
    }
    if (decision === "reject") this.entries.delete(itemId);
    else entry.status = "approved";
  }

  /** The only way content reaches another device: an item the organizer approved. */
  sharedPayload(itemId: string): string {
    const entry = this.entries.get(itemId);
    if (entry === undefined || entry.status !== "approved") {
      throw new GateError("NOT_APPROVED", "Not approved.");
    }
    return entry.payload;
  }

  forgetMember(slotId: string): void {
    for (const [id, entry] of this.entries) if (entry.slotId === slotId) this.entries.delete(id);
  }

  /** Group closed: drop everything. */
  clear(): void {
    this.entries.clear();
  }

  stats(): { readonly rejected: Readonly<Record<RejectionReason, number>> } {
    return { rejected: { ...this.counts } };
  }

  private reject(reason: RejectionReason): SubmitResult {
    this.counts[reason] += 1;
    return { status: "rejected", notice: NEUTRAL_NOTICE };
  }
}

export interface ScoreThresholds {
  /** A score at or above this is unsafe. */
  readonly unsafe: number;
  /** A score at or above this, and below unsafe, is uncertain. Both block. */
  readonly uncertain: number;
}

/**
 * Turns a model score (0 harmless, 1 certainly harmful) into a verdict. A score that is missing,
 * not a number or outside 0..1 is "uncertain": a broken model never reads as safe.
 */
export function verdictFromScore(score: unknown, thresholds: ScoreThresholds): LocalVerdict {
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    return "uncertain";
  }
  if (score >= thresholds.unsafe) return "unsafe";
  if (score >= thresholds.uncertain) return "uncertain";
  return "safe";
}
