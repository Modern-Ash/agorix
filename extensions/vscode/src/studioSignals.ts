import * as vscode from "vscode";
import {
  PROACTIVE_MIN_OCCURRENCES,
  createStudioSignal,
  type StudioProposalDecision,
  type StudioSignal,
  type StudioSignalKind,
} from "@agorix/learning-decision-plane";

export interface StudioSignalAdapterOptions {
  readonly onSignal: (signal: StudioSignal) => void;
  /** True for documents that belong to a Studio project (keeps unrelated editors silent). */
  readonly isStudioDocument: (document: vscode.TextDocument) => boolean;
  /** Maps selected 0-based line ranges to canonical node ids. No paths cross this boundary. */
  readonly nodeIdsForLines?: (startLine: number, endLine: number) => readonly string[];
  readonly selectionDebounceMs?: number;
  readonly stalledAfterMs?: number;
  readonly idleAfterMs?: number;
  readonly repeatedErrorThreshold?: number;
}

const DEFAULTS = {
  selectionDebounceMs: 250,
  stalledAfterMs: 60_000,
  idleAfterMs: 180_000,
  repeatedErrorThreshold: 2,
} as const;

/**
 * Thin VS Code adapter: translates host events into pure StudioSignal data.
 * It decides nothing; System 0 / LAYA decide whether to offer. No model calls.
 */
export class StudioSignalAdapter implements vscode.Disposable {
  readonly #opts: Required<Omit<StudioSignalAdapterOptions, "nodeIdsForLines">> &
    Pick<StudioSignalAdapterOptions, "nodeIdsForLines">;
  readonly #disposables: vscode.Disposable[] = [];
  #sequence = 0;
  #selectionTimer: ReturnType<typeof setTimeout> | undefined;
  #stalledTimer: ReturnType<typeof setTimeout> | undefined;
  #idleTimer: ReturnType<typeof setTimeout> | undefined;
  #lastErrorCode: string | undefined;
  #errorStreak = 0;
  #firstStepSent = false;
  #disposed = false;

  constructor(options: StudioSignalAdapterOptions) {
    this.#opts = {
      ...options,
      selectionDebounceMs: options.selectionDebounceMs ?? DEFAULTS.selectionDebounceMs,
      stalledAfterMs: options.stalledAfterMs ?? DEFAULTS.stalledAfterMs,
      idleAfterMs: options.idleAfterMs ?? DEFAULTS.idleAfterMs,
      repeatedErrorThreshold: options.repeatedErrorThreshold ?? DEFAULTS.repeatedErrorThreshold,
    };
    this.#disposables.push(
      vscode.window.onDidChangeTextEditorSelection((event) => this.#onSelection(event)),
      vscode.workspace.onDidChangeTextDocument((event) => this.#onEdit(event)),
    );
    this.#armIdle();
  }

  /** Deterministic runtime result from the host. `code` must be a short machine code. */
  runResult(result: { ok: boolean; code?: string; nodeId?: string }): void {
    if (this.#disposed) return;
    this.#clearStalled();
    this.#armIdle();
    if (result.ok) {
      this.#lastErrorCode = undefined;
      this.#errorStreak = 0;
      this.#emit("runtime-success", {});
      return;
    }
    const code = result.code ?? "unknown";
    this.#errorStreak = code === this.#lastErrorCode ? this.#errorStreak + 1 : 1;
    this.#lastErrorCode = code;
    const nodeIds = result.nodeId === undefined ? [] : [result.nodeId];
    this.#emit("runtime-error", { code, nodeIds });
    if (this.#errorStreak >= this.#opts.repeatedErrorThreshold) {
      this.#emit("repeated-error", { code, nodeIds, occurrences: this.#errorStreak });
    }
    this.#armStalled();
  }

  /** Host reports canonical program shape after edits; adapter maps it to signals. */
  programShape(shape: { statementCount: number; repeatOccurrences: number }): void {
    if (this.#disposed) return;
    if (shape.statementCount === 0 && !this.#firstStepSent) {
      this.#firstStepSent = true;
      this.#emit("first-step", { occurrences: 0 });
    } else if (shape.statementCount > 0) {
      this.#firstStepSent = false;
    }
    if (shape.repeatOccurrences >= PROACTIVE_MIN_OCCURRENCES) {
      this.#emit("repeat-pattern", { occurrences: shape.repeatOccurrences });
    }
  }

  proposalDecided(proposalId: string, decision: StudioProposalDecision): void {
    if (this.#disposed) return;
    this.#armIdle();
    this.#emit("proposal-decided", { proposalId, decision });
  }

  /** Cancels every pending timer and debounce without emitting. */
  cancelPending(): void {
    for (const timer of [this.#selectionTimer, this.#stalledTimer, this.#idleTimer]) {
      if (timer !== undefined) clearTimeout(timer);
    }
    this.#selectionTimer = this.#stalledTimer = this.#idleTimer = undefined;
  }

  dispose(): void {
    this.#disposed = true;
    this.cancelPending();
    for (const d of this.#disposables) d.dispose();
    this.#disposables.length = 0;
  }

  #onSelection(event: vscode.TextEditorSelectionChangeEvent): void {
    if (this.#disposed || !this.#opts.isStudioDocument(event.textEditor.document)) return;
    this.#armIdle();
    if (this.#selectionTimer !== undefined) clearTimeout(this.#selectionTimer);
    const ranges = event.selections.map((s) => ({ startLine: s.start.line, endLine: s.end.line }));
    this.#selectionTimer = setTimeout(() => {
      this.#selectionTimer = undefined;
      const nodeIds = ranges.flatMap(
        (r) => this.#opts.nodeIdsForLines?.(r.startLine, r.endLine) ?? [],
      );
      this.#emit("selection-changed", { ranges, nodeIds });
    }, this.#opts.selectionDebounceMs);
  }

  #onEdit(event: vscode.TextDocumentChangeEvent): void {
    if (this.#disposed || event.contentChanges.length === 0) return;
    if (!this.#opts.isStudioDocument(event.document)) return;
    // Editing is progress: it restarts the stall and idle clocks.
    this.#armIdle();
    if (this.#stalledTimer !== undefined) this.#armStalled();
  }

  #armStalled(): void {
    this.#clearStalled();
    this.#stalledTimer = setTimeout(() => {
      this.#stalledTimer = undefined;
      this.#emit("stalled", { seconds: Math.round(this.#opts.stalledAfterMs / 1000) });
    }, this.#opts.stalledAfterMs);
  }

  #clearStalled(): void {
    if (this.#stalledTimer !== undefined) clearTimeout(this.#stalledTimer);
    this.#stalledTimer = undefined;
  }

  #armIdle(): void {
    if (this.#idleTimer !== undefined) clearTimeout(this.#idleTimer);
    this.#idleTimer = setTimeout(() => {
      this.#idleTimer = undefined;
      this.#emit("idle", { seconds: Math.round(this.#opts.idleAfterMs / 1000) });
    }, this.#opts.idleAfterMs);
  }

  #emit(kind: StudioSignalKind, payload: Record<string, unknown>): void {
    const signal = createStudioSignal(kind, this.#sequence++, payload);
    if (signal !== undefined) this.#opts.onSignal(signal);
  }
}
