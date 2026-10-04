import { useState, type DragEvent } from "react";
import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import {
  keyboardIntent,
  resolveDrop,
  type AgentVerb,
  type DropTarget,
  type Intent,
} from "@agorix/interaction-core";
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

export function Canvas({
  workspace,
  onIntent,
}: {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly onIntent: (intent: Intent) => void;
}) {
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
            className={`block depth-${Math.min(row.depth, 4)}`}
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
            <span className="label">
              {block.label}
              {fields === "" ? "" : ` (${fields})`}
            </span>
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
    </section>
  );
}
