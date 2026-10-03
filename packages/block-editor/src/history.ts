import { validateProgram, type ProjectProgram } from "@agorix/program-model";

export interface CanonicalTransaction {
  readonly label: string;
  readonly before: ProjectProgram;
  readonly after: ProjectProgram;
}

export interface EditorHistorySnapshot {
  readonly past: readonly CanonicalTransaction[];
  readonly current: ProjectProgram;
  readonly future: readonly CanonicalTransaction[];
  readonly limit: number;
}

export interface EditorHistory {
  readonly past: readonly CanonicalTransaction[];
  readonly current: ProjectProgram;
  readonly future: readonly CanonicalTransaction[];
  readonly limit: number;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface TransactionResult {
  readonly history: EditorHistory;
  readonly applied: boolean;
}

export interface RestoreResult {
  readonly history: EditorHistory;
  readonly program: ProjectProgram;
}

export const DEFAULT_HISTORY_LIMIT = 50;

function cloneProgram(program: ProjectProgram): ProjectProgram {
  return structuredClone(validateProgram(program)) as ProjectProgram;
}

function semanticKey(program: ProjectProgram): string {
  return JSON.stringify(validateProgram(program));
}

function toPublicHistory(snapshot: EditorHistorySnapshot): EditorHistory {
  return {
    ...snapshot,
    canUndo: snapshot.past.length > 0,
    canRedo: snapshot.future.length > 0,
  };
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_HISTORY_LIMIT;
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("history limit must be a positive integer");
  }
  return limit;
}

export function createEditorHistory(
  current: ProjectProgram,
  options: { readonly limit?: number } = {},
): EditorHistory {
  return toPublicHistory({
    past: [],
    current: cloneProgram(current),
    future: [],
    limit: normalizeLimit(options.limit),
  });
}

export function recordCanonicalTransaction(
  history: EditorHistory,
  input: {
    readonly label: string;
    readonly after: ProjectProgram;
  },
): TransactionResult {
  const before = cloneProgram(history.current);
  const after = cloneProgram(input.after);
  if (semanticKey(before) === semanticKey(after)) {
    return { history, applied: false };
  }
  const transaction: CanonicalTransaction = {
    label: input.label,
    before,
    after,
  };
  const limit = normalizeLimit(history.limit);
  return {
    applied: true,
    history: toPublicHistory({
      past: [...history.past, transaction].slice(-limit),
      current: after,
      future: [],
      limit,
    }),
  };
}

export function undoCanonicalTransaction(history: EditorHistory): RestoreResult {
  const transaction = history.past.at(-1);
  if (transaction === undefined) {
    return { history, program: history.current };
  }
  const nextCurrent = cloneProgram(transaction.before);
  return {
    program: nextCurrent,
    history: toPublicHistory({
      past: history.past.slice(0, -1),
      current: nextCurrent,
      future: [transaction, ...history.future],
      limit: normalizeLimit(history.limit),
    }),
  };
}

export function redoCanonicalTransaction(history: EditorHistory): RestoreResult {
  const transaction = history.future[0];
  if (transaction === undefined) {
    return { history, program: history.current };
  }
  const nextCurrent = cloneProgram(transaction.after);
  return {
    program: nextCurrent,
    history: toPublicHistory({
      past: [...history.past, transaction],
      current: nextCurrent,
      future: history.future.slice(1),
      limit: normalizeLimit(history.limit),
    }),
  };
}
