import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import { getBlockDefinition, type BlockType } from "@agorix/block-editor";
import {
  STUDIO_COMPARISON_BLOCK_TYPES,
  STUDIO_COMPARISON_OPERAND_SOURCES,
  STUDIO_CONDITION_BLOCK_TYPES,
  STUDIO_LOGICAL_OPERAND_TYPES,
  keyboardIntent,
  resolveDrop,
  type AgentVerb,
  type DropTarget,
  type Intent,
} from "@agorix/interaction-core";
import type { ActorView, AmbientHintView, AssetView, GhostChange } from "@agorix/studio-protocol";
import { dropPointFor, locationKey, nestedMoveIntent, toRows } from "./blockView.js";
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
      className={`slot depth-${Math.min(row.depth, 4)}${empty ? " is-empty" : ""}${row.slot.container.kind === "ifElse" && row.slot.index === 0 ? " is-branch-start" : ""}${over ? " drag-over" : ""}`}
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
  selectedScriptId,
  onSelectScript,
  onDeleteScript,
  assets = [],
  actors = [],
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
  readonly selectedScriptId?: string | undefined;
  readonly onSelectScript?: ((id: string) => void) | undefined;
  readonly onDeleteScript?: ((id: string) => void) | undefined;
  readonly assets?: readonly AssetView[];
  readonly actors?: readonly ActorView[];
}) {
  const addedGhosts = (ghosts ?? []).filter((ghost) => ghost.kind === "added");
  const rootRef = useRef<HTMLElement | null>(null);
  const pendingFocus = useRef<string | undefined>(undefined);
  const lastNonce = useRef<number | undefined>(undefined);
  const [activeKey, setActiveKey] = useState<string | undefined>();
  const [deleteCandidate, setDeleteCandidate] = useState<string | undefined>();
  const rows = toRows(workspace).filter((row) => {
    if (visibleScriptIds === undefined) return true;
    const scriptIndex =
      row.kind === "script"
        ? row.scriptIndex
        : row.kind === "elseBranch"
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
          const script = workspace.scripts[row.scriptIndex];
          const scriptId = script?.programId ?? script?.id;
          const trigger = script?.trigger;
          const eventLabel =
            trigger?.type === "event_on_message"
              ? `${copy.sceneOnMessage}: ${String(trigger.fields?.message ?? "")}`
              : trigger?.type === "event_on_key_pressed"
                ? `${getBlockDefinition(trigger.type)?.label ?? trigger.type}: ${String(trigger.fields?.key ?? "")}`
                : trigger?.type === "event_on_actor_clicked"
                  ? (getBlockDefinition(trigger.type)?.label ?? trigger.type)
                  : copy.canvasWhenRun;
          return (
            <div key={key} className="script-heading">
              <button
                type="button"
                className="script-title"
                aria-pressed={scriptId === selectedScriptId}
                aria-label={`${copy.sceneSelectedScript}: ${copy.canvasScript} ${row.scriptIndex + 1}, ${eventLabel}`}
                onClick={() => {
                  if (scriptId !== undefined) onSelectScript?.(scriptId);
                  setDeleteCandidate(undefined);
                }}
              >
                {copy.canvasScript} {row.scriptIndex + 1}: {eventLabel}
              </button>
              {scriptId === undefined ||
              onDeleteScript === undefined ||
              workspace.scripts.length <= 1 ? null : (
                <button
                  type="button"
                  className="script-delete"
                  aria-label={
                    deleteCandidate === scriptId
                      ? copy.sceneConfirmDeleteScript
                      : copy.sceneDeleteScript
                  }
                  onClick={() => {
                    if (deleteCandidate === scriptId) {
                      onDeleteScript(scriptId);
                      setDeleteCandidate(undefined);
                    } else {
                      setDeleteCandidate(scriptId);
                    }
                  }}
                >
                  {deleteCandidate === scriptId
                    ? copy.sceneConfirmDeleteScript
                    : copy.sceneDeleteScript}
                </button>
              )}
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
        if (row.kind === "elseBranch") {
          return (
            <div key={key} className={`branch-label depth-${Math.min(row.depth, 4)}`}>
              {copy.elseBranch}
            </div>
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
        const nest = (direction: "in" | "else" | "out") => {
          const intent = nestedMoveIntent(workspace, block.location, direction);
          if (intent === undefined) {
            onAnnounce?.(
              direction === "out"
                ? copy.cannotOutdent
                : direction === "else"
                  ? copy.cannotMoveToElse
                  : copy.cannotIndent,
            );
            return;
          }
          pendingFocus.current = locationKey(intent.to);
          onAnnounce?.(
            direction === "out"
              ? copy.outdentedAnnouncement(label)
              : direction === "else"
                ? copy.movedToElseAnnouncement(label)
                : copy.indentedAnnouncement(label),
          );
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
              name !== "listId" &&
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
            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+ArrowRight Alt+Shift+ArrowRight Alt+ArrowLeft Delete"
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
              if (event.altKey && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
                event.preventDefault();
                nest(event.key === "ArrowLeft" ? "out" : event.shiftKey ? "else" : "in");
                return;
              }
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
            {typeof block.fields.listId === "string" ? (
              <label className="block-field">
                <span>{copy.lists}</span>
                <select
                  aria-label={`${label}: ${copy.lists}`}
                  value={block.fields.listId}
                  onChange={(event) =>
                    onIntent({
                      type: "setTextField",
                      location: block.location,
                      field: "listId",
                      value: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {workspace.lists?.some((list) => list.id === block.fields.listId) ? null : (
                    <option value={block.fields.listId}>{block.fields.listId}</option>
                  )}
                  {(workspace.lists ?? []).map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {(["value", "delta", "index"] as const).map((input) => {
              const operand = block[input];
              if (operand === undefined) return null;
              const reporter =
                operand.type === "variables_value"
                  ? "variable"
                  : operand.type === "lists_length"
                    ? "listLength"
                    : operand.type === "lists_item"
                      ? "listItem"
                      : operand.type === "literal_number"
                        ? "number"
                        : operand.type === "sensing_x_position"
                          ? "xPosition"
                          : operand.type === "sensing_y_position"
                            ? "yPosition"
                            : operand.type === "sensing_distance_to_actor"
                              ? "distanceToActor"
                              : operand.type === "operator_add"
                                ? "add"
                                : operand.type === "operator_subtract"
                                  ? "subtract"
                                  : operand.type === "operator_multiply"
                                    ? "multiply"
                                    : operand.type === "operator_divide"
                                      ? "divide"
                                      : operand.type === "operator_modulo"
                                        ? "modulo"
                                        : operand.type === "operator_random"
                                          ? "random"
                                          : operand.type === "operator_random_integer"
                                            ? "randomInteger"
                                            : "other";
              const referenceId =
                reporter === "variable"
                  ? operand.fields?.variableId
                  : reporter === "distanceToActor"
                    ? operand.fields?.actorId
                    : operand.fields?.listId;
              const operandLabel =
                input === "index"
                  ? copy.listIndex
                  : input === "delta"
                    ? copy.variableDelta
                    : block.type.startsWith("lists_")
                      ? copy.listValue
                      : copy.variableValue;
              const choose = (
                nextReporter:
                  | "number"
                  | "variable"
                  | "listLength"
                  | "listItem"
                  | "xPosition"
                  | "yPosition"
                  | "distanceToActor"
                  | "add"
                  | "subtract"
                  | "multiply"
                  | "divide"
                  | "modulo"
                  | "random"
                  | "randomInteger",
                nextReference?: string,
                nextIndex?: number,
              ) =>
                onIntent({
                  type: "setNumericInput",
                  location: block.location,
                  input,
                  reporter: nextReporter,
                  ...(nextReference === undefined ? {} : { referenceId: nextReference }),
                  ...(nextIndex === undefined ? {} : { itemIndex: nextIndex }),
                });
              const itemIndex = operand.inputs?.index?.fields?.value;
              return (
                <div key={input} className="block-field numeric-socket">
                  <label>
                    <span>{operandLabel}</span>
                    <select
                      aria-label={`${label}: ${operandLabel} ${copy.numericSource}`}
                      value={reporter}
                      onChange={(event) => {
                        const next = event.currentTarget.value as
                          | "number"
                          | "variable"
                          | "listLength"
                          | "listItem"
                          | "xPosition"
                          | "yPosition"
                          | "distanceToActor"
                          | "add"
                          | "subtract"
                          | "multiply"
                          | "divide"
                          | "modulo"
                          | "random"
                          | "randomInteger";
                        choose(
                          next,
                          next === "variable"
                            ? workspace.variables?.[0]?.id
                            : next === "listLength" || next === "listItem"
                              ? workspace.lists?.[0]?.id
                              : next === "distanceToActor"
                                ? actors[0]?.id
                                : undefined,
                        );
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <option value="number">{copy.numericLiteral}</option>
                      <option value="add">{copy.operatorAdd}</option>
                      <option value="subtract">{copy.operatorSubtract}</option>
                      <option value="multiply">{copy.operatorMultiply}</option>
                      <option value="divide">{copy.operatorDivide}</option>
                      <option value="modulo">{copy.operatorModulo}</option>
                      <option value="random">{copy.operatorRandom}</option>
                      <option value="randomInteger">{copy.operatorRandomInteger}</option>
                      <option value="xPosition">{copy.positionX}</option>
                      <option value="yPosition">{copy.positionY}</option>
                      {actors.length > 0 ? (
                        <option value="distanceToActor">{copy.distanceToActor}</option>
                      ) : null}
                      {reporter === "other" ? (
                        <option value="other">
                          {getBlockDefinition(operand.type)?.label ?? operand.type}
                        </option>
                      ) : null}
                      {(workspace.variables?.length ?? 0) > 0 ? (
                        <option value="variable">{copy.variableValue}</option>
                      ) : null}
                      {(workspace.lists?.length ?? 0) > 0 ? (
                        <option value="listLength">{copy.listLength}</option>
                      ) : null}
                      {(workspace.lists?.length ?? 0) > 0 ? (
                        <option value="listItem">{copy.listItem}</option>
                      ) : null}
                    </select>
                  </label>
                  {reporter === "number" && typeof operand.fields?.value === "number" ? (
                    <input
                      key={`${pos}:${input}:${operand.fields.value}`}
                      type="number"
                      tabIndex={isTabbable ? 0 : -1}
                      aria-label={`${label}: ${operandLabel}`}
                      defaultValue={operand.fields.value}
                      draggable={false}
                      onDragStart={(event) => event.stopPropagation()}
                      onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                      onBlur={(event) => {
                        const raw = event.currentTarget.value.trim();
                        const next = Number(raw);
                        if (raw !== "" && Number.isFinite(next) && next !== operand.fields?.value)
                          onIntent({
                            type: "setExpressionNumber",
                            location: block.location,
                            input,
                            value: next,
                          });
                        event.currentTarget.value = String(operand.fields?.value);
                      }}
                    />
                  ) : null}
                  {(
                    [
                      "add",
                      "subtract",
                      "multiply",
                      "divide",
                      "modulo",
                      "random",
                      "randomInteger",
                    ] as const
                  ).includes(
                    reporter as
                      | "add"
                      | "subtract"
                      | "multiply"
                      | "divide"
                      | "modulo"
                      | "random"
                      | "randomInteger",
                  ) ? (
                    <span className="comparison-fields">
                      {(reporter === "random" || reporter === "randomInteger"
                        ? (["min", "max"] as const)
                        : (["left", "right"] as const)
                      ).map((side) => {
                        const part = operand.inputs?.[side];
                        const sideLabel =
                          side === "left"
                            ? copy.conditionLeft
                            : side === "right"
                              ? copy.conditionRight
                              : side === "min"
                                ? copy.rangeMin
                                : copy.rangeMax;
                        const source =
                          part?.type === "literal_number"
                            ? "number"
                            : part?.type === "variables_value"
                              ? "variable"
                              : part?.type === "lists_length"
                                ? "listLength"
                                : part?.type === "sensing_x_position"
                                  ? "xPosition"
                                  : part?.type === "sensing_y_position"
                                    ? "yPosition"
                                    : part?.type === "sensing_distance_to_actor"
                                      ? "distanceToActor"
                                      : "other";
                        const selectSource = (
                          next:
                            | "number"
                            | "variable"
                            | "listLength"
                            | "xPosition"
                            | "yPosition"
                            | "distanceToActor",
                          referenceId?: string,
                        ) =>
                          onIntent({
                            type: "setArithmeticOperandSource",
                            location: block.location,
                            input,
                            side,
                            reporter: next,
                            ...(referenceId === undefined ? {} : { referenceId }),
                          });
                        const sourcePicker = (
                          <select
                            aria-label={`${label}: ${operandLabel} ${sideLabel} ${copy.numericSource}`}
                            value={source}
                            onChange={(event) => {
                              const next = event.currentTarget.value as
                                | "number"
                                | "variable"
                                | "listLength"
                                | "xPosition"
                                | "yPosition"
                                | "distanceToActor";
                              selectSource(
                                next,
                                next === "variable"
                                  ? workspace.variables?.[0]?.id
                                  : next === "listLength"
                                    ? workspace.lists?.[0]?.id
                                    : next === "distanceToActor"
                                      ? actors[0]?.id
                                      : undefined,
                              );
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <option value="number">{copy.numericLiteral}</option>
                            {(workspace.variables?.length ?? 0) > 0 ? (
                              <option value="variable">{copy.variableValue}</option>
                            ) : null}
                            {(workspace.lists?.length ?? 0) > 0 ? (
                              <option value="listLength">{copy.listLength}</option>
                            ) : null}
                            <option value="xPosition">{copy.positionX}</option>
                            <option value="yPosition">{copy.positionY}</option>
                            {actors.length > 0 ? (
                              <option value="distanceToActor">{copy.distanceToActor}</option>
                            ) : null}
                            {source === "other" ? (
                              <option value="other">{part?.type}</option>
                            ) : null}
                          </select>
                        );
                        if (
                          part?.type !== "literal_number" ||
                          typeof part.fields?.value !== "number"
                        ) {
                          const choices =
                            source === "variable"
                              ? workspace.variables
                              : source === "listLength"
                                ? workspace.lists
                                : source === "distanceToActor"
                                  ? actors
                                  : undefined;
                          const selected =
                            source === "variable"
                              ? part?.fields?.variableId
                              : source === "listLength"
                                ? part?.fields?.listId
                                : part?.fields?.actorId;
                          return (
                            <span key={side} className="block-field">
                              <span>{sideLabel}</span>
                              {sourcePicker}
                              {choices === undefined ? null : (
                                <select
                                  aria-label={`${label}: ${operandLabel} ${sideLabel} ${copy.numericReference}`}
                                  value={String(selected ?? "")}
                                  onChange={(event) =>
                                    selectSource(
                                      source as "variable" | "listLength" | "distanceToActor",
                                      event.currentTarget.value,
                                    )
                                  }
                                  onKeyDown={(event) => event.stopPropagation()}
                                >
                                  {choices.map((choice) => (
                                    <option key={choice.id} value={choice.id}>
                                      {choice.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </span>
                          );
                        }
                        const value = part.fields.value;
                        return (
                          <span key={side} className="block-field">
                            <span>{sideLabel}</span>
                            {sourcePicker}
                            <input
                              key={`${pos}:${input}:${side}:${value}`}
                              type="number"
                              tabIndex={isTabbable ? 0 : -1}
                              aria-label={`${label}: ${operandLabel} ${sideLabel}`}
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
                                    type: "setArithmeticOperand",
                                    location: block.location,
                                    input,
                                    side,
                                    value: next,
                                  });
                                event.currentTarget.value = String(value);
                              }}
                            />
                          </span>
                        );
                      })}
                    </span>
                  ) : null}
                  {reporter === "distanceToActor" ? (
                    <label>
                      <span>{copy.conditionActor}</span>
                      <select
                        aria-label={`${label}: ${operandLabel} ${copy.conditionActor}`}
                        value={String(referenceId ?? "")}
                        onChange={(event) => choose("distanceToActor", event.currentTarget.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {actors.map((actor) => (
                          <option key={actor.id} value={actor.id}>
                            {actor.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {reporter === "variable" ||
                  reporter === "listLength" ||
                  reporter === "listItem" ? (
                    <label>
                      <span>{reporter === "variable" ? copy.variables : copy.lists}</span>
                      <select
                        aria-label={`${label}: ${operandLabel} ${copy.numericReference}`}
                        value={String(referenceId ?? "")}
                        onChange={(event) =>
                          choose(
                            reporter,
                            event.currentTarget.value,
                            reporter === "listItem" && typeof itemIndex === "number"
                              ? itemIndex
                              : undefined,
                          )
                        }
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        {(reporter === "variable"
                          ? (workspace.variables ?? [])
                          : (workspace.lists ?? [])
                        ).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {reporter === "listItem" && typeof itemIndex === "number" ? (
                    <label>
                      <span>{copy.listIndex}</span>
                      <input
                        type="number"
                        aria-label={`${label}: ${copy.listIndex}`}
                        defaultValue={itemIndex}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                          if (event.key === "Enter") event.currentTarget.blur();
                        }}
                        onBlur={(event) => {
                          const next = Number(event.currentTarget.value);
                          if (
                            event.currentTarget.value.trim() !== "" &&
                            Number.isFinite(next) &&
                            next !== itemIndex
                          )
                            choose("listItem", String(referenceId), next);
                          event.currentTarget.value = String(itemIndex);
                        }}
                      />
                    </label>
                  ) : null}
                </div>
              );
            })}
            {block.type === "control_if" || block.type === "control_repeat_until" ? (
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
                      ...(selectedExpression === "sensing_touching_actor" && actors[0] !== undefined
                        ? { actorId: actors[0].id }
                        : {}),
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
                      ...(source.blockType === "sensing_touching_actor" && actors[0] !== undefined
                        ? { actorId: actors[0].id }
                        : {}),
                    });
                  }
                }}
              >
                {block.condition === undefined
                  ? copy.condition
                  : (getBlockDefinition(block.condition.type)?.label ?? block.condition.type)}
              </button>
            ) : null}
            {(block.type === "control_if" || block.type === "control_repeat_until") &&
            block.condition !== undefined &&
            ["operator_and", "operator_or", "operator_not"].includes(block.condition.type) ? (
              <span className="comparison-fields logical-fields">
                {(block.condition.type === "operator_not"
                  ? (["value"] as const)
                  : (["left", "right"] as const)
                ).map((side) => {
                  const operand = block.condition?.inputs?.[side];
                  if (operand === undefined || Array.isArray(operand)) return null;
                  return (
                    <span key={side} className="block-field">
                      <label>
                        <span>
                          {side === "left"
                            ? copy.conditionLeft
                            : side === "right"
                              ? copy.conditionRight
                              : copy.conditionValue}
                        </span>
                        <select
                          aria-label={`${copy.condition}: ${side} ${copy.numericSource}`}
                          value={
                            (STUDIO_LOGICAL_OPERAND_TYPES as readonly string[]).includes(
                              operand.type,
                            )
                              ? operand.type
                              : "other"
                          }
                          onChange={(event) =>
                            onIntent({
                              type: "setLogicalOperand",
                              location: block.location,
                              side,
                              blockType: event.currentTarget
                                .value as (typeof STUDIO_LOGICAL_OPERAND_TYPES)[number],
                            })
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {STUDIO_LOGICAL_OPERAND_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {getBlockDefinition(type)?.label ?? type}
                            </option>
                          ))}
                          {(STUDIO_LOGICAL_OPERAND_TYPES as readonly string[]).includes(
                            operand.type,
                          ) ? null : (
                            <option value="other">
                              {getBlockDefinition(operand.type)?.label ?? operand.type}
                            </option>
                          )}
                        </select>
                      </label>
                      {operand.type === "literal_boolean" ? (
                        <label>
                          <span>{copy.conditionValue}</span>
                          <select
                            aria-label={`${copy.condition}: ${side} ${copy.conditionValue}`}
                            value={String(operand.fields?.value === true)}
                            onChange={(event) =>
                              onIntent({
                                type: "setLogicalBoolean",
                                location: block.location,
                                side,
                                value: event.currentTarget.value === "true",
                              })
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <option value="true">{copy.trueLabel}</option>
                            <option value="false">{copy.falseLabel}</option>
                          </select>
                        </label>
                      ) : null}
                    </span>
                  );
                })}
              </span>
            ) : null}
            {(block.type === "control_if" || block.type === "control_repeat_until") &&
            block.condition?.type === "literal_boolean" ? (
              <label className="block-field condition-detail">
                <span>{copy.conditionValue}</span>
                <select
                  aria-label={`${copy.condition}: ${copy.conditionValue}`}
                  value={String(block.condition.fields?.value === true)}
                  onChange={(event) =>
                    onIntent({
                      type: "setConditionBoolean",
                      location: block.location,
                      value: event.currentTarget.value === "true",
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <option value="true">{copy.trueLabel}</option>
                  <option value="false">{copy.falseLabel}</option>
                </select>
              </label>
            ) : null}
            {(block.type === "control_if" || block.type === "control_repeat_until") &&
            block.condition?.type === "sensing_touching_actor" ? (
              <label className="block-field condition-detail">
                <span>{copy.conditionActor}</span>
                <select
                  aria-label={`${copy.condition}: ${copy.conditionActor}`}
                  value={String(block.condition.fields?.actorId ?? "")}
                  onChange={(event) =>
                    onIntent({
                      type: "setConditionActor",
                      location: block.location,
                      actorId: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {actors.some((actor) => actor.id === block.condition?.fields?.actorId) ? null : (
                    <option value={String(block.condition.fields?.actorId ?? "")}>
                      {String(block.condition.fields?.actorId ?? "")}
                    </option>
                  )}
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {(block.type === "control_if" || block.type === "control_repeat_until") &&
            block.condition !== undefined &&
            (STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(block.condition.type) ? (
              <span className="comparison-fields">
                {(["left", "right"] as const).map((side) => {
                  const operand = block.condition?.inputs?.[side];
                  if (operand === undefined || Array.isArray(operand)) return null;
                  const source =
                    operand.type === "literal_number"
                      ? "number"
                      : operand.type === "variables_value"
                        ? "variable"
                        : operand.type === "lists_length"
                          ? "listLength"
                          : operand.type === "sensing_x_position"
                            ? "xPosition"
                            : operand.type === "sensing_y_position"
                              ? "yPosition"
                              : "other";
                  const sideLabel = side === "left" ? copy.conditionLeft : copy.conditionRight;
                  const referenceId =
                    source === "variable" ? operand.fields?.variableId : operand.fields?.listId;
                  const choose = (
                    next: (typeof STUDIO_COMPARISON_OPERAND_SOURCES)[number],
                    id?: string,
                  ) =>
                    onIntent({
                      type: "setComparisonOperand",
                      location: block.location,
                      side,
                      source: next,
                      ...(id === undefined ? {} : { referenceId: id }),
                    });
                  return (
                    <span key={side} className="block-field comparison-operand">
                      <label>
                        <span>{sideLabel}</span>
                        <select
                          aria-label={`${copy.condition}: ${sideLabel} ${copy.numericSource}`}
                          value={source}
                          onChange={(event) => {
                            const next = event.currentTarget
                              .value as (typeof STUDIO_COMPARISON_OPERAND_SOURCES)[number];
                            choose(
                              next,
                              next === "variable"
                                ? workspace.variables?.[0]?.id
                                : next === "listLength"
                                  ? workspace.lists?.[0]?.id
                                  : undefined,
                            );
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <option value="number">{copy.numericLiteral}</option>
                          {workspace.variables?.length ? (
                            <option value="variable">{copy.variableValue}</option>
                          ) : null}
                          {workspace.lists?.length ? (
                            <option value="listLength">{copy.listLength}</option>
                          ) : null}
                          <option value="xPosition">{copy.positionX}</option>
                          <option value="yPosition">{copy.positionY}</option>
                          {source === "other" ? (
                            <option value="other">
                              {getBlockDefinition(operand.type)?.label ?? operand.type}
                            </option>
                          ) : null}
                        </select>
                      </label>
                      {source === "variable" || source === "listLength" ? (
                        <label>
                          <span>{copy.numericReference}</span>
                          <select
                            aria-label={`${copy.condition}: ${sideLabel} ${copy.numericReference}`}
                            value={String(referenceId ?? "")}
                            onChange={(event) => choose(source, event.currentTarget.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {(source === "variable"
                              ? (workspace.variables ?? [])
                              : (workspace.lists ?? [])
                            ).map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {source === "number" && typeof operand.fields?.value === "number" ? (
                        <label>
                          <span>{sideLabel}</span>
                          <input
                            key={`${pos}:${side}:${operand.fields.value}`}
                            type="number"
                            tabIndex={isTabbable ? 0 : -1}
                            aria-label={`${copy.condition}: ${sideLabel}`}
                            defaultValue={operand.fields.value}
                            draggable={false}
                            onDragStart={(event) => event.stopPropagation()}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter") event.currentTarget.blur();
                            }}
                            onBlur={(event) => {
                              const raw = event.currentTarget.value.trim();
                              const next = Number(raw);
                              if (
                                raw !== "" &&
                                Number.isFinite(next) &&
                                next !== operand.fields?.value
                              ) {
                                onIntent({
                                  type: "setConditionNumber",
                                  location: block.location,
                                  side,
                                  value: next,
                                });
                              }
                              event.currentTarget.value = String(operand.fields?.value);
                            }}
                          />
                        </label>
                      ) : null}
                    </span>
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
            {block.type === "looks_go_to_layer" ? (
              <label className="block-field">
                <span>{copy.layer}</span>
                <select
                  aria-label={`${label}: ${copy.layer}`}
                  value={String(block.fields?.layer ?? "front")}
                  onChange={(event) =>
                    onIntent({
                      type: "setTextField",
                      location: block.location,
                      field: "layer",
                      value: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <option value="front">{copy.layerFront}</option>
                  <option value="back">{copy.layerBack}</option>
                </select>
              </label>
            ) : null}
            {block.type === "motion_point_towards" ? (
              <label className="block-field">
                <span>{copy.conditionActor}</span>
                <select
                  aria-label={`${label}: ${copy.conditionActor}`}
                  value={String(block.fields?.actorId ?? "")}
                  onChange={(event) =>
                    onIntent({
                      type: "setTextField",
                      location: block.location,
                      field: "actorId",
                      value: event.currentTarget.value,
                    })
                  }
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {actors.some((actor) => actor.id === block.fields?.actorId) ? null : (
                    <option value={String(block.fields?.actorId ?? "")}>
                      {String(block.fields?.actorId ?? "")}
                    </option>
                  )}
                  {actors.map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
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
