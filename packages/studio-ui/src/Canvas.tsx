import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import {
  keyboardIntent,
  resolveDrop,
  type AgentVerb,
  type DropTarget,
  type Intent,
} from "@agorix/interaction-core";
import type { AmbientHintView, GhostChange } from "@agorix/studio-protocol";
import { dropPointFor, locationKey, toRows } from "./blockView.js";
import { chordFromEvent, dragPayload, parseDragPayload } from "./drag.js";
import { copyFor, type StudioUiCopy } from "./i18n.js";

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

function fieldLabel(name: string, copy: StudioUiCopy): string {
  return name === "steps" || name === "degrees" || name === "count" ? copy.fieldLabels[name] : name;
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

/** Ask the canvas to focus the block at `pos` (a `locationKey`) once it exists. */
export interface FocusRequest {
  readonly pos: string;
  readonly nonce: number;
}

export function Canvas({
  workspace,
  onIntent,
  ghosts,
  sync,
  hints,
  ambientHint,
  onAnnounce,
  focusRequest,
  copy = copyFor("en"),
}: {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly onIntent: (intent: Intent) => void;
  readonly ghosts?: readonly GhostChange[] | undefined;
  readonly sync?: SyncView | undefined;
  readonly hints?: BlockHints | undefined;
  readonly ambientHint?: AmbientHintView | undefined;
  /** Receives plain-language announcements for a polite live region. */
  readonly onAnnounce?: ((text: string) => void) | undefined;
  readonly focusRequest?: FocusRequest | undefined;
  readonly copy?: StudioUiCopy;
}) {
  const addedGhosts = (ghosts ?? []).filter((ghost) => ghost.kind === "added");
  const rootRef = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<string | undefined>(undefined);
  const lastNonce = useRef<number | undefined>(undefined);
  const [activeKey, setActiveKey] = useState<string | undefined>();
  const rows = toRows(workspace);
  const blockKeys = rows.flatMap((row) =>
    row.kind === "block" ? [locationKey(row.block.location)] : [],
  );
  const tabbable =
    activeKey !== undefined && blockKeys.includes(activeKey) ? activeKey : blockKeys[0];

  function blockElements(): HTMLElement[] {
    return Array.from(rootRef.current?.querySelectorAll<HTMLElement>("[data-pos]") ?? []);
  }

  function focusBlock(element: HTMLElement | undefined): void {
    if (element === undefined) return;
    element.focus();
    setActiveKey(element.dataset["pos"]);
  }

  useEffect(() => {
    if (focusRequest !== undefined && focusRequest.nonce !== lastNonce.current) {
      lastNonce.current = focusRequest.nonce;
      pendingFocus.current = focusRequest.pos;
    }
    const wanted = pendingFocus.current;
    if (wanted === undefined) return;
    if (wanted === "canvas") {
      pendingFocus.current = undefined;
      rootRef.current?.focus();
      return;
    }
    const target = blockElements().find((element) => element.dataset["pos"] === wanted);
    if (target !== undefined) {
      pendingFocus.current = undefined;
      focusBlock(target);
    }
  }, [workspace, focusRequest]);

  function moveFocus(from: HTMLElement, key: string): void {
    const all = blockElements();
    const index = all.indexOf(from);
    if (index < 0) return;
    const next =
      key === "ArrowDown"
        ? all[index + 1]
        : key === "ArrowUp"
          ? all[index - 1]
          : key === "Home"
            ? all[0]
            : all[all.length - 1];
    focusBlock(next);
  }

  return (
    <section
      className="canvas"
      aria-label={copy.canvasLabel}
      aria-describedby="canvas-keyboard-help"
      tabIndex={-1}
      ref={rootRef}
    >
      <p id="canvas-keyboard-help" className="canvas-help">
        {copy.keyboardHelp}
      </p>
      {ambientHint !== undefined && ambientHint.blockId === undefined ? (
        <div className="ambient-hint" role="note">
          {ambientHint.label}
        </div>
      ) : null}
      {rows.map((row, key) => {
        if (row.kind === "script") {
          return (
            <div key={key} className="script-title">
              {copy.scriptTitle(row.scriptIndex + 1)}
            </div>
          );
        }
        if (row.kind === "slot") {
          return <Slot key={key} row={row} onIntent={onIntent} />;
        }
        const { block } = row;
        const blockLabels: Readonly<Record<string, string>> = copy.blockLabels;
        const label = blockLabels[block.type] ?? block.label;
        const pos = locationKey(block.location);
        const isTabbable = pos === tabbable;
        const { index, container } = block.location;
        const press = (chord: "Alt+ArrowUp" | "Alt+ArrowDown" | "Delete") => {
          const intent = keyboardIntent(chord, {
            location: block.location,
            siblingCount: block.siblingCount,
          });
          if (intent === undefined) {
            if (chord === "Alt+ArrowUp") onAnnounce?.(copy.alreadyFirst);
            if (chord === "Alt+ArrowDown") onAnnounce?.(copy.alreadyLast);
            return;
          }
          if (chord === "Delete") {
            pendingFocus.current =
              block.siblingCount <= 1
                ? "canvas"
                : locationKey({
                    container,
                    index: index < block.siblingCount - 1 ? index : index - 1,
                  });
            onAnnounce?.(copy.deletedAnnouncement(label));
          } else {
            const to = chord === "Alt+ArrowUp" ? index - 1 : index + 1;
            pendingFocus.current = locationKey({ container, index: to });
            onAnnounce?.(copy.movedAnnouncement(label, to + 1, block.siblingCount));
          }
          onIntent(intent);
        };
        const ambient = ambientHint?.blockId === block.id ? ambientHint.label : undefined;
        const hint = hints?.hints[block.id] ?? ambient;
        const isSkipped = hints?.skipped.includes(block.id) === true;
        const isSel = sync?.selectedBlockId === block.id;
        const isExec = sync?.executingBlockId === block.id;
        const isFail = sync?.failedBlockId === block.id;
        const fields = Object.entries(block.fields)
          .map(([name, value]) => `${fieldLabel(name, copy)}: ${String(value)}`)
          .join(", ");
        return (
          <div
            key={key}
            role="group"
            tabIndex={isTabbable ? 0 : -1}
            data-pos={pos}
            draggable
            aria-label={copy.blockPosition(label, index + 1, block.siblingCount, row.depth + 1)}
            onFocus={() => setActiveKey(pos)}
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
                ? copy.blockFailedDescription
                : hint !== undefined
                  ? `${ambient === undefined ? copy.suggestion : copy.companionHint}: ${hint}${isSkipped ? ` (${copy.skipped})` : ""}`
                  : ghostKind(ghosts, block.id) === "removed"
                    ? copy.suggestionRemoveDescription
                    : ghostKind(ghosts, block.id) === undefined
                      ? undefined
                      : copy.suggestionChangeDescription
            }
            onDragStart={(event) => {
              event.dataTransfer.setData(
                DRAG_TYPE,
                dragPayload({ kind: "block", nodeId: block.id, location: block.location }),
              );
              event.dataTransfer.effectAllowed = "move";
            }}
            onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
              const chord = chordFromEvent(event);
              if (chord !== undefined) {
                event.preventDefault();
                press(chord);
                return;
              }
              // Navigation and activation apply to the block itself, never to a control inside it.
              if (event.target !== event.currentTarget || event.altKey) return;
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                moveFocus(event.currentTarget, event.key);
              } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onIntent({ type: "revealNode", nodeId: block.id });
              }
            }}
          >
            <span
              className="label"
              data-testid="block-label"
              onClick={() => onIntent({ type: "revealNode", nodeId: block.id })}
            >
              {label}
              {fields === "" ? "" : ` (${fields})`}
            </span>
            {hint === undefined ? null : (
              <span className={ambient === undefined ? "hint-badge" : "hint-badge ambient"}>
                {ambient === undefined
                  ? `${isSkipped ? copy.skippedSuggestion : copy.suggested}: `
                  : ""}
                {hint}
              </span>
            )}
            {isFail ? <span className="sync-badge fail-badge">{copy.failedHere}</span> : null}
            {isExec ? <span className="sync-badge">{copy.running}</span> : null}
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              aria-label={copy.moveUp(label)}
              onClick={() => press("Alt+ArrowUp")}
            >
              {copy.up}
            </button>
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              aria-label={copy.moveDown(label)}
              onClick={() => press("Alt+ArrowDown")}
            >
              {copy.down}
            </button>
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              aria-label={copy.deleteBlock(label)}
              onClick={() => press("Delete")}
            >
              {copy.delete}
            </button>
          </div>
        );
      })}
      {addedGhosts.map((ghost, index) => (
        <div
          key={`ghost-${index}`}
          className="block ghost-added depth-0"
          aria-label={`${copy.suggested}: ${ghost.afterText ?? copy.newBlock}`}
        >
          <span className="ghost-badge">{copy.suggestion}</span>
          <span className="label">{ghost.afterText ?? copy.newBlock}</span>
        </div>
      ))}
    </section>
  );
}
