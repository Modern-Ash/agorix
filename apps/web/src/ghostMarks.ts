import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { ProposalReview } from "@agorix/proposals";
import {
  blockNodeIdForPath,
  canContainStatements,
  childContainerPathFor,
  statementListAtPath,
  type StatementPath,
} from "./editorModel.js";

export type GhostMarkKind = "changed" | "removed";

export interface GhostMarks {
  readonly byPath: ReadonlyMap<string, GhostMarkKind>;
  readonly added: readonly string[];
}

const EMPTY: GhostMarks = { byPath: new Map(), added: [] };

function visit(
  workspace: BlockWorkspaceSnapshot,
  container: StatementPath,
  visitor: (path: StatementPath) => void,
  depth = 0,
): void {
  if (depth > 16) return;
  const list = statementListAtPath(workspace, container);
  list.forEach((block, index) => {
    const path = [...container, index];
    visitor(path);
    if (canContainStatements(block)) {
      visit(workspace, childContainerPathFor(path), visitor, depth + 1);
    }
  });
}

/** Marks existing blocks a proposal would change or remove and lists text of blocks it would add. */
export function ghostMarksFor(
  review: ProposalReview | undefined,
  workspace: BlockWorkspaceSnapshot,
): GhostMarks {
  if (review === undefined) return EMPTY;
  const kindByNode = new Map<string, GhostMarkKind>();
  const added: string[] = [];
  for (const entry of review.diff) {
    if (entry.kind === "added") {
      if (entry.afterText !== undefined) added.push(entry.afterText.slice(0, 200));
    } else if (entry.kind === "removed") {
      kindByNode.set(entry.nodeId, "removed");
    } else if (entry.kind === "changed") {
      kindByNode.set(entry.nodeId, "changed");
    }
  }
  const byPath = new Map<string, GhostMarkKind>();
  try {
    visit(workspace, [], (path) => {
      const kind = kindByNode.get(blockNodeIdForPath(workspace, path));
      if (kind !== undefined) byPath.set(path.join("."), kind);
    });
  } catch {
    return { byPath: new Map(), added };
  }
  return { byPath, added };
}
