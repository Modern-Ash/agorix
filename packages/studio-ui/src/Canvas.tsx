import { useState, type DragEvent } from "react";
import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import {
  keyboardIntent,
  resolveDrop,
  type AgentVerb,
  type DropTarget,
  type Intent,
} from "@agorix/interaction-core";
import type { GhostChange } from "@agorix/studio-protocol";
import { dropPointFor, toRows } from "./blockView.js";
import { chordFromEvent, dragPayload, parseDragPayload } from "./drag.js";

const DRAG_TYPE = "application/x-agorix-drag";

function readSource(event: DragEvent) {
  return parseDragPayload(event.dataTransfer.getData(DRAG_TYPE));
}

function Slot({
  row,
  onIntent,
}: {
  readonly row: Extract<ReturnType<typeof toRows>[number], { kind: "slot" }>;
  readonly onIntent: (intent: Intent) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      aria-hidden="true"
      className={`slot depth-${Math.min(row.depth, 4)}${over ? " drag-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const source = readSource(event);
        const to = source === undefined ? undefined : dropPointFor(source, row.slot);
        if (source === undefined || to === undefined) return;
        const target: DropTarget = { kind: "slot", to };
        const intent = resolveDrop(source, target);
        if (intent !== undefined) onIntent(intent);
      }}
    />
  );
}

export function AgentZone({
  verb,
  label,
  onIntent,
}: {
  readonly verb: AgentVerb;
  readonly label: string;
  readonly onIntent: (intent: Intent) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={`zone${over ? " drag-over" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const source = readSource(event);
        const intent =
          source === undefined ? undefined : resolveDrop(source, { kind: "agent", verb });
        if (intent !== undefined) onIntent(intent);
      }}
    >
      {label}
    </div>
  );
}

function ghostKind(ghosts: readonly GhostChange[] | undefined, blockId: string) {
  return ghosts?.find((ghost) => ghost.blockId === blockId)?.kind;
}

/** Visible, anchored explanation of a suggested change on a block. */
export interface BlockHints {
  readonly hints: Readonly<Record<string, string>>;
  readonly skipped: readonly string[];
}

export interface SyncView {
  readonly selectedBlockId?: string;
  readonly executingBlockId?: string;
  readonly failedBlockId?: string;
}

export function Canvas({
  workspace,
  onIntent,
  ghosts,
  sync,
  hints,
}: {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly onIntent: (intent: Intent) => void;
  readonly ghosts?: readonly GhostChange[] | undefined;
  readonly sync?: SyncView | undefined;
  readonly hints?: BlockHints | undefined;
}) {
  const addedGhosts = (ghosts ?? []).filter((ghost) => ghost.kind === "added");
  return (
    <section className="canvas" aria-label="Program">
      {toRows(workspace).map((row, key) => {
        if (row.kind === "script") {
          return (
            <div key={key} className="script-title">
              Script {row.scriptIndex + 1}: when you press Run
            </div>
          );
        }
        if (row.kind === "slot") {
          return <Slot key={key} row={row} onIntent={onIntent} />;
        }
        const { block } = row;
        const press = (chord: "Alt+ArrowUp" | "Alt+ArrowDown" | "Delete") => {
          const intent = keyboardIntent(chord, {
            location: block.location,
            siblingCount: block.siblingCount,
          });
          if (intent !== undefined) onIntent(intent);
        };
        const hint = hints?.hints[block.id];
        const isSkipped = hints?.skipped.includes(block.id) === true;
        const isSel = sync?.selectedBlockId === block.id;
        const isExec = sync?.executingBlockId === block.id;
        const isFail = sync?.failedBlockId === block.id;
        const fields = Object.entries(block.fields)
          .map(([name, value]) => `${name}: ${String(value)}`)
          .join(", ");
        return (
          <div
            key={key}
            role="group"
            tabIndex={0}
            draggable
            aria-label={block.label}
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Delete"
            className={`block depth-${Math.min(row.depth, 4)}${
              ghostKind(ghosts, block.id) === "removed"
                ? " ghost-removed"
                : ghostKind(ghosts, block.id) === undefined
                  ? ""
                  : " ghost-changed"
            }${isSel ? " sel" : ""}${isExec ? " exec" : ""}${isFail ? " fail" : ""}${isSkipped ? " ghost-skipped" : ""}`}
            aria-current={isSel ? "true" : undefined}
            aria-description={
              isFail
                ? "This block failed when the program ran"
                : hint !== undefined
                  ? `Suggestion: ${hint}${isSkipped ? " (skipped)" : ""}`
                  : ghostKind(ghosts, block.id) === "removed"
                    ? "Suggestion would remove this block"
                    : ghostKind(ghosts, block.id) === undefined
                      ? undefined
                      : "Suggestion would change this block"
            }
            onDragStart={(event) => {
              event.dataTransfer.setData(
                DRAG_TYPE,
                dragPayload({ kind: "block", nodeId: block.id, location: block.location }),
              );
              event.dataTransfer.effectAllowed = "move";
            }}
            onKeyDown={(event) => {
              const chord = chordFromEvent(event);
              if (chord !== undefined) {
                event.preventDefault();
                press(chord);
              }
            }}
          >
            <span
              className="label"
              data-testid="block-label"
              onClick={() => onIntent({ type: "revealNode", nodeId: block.id })}
            >
              {block.label}
              {fields === "" ? "" : ` (${fields})`}
            </span>
            {hint === undefined ? null : (
              <span className="hint-badge">
                {isSkipped ? "Skipped: " : "Suggested: "}
                {hint}
              </span>
            )}
            {isFail ? <span className="sync-badge fail-badge">Failed here</span> : null}
            {isExec ? <span className="sync-badge">Running</span> : null}
            <button
              type="button"
              aria-label={`Move ${block.label} up`}
              onClick={() => press("Alt+ArrowUp")}
            >
              Up
            </button>
            <button
              type="button"
              aria-label={`Move ${block.label} down`}
              onClick={() => press("Alt+ArrowDown")}
            >
              Down
            </button>
            <button
              type="button"
              aria-label={`Delete ${block.label}`}
              onClick={() => press("Delete")}
            >
              Delete
            </button>
          </div>
        );
      })}
      {addedGhosts.map((ghost, index) => (
        <div
          key={`ghost-${index}`}
          className="block ghost-added depth-0"
          aria-label={`Suggested: ${ghost.afterText ?? "new block"}`}
        >
          <span className="ghost-badge">Suggestion</span>
          <span className="label">{ghost.afterText ?? "new block"}</span>
        </div>
      ))}
    </section>
  );
}
