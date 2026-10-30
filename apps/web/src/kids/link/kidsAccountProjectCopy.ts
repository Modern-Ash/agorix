import { semanticProjectHash, type ProjectStore } from "@agorix/persistence";
import { verifyKidsFreeGoal } from "@agorix/curriculum";
import { isClientError, type ProjectApiClient } from "../../accounts/clients.js";
import { parseKidsGoalSpec } from "../kidsProjects.js";

const KEY = "agorix.kids.account-project-copies.v1";
const FREE_PROJECT_ID = /^free-[1-9][0-9]*$/;
const SEMANTIC_HASH = /^fnv1a32:[a-f0-9]{8}$/;

interface CopyRecord {
  readonly accountAlias: string;
  readonly localProjectId: string;
  readonly remoteProjectId: string;
  readonly remoteRevision?: number;
  readonly localSemanticHash?: string;
}

export interface CopyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function records(storage: CopyStorage): CopyRecord[] {
  try {
    const raw: unknown = JSON.parse(storage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (item): item is CopyRecord =>
        !!item &&
        typeof item === "object" &&
        typeof item.accountAlias === "string" &&
        typeof item.localProjectId === "string" &&
        FREE_PROJECT_ID.test(item.localProjectId) &&
        typeof item.remoteProjectId === "string" &&
        item.remoteProjectId.length > 0 &&
        item.remoteProjectId.length <= 128 &&
        (item.remoteRevision === undefined ||
          (Number.isSafeInteger(item.remoteRevision) && item.remoteRevision >= 1)) &&
        (item.localSemanticHash === undefined || SEMANTIC_HASH.test(item.localSemanticHash)),
    );
  } catch {
    return [];
  }
}

export function kidsAccountCopy(
  storage: CopyStorage,
  accountAlias: string,
  localProjectId: string,
): CopyRecord | null {
  return (
    records(storage).find(
      (item) => item.accountAlias === accountAlias && item.localProjectId === localProjectId,
    ) ?? null
  );
}

/** Explicit adult action: creates a separate account copy without changing Kids' local project. */
export async function copyKidsProjectToAccount({
  accountAlias,
  localProjectId,
  store,
  projects,
  storage,
}: {
  readonly accountAlias: string;
  readonly localProjectId: string;
  readonly store: Pick<ProjectStore, "load">;
  readonly projects: Pick<ProjectApiClient, "create">;
  readonly storage: CopyStorage;
}): Promise<
  | { readonly status: "copied" | "already-copied"; readonly remoteProjectId: string }
  | { readonly status: "copied-untracked"; readonly remoteProjectId: string }
> {
  if (!accountAlias || accountAlias.length > 64 || !FREE_PROJECT_ID.test(localProjectId)) {
    throw new Error("Invalid Kids account copy request");
  }
  const existing = kidsAccountCopy(storage, accountAlias, localProjectId);
  if (existing) return { status: "already-copied", remoteProjectId: existing.remoteProjectId };
  const stored = store.load(localProjectId);
  const created = await projects.create(`Kids ${localProjectId}`, stored);
  if (created.semanticHash !== semanticProjectHash(stored)) {
    return { status: "copied-untracked", remoteProjectId: created.projectId };
  }
  try {
    storage.setItem(
      KEY,
      JSON.stringify([
        ...records(storage),
        {
          accountAlias,
          localProjectId,
          remoteProjectId: created.projectId,
          remoteRevision: created.revision,
          localSemanticHash: created.semanticHash,
        },
      ]),
    );
    return { status: "copied", remoteProjectId: created.projectId };
  } catch {
    // The server copy exists; tell the adult so they do not assume it can be retried safely.
    return { status: "copied-untracked", remoteProjectId: created.projectId };
  }
}

/** Explicit local-to-account update. A stale server revision never overwrites the account project. */
export async function updateKidsAccountCopy({
  accountAlias,
  localProjectId,
  store,
  projects,
  storage,
}: {
  readonly accountAlias: string;
  readonly localProjectId: string;
  readonly store: Pick<ProjectStore, "load">;
  readonly projects: Pick<ProjectApiClient, "update">;
  readonly storage: CopyStorage;
}): Promise<"updated" | "updated-untracked" | "missing"> {
  const existing = kidsAccountCopy(storage, accountAlias, localProjectId);
  if (!existing || existing.remoteRevision === undefined) return "missing";
  const stored = store.load(localProjectId);
  const updated = await projects.update(existing.remoteProjectId, existing.remoteRevision, stored);
  if (updated.semanticHash !== semanticProjectHash(stored)) return "updated-untracked";
  try {
    storage.setItem(
      KEY,
      JSON.stringify(
        records(storage).map((item) =>
          item.accountAlias === accountAlias && item.localProjectId === localProjectId
            ? {
                ...item,
                remoteRevision: updated.revision,
                localSemanticHash: updated.semanticHash,
              }
            : item,
        ),
      ),
    );
    return "updated";
  } catch {
    return "updated-untracked";
  }
}

