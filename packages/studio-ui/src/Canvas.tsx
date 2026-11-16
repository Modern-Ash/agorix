import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import { getBlockDefinition, type BlockType } from "@agorix/block-editor";
import {
  STUDIO_COMPARISON_BLOCK_TYPES,
  STUDIO_CONDITION_BLOCK_TYPES,
  keyboardIntent,
  resolveDrop,
  type AgentVerb,
  type DropTarget,
  type Intent,
} from "@agorix/interaction-core";
import type { AmbientHintView, AssetView, GhostChange } from "@agorix/studio-protocol";
import { dropPointFor, locationKey, toRows } from "./blockView.js";
import { chordFromEvent, dragPayload, parseDragPayload } from "./drag.js";
import { copyFor, type StudioUiCopy } from "./i18n.js";
import { visualBlock, visualLabel } from "./visualBlocks.js";
import { imageForId } from "./visualArt.js";

const DRAG_TYPE = "application/x-agorix-drag";

function readSource(event: DragEvent) {
  return parseDragPayload(event.dataTransfer.getData(DRAG_TYPE));
}

function Slot({
  row,
  onIntent,
  copy,
  empty = false,
}: {
  readonly row: Extract<ReturnType<typeof toRows>[number], { kind: "slot" }>;
  readonly onIntent: (intent: Intent) => void;
  readonly copy: StudioUiCopy;
  readonly empty?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      aria-hidden="true"
      className={`slot depth-${Math.min(row.depth, 4)}${empty ? " is-empty" : ""}${over ? " drag-over" : ""}`}
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
    >
      <span>{copy.dropHere}</span>
    </div>
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
  copy = copyFor("en"),
  workspace,
  onIntent,
  ghosts,
  sync,
  hints,
  ambientHint,
  onAnnounce,
  focusRequest,
  selectedExpression,
  visibleScriptIds,
  assets = [],
}: {
  readonly copy?: StudioUiCopy;
  readonly workspace: BlockWorkspaceSnapshot;
  readonly onIntent: (intent: Intent) => void;
  readonly ghosts?: readonly GhostChange[] | undefined;
  readonly sync?: SyncView | undefined;
  readonly hints?: BlockHints | undefined;
  readonly ambientHint?: AmbientHintView | undefined;
  /** Receives plain-language announcements for a polite live region. */
  readonly onAnnounce?: ((text: string) => void) | undefined;
  readonly focusRequest?: FocusRequest | undefined;
  readonly selectedExpression?: BlockType | undefined;
  readonly visibleScriptIds?: readonly string[] | undefined;
  readonly assets?: readonly AssetView[];
}) {
  const addedGhosts = (ghosts ?? []).filter((ghost) => ghost.kind === "added");
  const rootRef = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<string | undefined>(undefined);
  const lastNonce = useRef<number | undefined>(undefined);
  const [activeKey, setActiveKey] = useState<string | undefined>();
  const rows = toRows(workspace).filter((row) => {
    if (visibleScriptIds === undefined) return true;
    const scriptIndex =
      row.kind === "script"
        ? row.scriptIndex
        : row.kind === "slot"
          ? row.slot.container.scriptIndex
          : row.block.location.container.scriptIndex;
    const script = workspace.scripts[scriptIndex];
    return script !== undefined && visibleScriptIds.includes(script.programId ?? script.id);
  });
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
      ref={rootRef}
      className="canvas"
      aria-label={copy.canvasProgram}
      aria-describedby="canvas-keyboard-help"
      tabIndex={-1}
    >
      <p id="canvas-keyboard-help" className="sr-only">
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
              {copy.canvasScript} {row.scriptIndex + 1}: {copy.canvasWhenRun}
            </div>
          );
        }
        if (row.kind === "slot") {
          return (
            <Slot
              key={key}
              row={row}
              onIntent={onIntent}
              copy={copy}
              empty={
                row.slot.container.kind === "script" &&
                workspace.scripts[row.slot.container.scriptIndex]?.statements.length === 0
              }
            />
          );
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
        const visual = visualBlock(block.type);
        const fieldEntries = Object.entries(block.fields);
        const fields = fieldEntries
          .filter(
            ([name, value]) =>
              name !== "variableId" &&
              !["costumeId", "backdropId", "soundId"].includes(name) &&
              typeof value !== "number" &&
              !(typeof value === "string" && ["text", "message", "key"].includes(name)),
          )
          .map(([name, value]) => `${fieldLabel(name, copy)}: ${String(value)}`)
          .join(", ");
        return (
          <div
            key={key}
            role="group"
            tabIndex={isTabbable ? 0 : -1}
            data-pos={pos}
            data-tone={visual.tone}
            data-shape={visual.shape}
            draggable
            title={copy.dragBlock}
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
                ? copy.canvasFailedDescription
                : hint !== undefined
                  ? `${ambient === undefined ? copy.canvasSuggestion : copy.canvasCompanionHint}: ${hint}${isSkipped ? ` (${copy.canvasSkipped})` : ""}`
                  : ghostKind(ghosts, block.id) === "removed"
                    ? copy.canvasSuggestionRemove
                    : ghostKind(ghosts, block.id) === undefined
                      ? undefined
                      : copy.canvasSuggestionChange
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
              title={`${label}${fields === "" ? "" : ` (${fields})`}`}
              onClick={() => onIntent({ type: "revealNode", nodeId: block.id })}
            >
              {visualLabel(label)}
              {fields === "" ? "" : ` (${fields})`}
            </span>
            {(["costumeId", "backdropId", "soundId"] as const).map((field) => {
              const current = block.fields[field];
              if (typeof current !== "string") return null;
              const kind =
                field === "costumeId" ? "costume" : field === "backdropId" ? "backdrop" : "sound";
              const title =
                field === "costumeId"
                  ? copy.sceneCostumes
                  : field === "backdropId"
                    ? copy.sceneBackdrops
                    : copy.sceneSounds;
              const image = kind === "sound" ? undefined : imageForId(current, assets);
              return (
                <label key={field} className="block-field block-asset-field">
                  <span>{title}</span>
                  {image === undefined ? null : <img src={image} alt="" />}
                  <select
                    aria-label={`${label}: ${title}`}
                    value={current}
                    onChange={(event) =>
                      onIntent({
                        type: "setTextField",
                        location: block.location,
                        field,
                        value: event.currentTarget.value,
                      })
                    }
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {assets.some((asset) => asset.id === current && asset.kind === kind) ? null : (
                      <option value={current}>{current}</option>
                    )}
                    {assets
                      .filter((asset) => asset.kind === kind)
                      .map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                  </select>
                </label>
              );
            })}
            {typeof block.fields.variableId === "string" ? (
              <label className="block-field">
                <span>{copy.variables}</span>
                <select
                  aria-label={`${label}: ${copy.variables}`}
                  value={block.fields.variableId}
                  onChange={(event) =>
                    onIntent({
                      type: "setTextField",
                      location: block.location,
                      field: "variableId",
                      value: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {workspace.variables?.some(
                    (variable) => variable.id === block.fields.variableId,
                  ) ? null : (
                    <option value={block.fields.variableId}>{block.fields.variableId}</option>
                  )}
                  {(workspace.variables ?? []).map((variable) => (
                    <option key={variable.id} value={variable.id}>
                      {variable.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {(["value", "delta"] as const).map((input) => {
              const operand = block[input];
              if (operand?.type !== "literal_number" || typeof operand.fields?.value !== "number")
                return null;
              const value = operand.fields.value;
              return (
                <label key={input} className="block-field">
                  <span>{input === "value" ? copy.variableValue : copy.variableDelta}</span>
                  <input
                    key={`${pos}:${input}:${value}`}
                    type="number"
                    tabIndex={isTabbable ? 0 : -1}
                    aria-label={`${label}: ${input === "value" ? copy.variableValue : copy.variableDelta}`}
                    defaultValue={value}
                    draggable={false}
                    onDragStart={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    onBlur={(event) => {
                      const raw = event.currentTarget.value.trim();
                      const next = Number(raw);
                      if (raw !== "" && Number.isFinite(next) && next !== value)
                        onIntent({
                          type: "setExpressionNumber",
                          location: block.location,
                          input,
                          value: next,
                        });
                      event.currentTarget.value = String(value);
                    }}
                  />
                </label>
              );
            })}
            {block.type === "control_if" ? (
              <button
                type="button"
                className="expression-socket"
                data-tone={
                  block.condition === undefined ? "sensing" : visualBlock(block.condition.type).tone
                }
                aria-label={`${copy.condition}: ${block.condition === undefined ? "" : (getBlockDefinition(block.condition.type)?.label ?? block.condition.type)}`}
                title={copy.condition}
                onClick={() => {
                  if (selectedExpression !== undefined) {
                    onIntent({
                      type: "replaceCondition",
                      location: block.location,
                      blockType: selectedExpression,
                    });
                  }
                }}
                onDragOver={(event) => {
                  // Drag payloads are not readable during dragover in every browser.
                  // Validate the actual block on drop before creating an intent.
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const source = readSource(event);
                  if (
                    source?.kind === "palette" &&
                    (STUDIO_CONDITION_BLOCK_TYPES as readonly string[]).includes(source.blockType)
                  ) {
                    onIntent({
                      type: "replaceCondition",
                      location: block.location,
                      blockType: source.blockType,
                    });
                  }
                }}
              >
                {block.condition === undefined
                  ? copy.condition
                  : (getBlockDefinition(block.condition.type)?.label ?? block.condition.type)}
              </button>
            ) : null}
            {block.type === "control_if" &&
            block.condition !== undefined &&
            (STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(block.condition.type) ? (
              <span className="comparison-fields">
                {(["left", "right"] as const).map((side) => {
                  const operand = block.condition?.inputs?.[side];
                  if (
                    operand?.type !== "literal_number" ||
                    typeof operand.fields?.value !== "number"
                  )
                    return null;
                  const value = operand.fields.value;
                  return (
                    <label key={side} className="block-field">
                      <span>{side === "left" ? copy.conditionLeft : copy.conditionRight}</span>
                      <input
                        key={`${pos}:${side}:${value}`}
                        type="number"
                        tabIndex={isTabbable ? 0 : -1}
                        aria-label={`${copy.condition}: ${side === "left" ? copy.conditionLeft : copy.conditionRight}`}
                        defaultValue={value}
                        draggable={false}
                        onDragStart={(event) => event.stopPropagation()}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        onBlur={(event) => {
                          const raw = event.currentTarget.value.trim();
                          const next = Number(raw);
                          if (raw !== "" && Number.isFinite(next) && next !== value) {
                            onIntent({
                              type: "setConditionNumber",
                              location: block.location,
                              side,
                              value: next,
                            });
                          }
                          event.currentTarget.value = String(value);
                        }}
                      />
                    </label>
                  );
                })}
              </span>
            ) : null}
            {fieldEntries
              .filter(
                ([name, value]) =>
                  typeof value === "number" ||
                  (typeof value === "string" && ["text", "message", "key"].includes(name)),
              )
              .map(([name, value]) => (
                <label key={name} className="block-field">
                  <span>{fieldLabel(name, copy)}</span>
                  <input
                    key={`${pos}:${name}:${value}`}
                    type={typeof value === "number" ? "number" : "text"}
                    maxLength={typeof value === "string" ? 160 : undefined}
                    tabIndex={isTabbable ? 0 : -1}
                    aria-label={`${label}: ${fieldLabel(name, copy)}`}
                    defaultValue={value as string | number}
                    draggable={false}
                    onDragStart={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter") event.currentTarget.blur();
                    }}
                    onBlur={(event) => {
                      const raw = event.currentTarget.value.trim();
                      if (typeof value === "string") {
                        if (raw !== value) {
                          onIntent({
                            type: "setTextField",
                            location: block.location,
                            field: name,
                            value: raw,
                          });
                          event.currentTarget.value = value;
                        }
                        return;
                      }
                      const number = Number(raw);
                      if (raw === "" || !Number.isFinite(number)) {
                        event.currentTarget.value = String(value);
                        return;
                      }
                      if (number !== value) {
                        onIntent({
                          type: "setNumericField",
                          location: block.location,
                          field: name,
                          value: number,
                        });
                        // The host owns accepted state; show the new value only after its snapshot arrives.
                        event.currentTarget.value = String(value);
                      }
                    }}
                  />
                </label>
              ))}
            {hint === undefined ? null : (
              <span className={ambient === undefined ? "hint-badge" : "hint-badge ambient"}>
                {ambient === undefined
                  ? `${isSkipped ? copy.canvasSkippedPrefix : copy.canvasSuggestedPrefix} `
                  : ""}
                {hint}
              </span>
            )}
            {isFail ? <span className="sync-badge fail-badge">{copy.canvasFailedHere}</span> : null}
            {isExec ? <span className="sync-badge">{copy.canvasRunning}</span> : null}
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              className="block-ori"
              aria-label={`${copy.askOriAboutBlock}: ${label}`}
              title={copy.askOriAboutBlock}
              onClick={() =>
                onIntent({
                  type: "askAgent",
                  verb: "explain",
                  about: { kind: "node", id: block.id },
                })
              }
            >
              Ori
            </button>
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              aria-label={`${copy.canvasMoveUp}: ${block.label}`}
              title={copy.canvasMoveUp}
              onClick={() => press("Alt+ArrowUp")}
            >
              ↑
            </button>
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              aria-label={`${copy.canvasMoveDown}: ${block.label}`}
              title={copy.canvasMoveDown}
              onClick={() => press("Alt+ArrowDown")}
            >
              ↓
            </button>
            <button
              type="button"
              tabIndex={isTabbable ? 0 : -1}
              aria-label={`${copy.canvasDelete}: ${block.label}`}
              title={copy.canvasDelete}
              onClick={() => press("Delete")}
            >
              ×
            </button>
          </div>
        );
      })}
      {addedGhosts.map((ghost, index) => (
        <div
          key={`ghost-${index}`}
          className="block ghost-added depth-0"
          aria-label={`${copy.canvasSuggestedPrefix} ${ghost.afterText ?? copy.canvasNewBlock}`}
        >
          <span className="ghost-badge">{copy.canvasSuggestion}</span>
          <span className="label">{ghost.afterText ?? copy.canvasNewBlock}</span>
        </div>
      ))}
    </section>
  );
}
