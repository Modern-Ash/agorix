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
import { LogicalComparisonFields } from "./LogicalComparisonFields.js";
import { NestedLogicalFields } from "./NestedLogicalFields.js";
import { numericReporterForBlock } from "./numericPalette.js";
import { NestedNumericSocket } from "./NestedNumericSocket.js";

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

/** Compound numeric sources a custom block call argument can be built from, and their operand sides. */
const CALL_ARGUMENT_COMPOUND = [
  { reporter: "add", type: "operator_add", sides: ["left", "right"] },
  { reporter: "subtract", type: "operator_subtract", sides: ["left", "right"] },
  { reporter: "multiply", type: "operator_multiply", sides: ["left", "right"] },
  { reporter: "divide", type: "operator_divide", sides: ["left", "right"] },
  { reporter: "modulo", type: "operator_modulo", sides: ["left", "right"] },
  { reporter: "random", type: "operator_random", sides: ["min", "max"] },
  { reporter: "randomInteger", type: "operator_random_integer", sides: ["min", "max"] },
  { reporter: "mathFunction", type: "operator_math_function", sides: ["value"] },
  { reporter: "listItem", type: "lists_item", sides: ["index"] },
] as const;

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
  selectedNumeric,
  visibleScriptIds,
  selectedScriptId,
  activeProcedureId,
  onCloseProcedure,
  onSelectScript,
  onDeleteScript,
  breakpointBlockIds,
  onToggleBreakpoint,
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
  readonly selectedNumeric?: BlockType | undefined;
  readonly visibleScriptIds?: readonly string[] | undefined;
  readonly selectedScriptId?: string | undefined;
  readonly activeProcedureId?: string | undefined;
  readonly onCloseProcedure?: (() => void) | undefined;
  readonly onSelectScript?: ((id: string) => void) | undefined;
  readonly onDeleteScript?: ((id: string) => void) | undefined;
  readonly breakpointBlockIds?: ReadonlySet<string> | undefined;
  readonly onToggleBreakpoint?: ((id: string) => void) | undefined;
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
    const procedureIndex =
      row.kind === "procedure" || row.kind === "elseBranch"
        ? row.procedureIndex
        : row.kind === "slot"
          ? row.slot.container.kind === "script"
            ? undefined
            : row.slot.container.procedureIndex
          : row.kind === "block"
            ? row.block.location.container.kind === "script"
              ? undefined
              : row.block.location.container.procedureIndex
            : undefined;
    if (
      activeProcedureId === undefined &&
      (row.kind === "procedure" || procedureIndex !== undefined)
    )
      return false;
    if (activeProcedureId !== undefined) {
      if (row.kind === "script" || procedureIndex === undefined) return false;
      const owner =
        workspace.scripts[
          row.kind === "procedure" || row.kind === "elseBranch"
            ? row.scriptIndex
            : row.kind === "slot"
              ? row.slot.container.scriptIndex
              : row.block.location.container.scriptIndex
        ];
      if (owner?.procedures?.[procedureIndex]?.id !== activeProcedureId) return false;
    }
    if (visibleScriptIds === undefined) return true;
    const scriptIndex =
      row.kind === "script" || row.kind === "procedure"
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
        if (row.kind === "procedure") {
          return (
            <div key={key} className="script-heading procedure-heading">
              <strong>
                {copy.customBlock}: {row.name}
              </strong>
              {onCloseProcedure === undefined ? null : (
                <button type="button" onClick={onCloseProcedure}>
                  {copy.customBlockBack}
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
        const hasBreakpoint = breakpointBlockIds?.has(block.id) === true;
        const isFail = sync?.failedBlockId === block.id;
        const visual = visualBlock(block.type);
        const fieldEntries = Object.entries(block.fields);
        const fields = fieldEntries
          .filter(
            ([name, value]) =>
              name !== "variableId" &&
              name !== "listId" &&
              name !== "procedureId" &&
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
                operand.type === "parameter_value"
                  ? "parameter"
                  : operand.type === "variables_value"
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
                                              : operand.type === "operator_math_function"
                                                ? "mathFunction"
                                                : "other";
              const referenceId =
                reporter === "variable"
                  ? operand.fields?.variableId
                  : reporter === "parameter"
                    ? operand.fields?.parameterId
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
                  | "parameter"
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
                  | "randomInteger"
                  | "mathFunction",
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
              const placeNumeric = (blockType: BlockType) => {
                const source = numericReporterForBlock(blockType);
                if (source === undefined) return;
                const referenceId =
                  source === "variable"
                    ? workspace.variables?.[0]?.id
                    : source === "parameter" && block.location.container.kind === "procedure"
                      ? workspace.scripts[block.location.container.scriptIndex]?.procedures?.[
                          block.location.container.procedureIndex
                        ]?.parameters?.[0]?.id
                      : source === "listLength" || source === "listItem"
                        ? workspace.lists?.[0]?.id
                        : source === "distanceToActor"
                          ? actors[0]?.id
                          : undefined;
                if (
                  ((source === "variable" || source === "listLength" || source === "listItem") &&
                    referenceId === undefined) ||
                  (source === "distanceToActor" && referenceId === undefined)
                )
                  return;
                choose(source, referenceId);
              };
              const itemIndex = operand.inputs?.index?.fields?.value;
              const selectedSource =
                selectedNumeric === undefined
                  ? undefined
                  : numericReporterForBlock(selectedNumeric);
              const selectedSourceAvailable =
                selectedSource !== undefined &&
                (selectedSource !== "variable" || (workspace.variables?.length ?? 0) > 0) &&
                (selectedSource !== "parameter" ||
                  (block.location.container.kind === "procedure" &&
                    (workspace.scripts[block.location.container.scriptIndex]?.procedures?.[
                      block.location.container.procedureIndex
                    ]?.parameters?.length ?? 0) > 0)) &&
                ((selectedSource !== "listLength" && selectedSource !== "listItem") ||
                  (workspace.lists?.length ?? 0) > 0) &&
                (selectedSource !== "distanceToActor" || actors.length > 0);
              return (
                <div
                  key={input}
                  className="block-field numeric-socket"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const source = readSource(event);
                    if (source?.kind === "palette") placeNumeric(source.blockType);
                  }}
                >
                  <label>
                    <span>{operandLabel}</span>
                    <select
                      aria-label={`${label}: ${operandLabel} ${copy.numericSource}`}
                      value={reporter}
                      onChange={(event) => {
                        const next = event.currentTarget.value as
                          | "number"
                          | "variable"
                          | "parameter"
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
                          | "randomInteger"
                          | "mathFunction";
                        choose(
                          next,
                          next === "variable"
                            ? workspace.variables?.[0]?.id
                            : next === "parameter" && block.location.container.kind === "procedure"
                              ? workspace.scripts[block.location.container.scriptIndex]
                                  ?.procedures?.[block.location.container.procedureIndex]
                                  ?.parameters?.[0]?.id
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
                      <option value="mathFunction">{copy.operatorMathFunction}</option>
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
                      {block.location.container.kind === "procedure" &&
                      (workspace.scripts[block.location.container.scriptIndex]?.procedures?.[
                        block.location.container.procedureIndex
                      ]?.parameters?.length ?? 0) > 0 ? (
                        <option value="parameter">{copy.customBlockParameter}</option>
                      ) : null}
                      {(workspace.lists?.length ?? 0) > 0 ? (
                        <option value="listLength">{copy.listLength}</option>
                      ) : null}
                      {(workspace.lists?.length ?? 0) > 0 ? (
                        <option value="listItem">{copy.listItem}</option>
                      ) : null}
                    </select>
                  </label>
                  {!selectedSourceAvailable ? null : (
                    <button
                      type="button"
                      className="numeric-place"
                      aria-label={`${copy.placeValue}: ${label}: ${operandLabel}`}
                      onClick={() => {
                        if (selectedNumeric !== undefined) placeNumeric(selectedNumeric);
                      }}
                    >
                      {copy.placeValue}
                    </button>
                  )}
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
                  {reporter === "mathFunction" ? (
                    <span className="math-function-fields">
                      <label>
                        <span>{copy.mathFunction}</span>
                        <select
                          aria-label={`${label}: ${operandLabel} ${copy.mathFunction}`}
                          value={String(operand.fields?.function ?? "abs")}
                          onChange={(event) =>
                            onIntent({
                              type: "setMathFunction",
                              location: block.location,
                              input,
                              function: event.currentTarget.value as
                                "abs" | "round" | "floor" | "ceiling",
                            })
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <option value="abs">{copy.mathAbs}</option>
                          <option value="round">{copy.mathRound}</option>
                          <option value="floor">{copy.mathFloor}</option>
                          <option value="ceiling">{copy.mathCeiling}</option>
                        </select>
                      </label>
                      <label>
                        <span>{copy.numericSource}</span>
                        <select
                          aria-label={`${label}: ${operandLabel} ${copy.mathValue} ${copy.numericSource}`}
                          value={
                            operand.inputs?.value?.type === "literal_number"
                              ? "number"
                              : operand.inputs?.value?.type === "variables_value"
                                ? "variable"
                                : operand.inputs?.value?.type === "lists_length"
                                  ? "listLength"
                                  : operand.inputs?.value?.type === "sensing_x_position"
                                    ? "xPosition"
                                    : operand.inputs?.value?.type === "sensing_y_position"
                                      ? "yPosition"
                                      : operand.inputs?.value?.type === "sensing_distance_to_actor"
                                        ? "distanceToActor"
                                        : "other"
                          }
                          onChange={(event) => {
                            const next = event.currentTarget.value as
                              | "number"
                              | "variable"
                              | "listLength"
                              | "xPosition"
                              | "yPosition"
                              | "distanceToActor";
                            const referenceId =
                              next === "variable"
                                ? workspace.variables?.[0]?.id
                                : next === "listLength"
                                  ? workspace.lists?.[0]?.id
                                  : next === "distanceToActor"
                                    ? actors[0]?.id
                                    : undefined;
                            onIntent({
                              type: "setMathFunctionSource",
                              location: block.location,
                              input,
                              reporter: next,
                              ...(referenceId === undefined ? {} : { referenceId }),
                            });
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
                          {operand.inputs?.value?.type !== "literal_number" &&
                          ![
                            "variables_value",
                            "lists_length",
                            "sensing_x_position",
                            "sensing_y_position",
                            "sensing_distance_to_actor",
                          ].includes(operand.inputs?.value?.type ?? "") ? (
                            <option value="other">{operand.inputs?.value?.type}</option>
                          ) : null}
                        </select>
                      </label>
                      {(
                        operand.inputs?.value?.type === "variables_value"
                          ? workspace.variables
                          : operand.inputs?.value?.type === "lists_length"
                            ? workspace.lists
                            : operand.inputs?.value?.type === "sensing_distance_to_actor"
                              ? actors
                              : undefined
                      ) ? (
                        <select
                          aria-label={`${label}: ${operandLabel} ${copy.mathValue} ${copy.numericReference}`}
                          value={String(
                            operand.inputs?.value?.fields?.variableId ??
                              operand.inputs?.value?.fields?.listId ??
                              operand.inputs?.value?.fields?.actorId ??
                              "",
                          )}
                          onChange={(event) =>
                            onIntent({
                              type: "setMathFunctionSource",
                              location: block.location,
                              input,
                              reporter:
                                operand.inputs?.value?.type === "variables_value"
                                  ? "variable"
                                  : operand.inputs?.value?.type === "lists_length"
                                    ? "listLength"
                                    : "distanceToActor",
                              referenceId: event.currentTarget.value,
                            })
                          }
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {(operand.inputs?.value?.type === "variables_value"
                            ? workspace.variables
                            : operand.inputs?.value?.type === "lists_length"
                              ? workspace.lists
                              : actors
                          )?.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {operand.inputs?.value?.type === "literal_number" ? (
                        <label>
                          <span>{copy.mathValue}</span>
                          <input
                            key={`${pos}:${input}:math:${operand.inputs.value.fields?.value}`}
                            type="number"
                            aria-label={`${label}: ${operandLabel} ${copy.mathValue}`}
                            defaultValue={
                              typeof operand.inputs.value.fields?.value === "number"
                                ? operand.inputs.value.fields.value
                                : 0
                            }
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter") event.currentTarget.blur();
                            }}
                            onBlur={(event) => {
                              const raw = event.currentTarget.value.trim();
                              const value = Number(raw);
                              if (
                                raw !== "" &&
                                Number.isFinite(value) &&
                                value !== operand.inputs?.value?.fields?.value
                              )
                                onIntent({
                                  type: "setMathFunction",
                                  location: block.location,
                                  input,
                                  function: operand.fields?.function as
                                    "abs" | "round" | "floor" | "ceiling",
                                  value,
                                });
                            }}
                          />
                        </label>
                      ) : (
                        <span>
                          {getBlockDefinition(operand.inputs?.value?.type as BlockType)?.label ??
                            operand.inputs?.value?.type}
                        </span>
                      )}
                    </span>
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
                                      : part?.type === "operator_add"
                                        ? "add"
                                        : part?.type === "operator_subtract"
                                          ? "subtract"
                                          : part?.type === "operator_multiply"
                                            ? "multiply"
                                            : part?.type === "operator_divide"
                                              ? "divide"
                                              : part?.type === "operator_modulo"
                                                ? "modulo"
                                                : part?.type === "operator_random"
                                                  ? "random"
                                                  : part?.type === "operator_random_integer"
                                                    ? "randomInteger"
                                                    : part?.type === "operator_math_function"
                                                      ? "mathFunction"
                                                      : "other";
                        const selectSource = (
                          next:
                            | "number"
                            | "variable"
                            | "listLength"
                            | "xPosition"
                            | "yPosition"
                            | "distanceToActor"
                            | "add"
                            | "subtract"
                            | "multiply"
                            | "divide"
                            | "modulo"
                            | "random"
                            | "randomInteger"
                            | "mathFunction",
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
                                | "distanceToActor"
                                | "add"
                                | "subtract"
                                | "multiply"
                                | "divide"
                                | "modulo"
                                | "random"
                                | "randomInteger"
                                | "mathFunction";
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
                            <option value="add">{copy.operatorAdd}</option>
                            <option value="subtract">{copy.operatorSubtract}</option>
                            <option value="multiply">{copy.operatorMultiply}</option>
                            <option value="divide">{copy.operatorDivide}</option>
                            <option value="modulo">{copy.operatorModulo}</option>
                            <option value="random">{copy.operatorRandom}</option>
                            <option value="randomInteger">{copy.operatorRandomInteger}</option>
                            <option value="mathFunction">{copy.operatorMathFunction}</option>
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
                              {source === "mathFunction" ? (
                                <label className="block-field">
                                  <span>{copy.mathFunction}</span>
                                  <select
                                    aria-label={`${label}: ${operandLabel} ${sideLabel} ${copy.mathFunction}`}
                                    value={String(part?.fields?.function ?? "abs")}
                                    onChange={(event) =>
                                      onIntent({
                                        type: "setArithmeticMathFunction",
                                        location: block.location,
                                        input,
                                        side,
                                        function: event.currentTarget.value as
                                          "abs" | "round" | "floor" | "ceiling",
                                      })
                                    }
                                    onKeyDown={(event) => event.stopPropagation()}
                                  >
                                    <option value="abs">{copy.mathAbs}</option>
                                    <option value="round">{copy.mathRound}</option>
                                    <option value="floor">{copy.mathFloor}</option>
                                    <option value="ceiling">{copy.mathCeiling}</option>
                                  </select>
                                </label>
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
                                  "mathFunction",
                                ] as const
                              ).includes(
                                source as
                                  | "add"
                                  | "subtract"
                                  | "multiply"
                                  | "divide"
                                  | "modulo"
                                  | "random"
                                  | "randomInteger"
                                  | "mathFunction",
                              )
                                ? (source === "mathFunction"
                                    ? (["value"] as const)
                                    : source === "random" || source === "randomInteger"
                                      ? (["min", "max"] as const)
                                      : (["left", "right"] as const)
                                  ).map((nestedSide) => (
                                    <NestedNumericSocket
                                      key={nestedSide}
                                      node={part?.inputs?.[nestedSide]}
                                      side={nestedSide}
                                      path={[side]}
                                      location={block.location}
                                      input={input}
                                      label={label}
                                      operandLabel={operandLabel}
                                      rootSideLabel={sideLabel}
                                      copy={copy}
                                      workspace={workspace}
                                      actors={actors}
                                      onIntent={onIntent}
                                    />
                                  ))
                                : null}
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
                  {reporter === "parameter" ||
                  reporter === "variable" ||
                  reporter === "listLength" ||
                  reporter === "listItem" ? (
                    <label>
                      <span>
                        {reporter === "parameter"
                          ? copy.customBlockParameter
                          : reporter === "variable"
                            ? copy.variables
                            : copy.lists}
                      </span>
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
                        {(reporter === "parameter" && block.location.container.kind === "procedure"
                          ? (workspace.scripts[block.location.container.scriptIndex]?.procedures?.[
                              block.location.container.procedureIndex
                            ]?.parameters ?? [])
                          : reporter === "variable"
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
                              ...(event.currentTarget.value === "sensing_touching_actor" &&
                              actors[0] !== undefined
                                ? { actorId: actors[0].id }
                                : {}),
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
                      {operand.type === "sensing_touching_actor" ? (
                        <label>
                          <span>{copy.conditionActor}</span>
                          <select
                            aria-label={`${copy.condition}: ${side} ${copy.conditionActor}`}
                            value={String(operand.fields?.actorId ?? "")}
                            onChange={(event) =>
                              onIntent({
                                type: "setLogicalActor",
                                location: block.location,
                                side,
                                actorId: event.currentTarget.value,
                              })
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {actors.some((actor) => actor.id === operand.fields?.actorId) ? null : (
                              <option value={String(operand.fields?.actorId ?? "")}>
                                {String(operand.fields?.actorId ?? "")}
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
                      {(STUDIO_COMPARISON_BLOCK_TYPES as readonly string[]).includes(
                        operand.type,
                      ) ? (
                        <LogicalComparisonFields
                          comparison={operand}
                          side={side}
                          location={block.location}
                          workspace={workspace}
                          actors={actors}
                          copy={copy}
                          onIntent={onIntent}
                          pos={pos}
                          isTabbable={isTabbable}
                        />
                      ) : null}
                      {["operator_and", "operator_or", "operator_not"].includes(operand.type) ? (
                        <NestedLogicalFields
                          condition={operand}
                          path={[side]}
                          location={block.location}
                          workspace={workspace}
                          pos={pos}
                          isTabbable={isTabbable}
                          actors={actors}
                          copy={copy}
                          onIntent={onIntent}
                        />
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
                          : operand.type === "lists_item"
                            ? "listItem"
                            : operand.type === "operator_random_integer"
                              ? "randomInteger"
                              : operand.type === "operator_math_function"
                                ? "mathFunction"
                                : operand.type === "sensing_x_position"
                                  ? "xPosition"
                                  : operand.type === "sensing_y_position"
                                    ? "yPosition"
                                    : operand.type === "sensing_distance_to_actor"
                                      ? "distanceToActor"
                                      : "other";
                  const sideLabel = side === "left" ? copy.conditionLeft : copy.conditionRight;
                  const referenceId =
                    source === "variable"
                      ? operand.fields?.variableId
                      : source === "distanceToActor"
                        ? operand.fields?.actorId
                        : operand.fields?.listId;
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
                          {workspace.variables?.length ? (
                            <option value="variable">{copy.variableValue}</option>
                          ) : null}
                          {workspace.lists?.length ? (
                            <option value="listLength">{copy.listLength}</option>
                          ) : null}
                          {workspace.lists?.length ? (
                            <option value="listItem">{copy.listItem}</option>
                          ) : null}
                          <option value="randomInteger">{copy.operatorRandomInteger}</option>
                          <option value="mathFunction">{copy.operatorMathFunction}</option>
                          <option value="xPosition">{copy.positionX}</option>
                          <option value="yPosition">{copy.positionY}</option>
                          {actors.length > 0 ? (
                            <option value="distanceToActor">{copy.distanceToActor}</option>
                          ) : null}
                          {source === "other" ? (
                            <option value="other">
                              {getBlockDefinition(operand.type)?.label ?? operand.type}
                            </option>
                          ) : null}
                        </select>
                      </label>
                      {source === "variable" ||
                      source === "listLength" ||
                      source === "listItem" ||
                      source === "distanceToActor" ? (
                        <label>
                          <span>
                            {source === "distanceToActor"
                              ? copy.conditionActor
                              : copy.numericReference}
                          </span>
                          <select
                            aria-label={`${copy.condition}: ${sideLabel} ${source === "distanceToActor" ? copy.conditionActor : copy.numericReference}`}
                            value={String(referenceId ?? "")}
                            onChange={(event) => choose(source, event.currentTarget.value)}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {(source === "variable"
                              ? (workspace.variables ?? [])
                              : source === "distanceToActor"
                                ? actors
                                : (workspace.lists ?? [])
                            ).map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                      {source === "mathFunction" ? (
                        <label>
                          <span>{copy.mathFunction}</span>
                          <select
                            aria-label={`${copy.condition}: ${sideLabel} ${copy.mathFunction}`}
                            value={String(operand.fields?.function ?? "abs")}
                            onChange={(event) =>
                              onIntent({
                                type: "setComparisonMathFunction",
                                location: block.location,
                                side,
                                function: event.currentTarget.value as
                                  "abs" | "round" | "floor" | "ceiling",
                              })
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <option value="abs">{copy.mathAbs}</option>
                            <option value="round">{copy.mathRound}</option>
                            <option value="floor">{copy.mathFloor}</option>
                            <option value="ceiling">{copy.mathCeiling}</option>
                          </select>
                        </label>
                      ) : null}
                      {(source === "listItem" ||
                        source === "randomInteger" ||
                        source === "mathFunction") &&
                        (source === "listItem"
                          ? (["index"] as const)
                          : source === "mathFunction"
                            ? (["value"] as const)
                            : (["min", "max"] as const)
                        ).map((field) => {
                          const nested = operand.inputs?.[field];
                          if (
                            nested === undefined ||
                            Array.isArray(nested) ||
                            nested.type !== "literal_number" ||
                            typeof nested.fields?.value !== "number"
                          )
                            return null;
                          const label =
                            field === "index"
                              ? copy.listIndex
                              : field === "value"
                                ? copy.mathValue
                                : field === "min"
                                  ? copy.rangeMin
                                  : copy.rangeMax;
                          return (
                            <label key={field}>
                              <span>{label}</span>
                              <input
                                key={`${pos}:${side}:${field}:${nested.fields.value}`}
                                type="number"
                                tabIndex={isTabbable ? 0 : -1}
                                aria-label={`${copy.condition}: ${sideLabel} ${label}`}
                                defaultValue={nested.fields.value}
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
                                    next !== nested.fields?.value
                                  )
                                    onIntent({
                                      type: "setComparisonNestedNumber",
                                      location: block.location,
                                      side,
                                      field,
                                      value: next,
                                    });
                                  event.currentTarget.value = String(nested.fields?.value);
                                }}
                              />
                            </label>
                          );
                        })}
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
            {block.type === "procedures_call" ? (
              <div className="block-field">
                <label>
                  <span>{copy.customBlock}</span>
                  <select
                    aria-label={`${label}: ${copy.customBlock}`}
                    value={String(block.fields?.procedureId ?? "")}
                    onChange={(event) =>
                      onIntent({
                        type: "setTextField",
                        location: block.location,
                        field: "procedureId",
                        value: event.currentTarget.value,
                      })
                    }
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    {workspace.scripts[block.location.container.scriptIndex]?.procedures?.some(
                      (procedure) => procedure.id === block.fields?.procedureId,
                    ) ? null : (
                      <option value={String(block.fields?.procedureId ?? "")}>
                        {String(block.fields?.procedureId ?? "")}
                      </option>
                    )}
                    {workspace.scripts[block.location.container.scriptIndex]?.procedures?.map(
                      (procedure) => (
                        <option key={procedure.id} value={procedure.id}>
                          {procedure.name}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {workspace.scripts[block.location.container.scriptIndex]?.procedures
                  ?.find((procedure) => procedure.id === block.fields?.procedureId)
                  ?.parameters?.map((parameter, argumentIndex) => {
                    const argument = block.args?.[argumentIndex];
                    return (
                      <div className="block-field" key={parameter.id}>
                        <span>{parameter.name}</span>
                        <select
                          aria-label={`${copy.customBlockArguments}: ${parameter.name} ${copy.numericSource}`}
                          value={
                            argument?.type === "literal_number"
                              ? "number"
                              : argument?.type === "variables_value"
                                ? "variable"
                                : argument?.type === "parameter_value"
                                  ? "parameter"
                                  : argument?.type === "lists_length"
                                    ? "listLength"
                                    : argument?.type === "sensing_x_position"
                                      ? "xPosition"
                                      : argument?.type === "sensing_y_position"
                                        ? "yPosition"
                                        : (CALL_ARGUMENT_COMPOUND.find(
                                            (entry) => argument?.type === entry.type,
                                          )?.reporter ?? "other")
                          }
                          onChange={(event) => {
                            const reporter = event.currentTarget.value as
                              | "number"
                              | "variable"
                              | "parameter"
                              | "listLength"
                              | "xPosition"
                              | "yPosition"
                              | (typeof CALL_ARGUMENT_COMPOUND)[number]["reporter"];
                            const referenceId =
                              reporter === "variable"
                                ? workspace.variables?.[0]?.id
                                : reporter === "listLength" || reporter === "listItem"
                                  ? workspace.lists?.[0]?.id
                                  : reporter === "parameter" &&
                                      block.location.container.kind === "procedure"
                                    ? workspace.scripts[block.location.container.scriptIndex]
                                        ?.procedures?.[block.location.container.procedureIndex]
                                        ?.parameters?.[0]?.id
                                    : undefined;
                            onIntent({
                              type: "setProcedureArgumentSource",
                              location: block.location,
                              argumentIndex,
                              reporter,
                              ...(referenceId === undefined ? {} : { referenceId }),
                            });
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
                          {block.location.container.kind === "procedure" &&
                          (workspace.scripts[block.location.container.scriptIndex]?.procedures?.[
                            block.location.container.procedureIndex
                          ]?.parameters?.length ?? 0) > 0 ? (
                            <option value="parameter">{copy.customBlockParameter}</option>
                          ) : null}
                          <option value="xPosition">{copy.positionX}</option>
                          <option value="yPosition">{copy.positionY}</option>
                          <option value="add">{copy.operatorAdd}</option>
                          <option value="subtract">{copy.operatorSubtract}</option>
                          <option value="multiply">{copy.operatorMultiply}</option>
                          <option value="divide">{copy.operatorDivide}</option>
                          <option value="modulo">{copy.operatorModulo}</option>
                          <option value="random">{copy.operatorRandom}</option>
                          <option value="randomInteger">{copy.operatorRandomInteger}</option>
                          <option value="mathFunction">{copy.operatorMathFunction}</option>
                          {(workspace.lists?.length ?? 0) > 0 ? (
                            <option value="listItem">{copy.listItem}</option>
                          ) : null}
                          {argument !== undefined &&
                          ![
                            "literal_number",
                            "variables_value",
                            "parameter_value",
                            "lists_length",
                            "sensing_x_position",
                            "sensing_y_position",
                            ...CALL_ARGUMENT_COMPOUND.map((entry) => entry.type),
                          ].includes(argument.type) ? (
                            <option value="other">
                              {getBlockDefinition(argument.type)?.label ?? argument.type}
                            </option>
                          ) : null}
                        </select>
                        {argument?.type === "variables_value" ||
                        argument?.type === "lists_length" ||
                        argument?.type === "lists_item" ||
                        argument?.type === "parameter_value" ? (
                          <select
                            aria-label={`${copy.customBlockArguments}: ${parameter.name} ${copy.numericReference}`}
                            value={String(
                              argument.fields?.variableId ??
                                argument.fields?.listId ??
                                argument.fields?.parameterId ??
                                "",
                            )}
                            onChange={(event) =>
                              onIntent({
                                type: "setProcedureArgumentSource",
                                location: block.location,
                                argumentIndex,
                                reporter:
                                  argument.type === "variables_value"
                                    ? "variable"
                                    : argument.type === "lists_length"
                                      ? "listLength"
                                      : argument.type === "lists_item"
                                        ? "listItem"
                                        : "parameter",
                                referenceId: event.currentTarget.value,
                              })
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            {(argument.type === "variables_value"
                              ? (workspace.variables ?? [])
                              : argument.type === "lists_length" || argument.type === "lists_item"
                                ? (workspace.lists ?? [])
                                : block.location.container.kind === "procedure"
                                  ? (workspace.scripts[block.location.container.scriptIndex]
                                      ?.procedures?.[block.location.container.procedureIndex]
                                      ?.parameters ?? [])
                                  : []
                            ).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        ) : null}
                        {argument?.type === "operator_math_function" ? (
                          <select
                            aria-label={`${copy.customBlockArguments}: ${parameter.name} ${copy.mathFunction}`}
                            value={String(argument.fields?.function ?? "abs")}
                            onChange={(event) =>
                              onIntent({
                                type: "setProcedureArgumentMathFunction",
                                location: block.location,
                                argumentIndex,
                                function: event.currentTarget.value as
                                  "abs" | "round" | "floor" | "ceiling",
                              })
                            }
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <option value="abs">{copy.mathAbs}</option>
                            <option value="round">{copy.mathRound}</option>
                            <option value="floor">{copy.mathFloor}</option>
                            <option value="ceiling">{copy.mathCeiling}</option>
                          </select>
                        ) : null}
                        {argument !== undefined
                          ? (
                              CALL_ARGUMENT_COMPOUND.find((entry) => entry.type === argument.type)
                                ?.sides ?? []
                            ).map((nestedSide) => (
                              <NestedNumericSocket
                                key={nestedSide}
                                node={argument.inputs?.[nestedSide]}
                                side={nestedSide}
                                path={[]}
                                location={block.location}
                                input="value"
                                label={copy.customBlockArguments}
                                operandLabel={parameter.name}
                                rootSideLabel={
                                  nestedSide === "left"
                                    ? copy.conditionLeft
                                    : nestedSide === "right"
                                      ? copy.conditionRight
                                      : nestedSide === "min"
                                        ? copy.rangeMin
                                        : nestedSide === "max"
                                          ? copy.rangeMax
                                          : nestedSide === "index"
                                            ? copy.listIndex
                                            : copy.numericLiteral
                                }
                                copy={copy}
                                workspace={workspace}
                                actors={actors}
                                argumentIndex={argumentIndex}
                                onIntent={onIntent}
                              />
                            ))
                          : null}
                        {argument?.type === "literal_number" ? (
                          <input
                            type="number"
                            aria-label={`${copy.customBlockArguments}: ${parameter.name}`}
                            key={`${block.id}:${parameter.id}:${argument.fields?.value}`}
                            defaultValue={Number(argument.fields?.value ?? 0)}
                            onKeyDown={(event) => {
                              event.stopPropagation();
                              if (event.key === "Enter") event.currentTarget.blur();
                            }}
                            onBlur={(event) => {
                              const raw = event.currentTarget.value.trim();
                              const value = Number(raw);
                              if (
                                raw !== "" &&
                                Number.isFinite(value) &&
                                value !== argument.fields?.value
                              )
                                onIntent({
                                  type: "setProcedureArgument",
                                  location: block.location,
                                  argumentIndex,
                                  value,
                                });
                              event.currentTarget.value = String(argument.fields?.value ?? 0);
                            }}
                          />
                        ) : argument === undefined ||
                          ![
                            "variables_value",
                            "parameter_value",
                            "lists_length",
                            "sensing_x_position",
                            "sensing_y_position",
                          ].includes(argument.type) ? (
                          <span>
                            {argument === undefined
                              ? "?"
                              : (getBlockDefinition(argument.type)?.label ?? argument.type)}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}
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
            {onToggleBreakpoint === undefined ? null : (
              <button
                type="button"
                tabIndex={isTabbable ? 0 : -1}
                className="block-breakpoint"
                data-active={hasBreakpoint}
                aria-pressed={hasBreakpoint}
                aria-label={`${hasBreakpoint ? copy.removeBreakpoint : copy.setBreakpoint}: ${label}`}
                title={hasBreakpoint ? copy.removeBreakpoint : copy.setBreakpoint}
                onClick={() => onToggleBreakpoint(block.id)}
              >
                ●
              </button>
            )}
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