/** Pull a newer account version only when the device still matches the last explicit push. */
export async function pullKidsAccountCopy({
  accountAlias,
  localProjectId,
  store,
  projects,
  storage,
}: {
  readonly accountAlias: string;
  readonly localProjectId: string;
  readonly store: Pick<ProjectStore, "load" | "save">;
  readonly projects: Pick<ProjectApiClient, "get">;
  readonly storage: CopyStorage;
}): Promise<
  "pulled" | "pulled-untracked" | "unchanged" | "local-conflict" | "invalid-remote" | "missing"
> {
  const existing = kidsAccountCopy(storage, accountAlias, localProjectId);
  if (!existing || !existing.localSemanticHash || existing.remoteRevision === undefined) {
    return "missing";
  }
  if (semanticProjectHash(store.load(localProjectId)) !== existing.localSemanticHash) {
    return "local-conflict";
  }
  const remote = await projects.get(existing.remoteProjectId);
  if (remote.semanticHash === existing.localSemanticHash) return "unchanged";
  try {
    const spec = remote.storedProject.metadata.missionSpec;
    if (!spec || remote.semanticHash !== semanticProjectHash(remote.storedProject)) {
      return "invalid-remote";
    }
    verifyKidsFreeGoal(parseKidsGoalSpec(spec.goal), spec.successCheck, "es");
  } catch {
    return "invalid-remote";
  }
  // Recheck immediately before the local write: another tab may have edited this project.
  if (semanticProjectHash(store.load(localProjectId)) !== existing.localSemanticHash) {
    return "local-conflict";
  }
  store.save(localProjectId, remote.storedProject.program, remote.storedProject.metadata);
  try {
    storage.setItem(
      KEY,
      JSON.stringify(
        records(storage).map((item) =>
          item.accountAlias === accountAlias && item.localProjectId === localProjectId
            ? {
                ...item,
                remoteRevision: remote.revision,
                localSemanticHash: remote.semanticHash,
              }
            : item,
        ),
      ),
    );
    return "pulled";
  } catch {
    return "pulled-untracked";
  }
}

/** Reconcile a linked Kids project before Ori reads it; never choose a winner for divergent edits. */
export async function reconcileKidsAccountProject({
  accountAlias,
  localProjectId,
  store,
  projects,
  storage,
}: {
  readonly accountAlias: string;
  readonly localProjectId: string;
  readonly store: Pick<ProjectStore, "load" | "save">;
  readonly projects: Pick<ProjectApiClient, "get" | "update">;
  readonly storage: CopyStorage;
}): Promise<
  "unchanged" | "updated" | "pulled" | "conflict" | "invalid-remote" | "missing" | "untracked"
> {
  const linked = kidsAccountCopy(storage, accountAlias, localProjectId);
  if (!linked?.localSemanticHash || linked.remoteRevision === undefined) return "missing";
  const localHash = semanticProjectHash(store.load(localProjectId));
  const remote = await projects.get(linked.remoteProjectId);
  if (remote.semanticHash !== semanticProjectHash(remote.storedProject)) return "invalid-remote";
  const localChanged = localHash !== linked.localSemanticHash;
  const remoteChanged = remote.semanticHash !== linked.localSemanticHash;
  if (localChanged && remoteChanged) return "conflict";
  if (!remoteChanged && remote.revision !== linked.remoteRevision) {
    try {
      storage.setItem(
        KEY,
        JSON.stringify(
          records(storage).map((item) =>
            item.accountAlias === accountAlias && item.localProjectId === localProjectId
              ? { ...item, remoteRevision: remote.revision }
              : item,
          ),
        ),
      );
    } catch {
      return "untracked";
    }
  }
  if (remoteChanged) {
    const result = await pullKidsAccountCopy({
      accountAlias,
      localProjectId,
      store,
      projects,
      storage,
    });
    return result === "local-conflict"
      ? "conflict"
      : result === "pulled-untracked"
        ? "untracked"
        : result;
  }
  if (!localChanged) return "unchanged";
  try {
    const result = await updateKidsAccountCopy({
      accountAlias,
      localProjectId,
      store,
      projects,
      storage,
    });
    return result === "updated-untracked" ? "untracked" : result;
  } catch (error) {
    if (isClientError(error, "revision-conflict")) return "conflict";
    throw error;
  }
}
