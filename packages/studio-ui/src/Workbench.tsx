import { useEffect, useReducer, useRef, useState, type CSSProperties } from "react";
import { blockIdForNode, type BlockType, type BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import {
  LIST_MAX_ITEMS,
  NUMERIC_LITERAL_MIN,
  NUMERIC_LITERAL_MAX,
  type ProgramFinding,
} from "@agorix/program-model";
import {
  STUDIO_PROTOCOL_VERSION,
  studioStageKey,
  type ExecutionCommand,
  type ChangeRefusalReason,
  type HostMessage,
  type AmbientHintView,
  type MissionSpecView,
} from "@agorix/studio-protocol";
import type { HostBridge } from "./bridge.js";
import { AgentZone, Canvas, type FocusRequest, type SyncView } from "./Canvas.js";
import { locationKey, toRows } from "./blockView.js";
import { Palette } from "./Palette.js";
import { ProcedureNavigator, ProcedureTools } from "./ProcedureTools.js";
import { SceneLibrary, STAGE_BACKDROP_DRAG_TYPE, STAGE_COSTUME_DRAG_TYPE } from "./SceneLibrary.js";
import { densityAnnouncement } from "./density.js";
import { advanceDebugSession, type DebugSnapshot } from "./debugSession.js";
import { imageForAsset, imageForId } from "./visualArt.js";
import { AgentPanel } from "./AgentPanel.js";
import { copyFor, normalizeStudioUiLocale, type StudioUiLocale } from "./i18n.js";
import {
  canvasHints,
  fullSelection,
  initialAgentUi,
  reduceAgentUi,
  type SelectionState,
} from "./agentUi.js";
import type { StudioUiCopy } from "./i18n.js";

function refusalText(reason: ChangeRefusalReason | undefined, copy: StudioUiCopy): string {
  if (reason === "NOT_A_CONTAINER") return copy.statusNotContainer;
  if (reason === "BAD_INDEX") return copy.statusBadIndex;
  if (reason === "BLOCK_NOT_FOUND") return copy.statusBlockNotFound;
  if (reason === "NOT_A_STATEMENT") return copy.statusNotStatement;
  return copy.statusWouldBreakProgram;
}

export function statusFor(
  message: HostMessage,
  copy: StudioUiCopy = copyFor("en"),
): string | undefined {
  if (message.type === "error") {
    if (message.code === "INVALID_CHANGE") {
      return `${refusalText(message.reason, copy)} ${copy.statusNothingChanged}`;
    }
    if (message.code === "STALE_EDIT") {
      return copy.statusProgramChanged;
    }
    return copy.statusProgramUnavailable;
  }
  if (message.type === "agentUnavailable") {
    return copy.statusAgentUnavailable;
  }
  return undefined;
}

export type WorkbenchDensity = "comfortable" | "compact";

type ExecutionState = Extract<HostMessage, { type: "executionState" }>;
type StageFrameMessage = Extract<HostMessage, { type: "stageFrame" }>;
type ActorsMessage = Extract<HostMessage, { type: "actors" }>;
type AssetsMessage = Extract<HostMessage, { type: "assets" }>;
type ValidationMessage = Extract<HostMessage, { type: "validation" }>;

export function MissionSpecPanel({
  copy,
  spec,
  onSave,
}: {
  readonly copy: StudioUiCopy;
  readonly spec: MissionSpecView | undefined;
  readonly onSave: (spec: Omit<MissionSpecView, "hash">) => void;
}) {
  const [draft, setDraft] = useState<Omit<MissionSpecView, "hash"> | undefined>(
    spec === undefined
      ? undefined
      : {
          goal: spec.goal,
          successCheck: spec.successCheck,
          ...(spec.predictionPrompt === undefined
            ? {}
            : { predictionPrompt: spec.predictionPrompt }),
        },
  );
  useEffect(() => {
    if (spec !== undefined) {
      setDraft({
        goal: spec.goal,
        successCheck: spec.successCheck,
        ...(spec.predictionPrompt === undefined ? {} : { predictionPrompt: spec.predictionPrompt }),
      });
    }
  }, [spec?.hash]);
  if (spec === undefined || draft === undefined) return null;
  return (
    <section className="mission-spec" aria-label={copy.missionSpec}>
      <header>
        <strong>{copy.missionSpec}</strong>
        <code title={copy.missionSpecHash}>{spec.hash}</code>
      </header>
      <label>
        {copy.missionSpecGoal}
        <input
          maxLength={140}
          value={draft.goal}
          onChange={(event) => setDraft({ ...draft, goal: event.currentTarget.value })}
        />
      </label>
      <div className="mission-spec-grid">
        <label>
          {copy.missionSpecSuccessCheck}
          <select
            value={draft.successCheck}
            onChange={(event) =>
              setDraft({
                ...draft,
                successCheck: event.currentTarget.value as MissionSpecView["successCheck"],
              })
            }
          >
            <option value="touches-goal">{copy.missionSpecTouchesGoal}</option>
            <option value="touches-goal-after-turn">{copy.missionSpecTouchesGoalAfterTurn}</option>
          </select>
        </label>
        <label>
          {copy.missionSpecPredictionPrompt}
          <input
            maxLength={160}
            value={draft.predictionPrompt ?? ""}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (value === "") {
                setDraft({ goal: draft.goal, successCheck: draft.successCheck });
                return;
              }
              setDraft({
                ...draft,
                predictionPrompt: value,
              });
            }}
          />
        </label>
      </div>
      <button type="button" onClick={() => onSave(draft)}>
        {copy.missionSpecSave}
      </button>
    </section>
  );
}

function stagePercent(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return "0%";
  return `${Math.max(-20, Math.min(120, (value / max) * 100))}%`;
}

export function stageDropPosition(
  clientX: number,
  clientY: number,
  bounds: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
  },
  viewport: { readonly width: number; readonly height: number },
): { x: number; y: number } | undefined {
  if (
    ![
      clientX,
      clientY,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height,
      viewport.width,
      viewport.height,
    ].every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    return undefined;
  return {
    x: Math.round(
      Math.max(
        0,
        Math.min(viewport.width, ((clientX - bounds.left) / bounds.width) * viewport.width),
      ),
    ),
    y: Math.round(
      Math.max(
        0,
        Math.min(
          viewport.height,
          ((bounds.top + bounds.height - clientY) / bounds.height) * viewport.height,
        ),
      ),
    ),
  };
}

export function stageNudgePosition(
  actor: { readonly x: number; readonly y: number },
  viewport: { readonly width: number; readonly height: number },
  key: string,
  step: number,
): { x: number; y: number } | undefined {
  if (
    ![actor.x, actor.y, viewport.width, viewport.height, step].every(Number.isFinite) ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    step <= 0
  )
    return undefined;
  const delta =
    key === "ArrowLeft"
      ? { x: -step, y: 0 }
      : key === "ArrowRight"
        ? { x: step, y: 0 }
        : key === "ArrowUp"
          ? { x: 0, y: step }
          : key === "ArrowDown"
            ? { x: 0, y: -step }
            : undefined;
  if (delta === undefined) return undefined;
  return {
    x: Math.max(0, Math.min(viewport.width, actor.x + delta.x)),
    y: Math.max(0, Math.min(viewport.height, actor.y + delta.y)),
  };
}

export function stagePointerDragPosition(
  actor: { readonly x: number; readonly y: number },
  start: { readonly x: number; readonly y: number },
  current: { readonly x: number; readonly y: number },
  bounds: { readonly width: number; readonly height: number },
  viewport: { readonly width: number; readonly height: number },
): { x: number; y: number } | undefined {
  if (
    ![
      actor.x,
      actor.y,
      start.x,
      start.y,
      current.x,
      current.y,
      bounds.width,
      bounds.height,
      viewport.width,
      viewport.height,
    ].every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    return undefined;
  return {
    x: Math.round(
      Math.max(
        0,
        Math.min(viewport.width, actor.x + ((current.x - start.x) * viewport.width) / bounds.width),
      ),
    ),
    y: Math.round(
      Math.max(
        0,
        Math.min(
          viewport.height,
          actor.y - ((current.y - start.y) * viewport.height) / bounds.height,
        ),
      ),
    ),
  };
}

function ExecutionToolbar({
  copy,
  disabled,
  playing,
  state,
  onCommand,
}: {
  readonly copy: StudioUiCopy;
  readonly disabled: boolean;
  readonly playing: boolean;
  readonly state: ExecutionState | undefined;
  readonly onCommand: (command: ExecutionCommand) => void;
}) {
  const status = state?.status ?? "idle";
  const frameText =
    state === undefined
      ? copy.executionNoFrames
      : `${copy.executionFrame} ${Math.min(state.frameIndex + 1, state.frameCount)} ${copy.of} ${state.frameCount} · ${state.stepsUsed} ${copy.steps}`;
  return (
    <section className="execution-toolbar" aria-label={copy.execution}>
      <div className="execution-actions" role="toolbar" aria-label={copy.execution}>
        <button
          type="button"
          onClick={() => onCommand("run")}
          disabled={disabled || playing || status === "completed"}
        >
          {copy.executionRun}
        </button>
        <button
          type="button"
          onClick={() => onCommand("step")}
          disabled={disabled || status === "completed"}
        >
          {copy.executionStep}
        </button>
        <button
          type="button"
          onClick={() => onCommand("stop")}
          disabled={disabled || (!playing && status !== "running")}
        >
          {copy.executionPause}
        </button>
        <button
          type="button"
          onClick={() => onCommand("reset")}
          disabled={disabled || status === "idle"}
        >
          {copy.executionReset}
        </button>
      </div>
      <div className="execution-readout" aria-live="polite">
        {copy.executionStatus}: {status} · {frameText}
      </div>
    </section>
  );
}

export function EventTracePanel({
  copy,
  state,
  selectedActorId,
}: {
  readonly copy: StudioUiCopy;
  readonly state: ExecutionState | undefined;
  readonly selectedActorId?: string | undefined;
}) {
  const [actorFilter, setActorFilter] = useState("__selected");
  const [scriptFilter, setScriptFilter] = useState("");
  const trace = state?.eventTrace ?? [];
  const actorOptions = Array.from(new Set(trace.map((item) => item.actorId))).sort();
  const scriptOptions = Array.from(
    new Set(
      trace
        .filter((item) => {
          if (actorFilter === "") return true;
          if (actorFilter === "__selected")
            return selectedActorId === undefined || item.actorId === selectedActorId;
          return item.actorId === actorFilter;
        })
        .map((item) => item.scriptId),
    ),
  ).sort();
  const filteredTrace = trace.filter((item) => {
    const actorMatches =
      actorFilter === "" ||
      (actorFilter === "__selected"
        ? selectedActorId === undefined || item.actorId === selectedActorId
        : item.actorId === actorFilter);
    const scriptMatches = scriptFilter === "" || item.scriptId === scriptFilter;
    return actorMatches && scriptMatches;
  });
  return (
    <section className="event-trace" aria-label={copy.eventTrace}>
      <header>
        <strong>{copy.eventTrace}</strong>
        <span>
          {filteredTrace.length}/{trace.length}
        </span>
      </header>
      {trace.length === 0 ? null : (
        <div className="event-trace-filters">
          <label>
            {copy.eventTraceActorFilter}
            <select
              value={actorFilter}
              onChange={(event) => {
                setActorFilter(event.currentTarget.value);
                setScriptFilter("");
              }}
            >
              <option value="">{copy.eventTraceAll}</option>
              <option value="__selected">{copy.eventTraceSelectedActor}</option>
              {actorOptions.map((actorId) => (
                <option key={actorId} value={actorId}>
                  {actorId}
                </option>
              ))}
            </select>
          </label>
          <label>
            {copy.eventTraceScriptFilter}
            <select
              value={scriptFilter}
              onChange={(event) => setScriptFilter(event.currentTarget.value)}
            >
              <option value="">{copy.eventTraceAll}</option>
              {scriptOptions.map((scriptId) => (
                <option key={scriptId} value={scriptId}>
                  {scriptId}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {trace.length === 0 ? (
        <p>{copy.eventTraceEmpty}</p>
      ) : (
        <ol>
          {filteredTrace.map((item) => (
            <li key={item.id}>
              <span className="event-step">#{item.step}</span>
              <strong>{item.event}</strong>
              <code>{item.actorId}</code>
              <code>{item.scriptId}</code>
              <small>
                {copy.eventTraceReason}: {item.reason}
              </small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function ProgramFindingsPanel({
  copy,
  findings,
  onInspect,
  onAskOri,
}: {
  readonly copy: StudioUiCopy;
  readonly findings: readonly ProgramFinding[];
  readonly onInspect: (nodeId: string) => void;
  readonly onAskOri: () => void;
}) {
  if (findings.length === 0) return null;
  return (
    <section className="studio-findings" aria-label={copy.findingsTitle}>
      <header>
        <h3>{copy.findingsTitle}</h3>
        <span>{findings.length}</span>
      </header>
      <p>{copy.findingsIntro}</p>
      <ul>
        {findings.map((finding) => (
          <li key={`${finding.kind}:${finding.nodeId}`}>
            <span aria-hidden="true">◇</span>
            <strong>
              {finding.kind === "loop-never-exits"
                ? copy.findingNeverExits
                : finding.kind === "loop-without-wait"
                  ? copy.findingWithoutWait
                  : finding.kind === "shared-variable"
                    ? copy.findingSharedVariable
                    : finding.kind === "shared-list"
                      ? copy.findingSharedList
                      : finding.kind === "shared-position"
                        ? copy.findingSharedPosition
                        : copy.findingPerformance}
            </strong>
            <button type="button" onClick={() => onInspect(finding.nodeId)}>
              {finding.nodeId.includes("/procedures[") ? copy.findingOpenCode : copy.findingInspect}
            </button>
            {finding.relatedNodeId !== undefined && (
              <button type="button" onClick={() => onInspect(finding.relatedNodeId!)}>
                {copy.findingInspectOther}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="studio-findings-ori" onClick={onAskOri}>
        {copy.findingAskOri}
      </button>
    </section>
  );
}

export function VisualDebuggerPanel({
  copy,
  variables,
  selectedVariableId,
  onSelectVariable,
  pauseOnChange,
  onPauseOnChange,
  snapshot,
}: {
  readonly copy: StudioUiCopy;
  readonly variables: readonly { readonly id: string; readonly name: string }[];
  readonly selectedVariableId: string;
  readonly onSelectVariable: (id: string) => void;
  readonly pauseOnChange: boolean;
  readonly onPauseOnChange: (value: boolean) => void;
  readonly snapshot: DebugSnapshot | undefined;
}) {
  const history = snapshot?.history[selectedVariableId] ?? [];
  return (
    <section className="studio-debugger" aria-label={copy.debuggerTitle}>
      <h3>{copy.debuggerTitle}</h3>
      <label>
        {copy.watchVariable}
        <select
          value={selectedVariableId}
          onChange={(event) => onSelectVariable(event.currentTarget.value)}
        >
          <option value="">{copy.watchNone}</option>
          {variables.map((variable) => (
            <option key={variable.id} value={variable.id}>
              {variable.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={pauseOnChange}
          disabled={selectedVariableId === ""}
          onChange={(event) => onPauseOnChange(event.currentTarget.checked)}
        />
        {copy.pauseOnChange}
      </label>
      {history.length === 0 ? (
        <p>{copy.debugNoHistory}</p>
      ) : (
        <ol aria-label={copy.watchVariable}>
          {history.map((point) => (
            <li key={point.frameIndex}>
              #{point.step}: {point.value}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function StagePanel({
  copy,
  frame,
  assets = [],
  listNames = {},
  selectedActorId,
  onSelectActor,
  onPlaceActor,
  onTransformActor,
  onCostume,
  onBackdrop,
  onBrowseCharacters,
  showBackdropPicker = false,
  editingDisabled = false,
  onStageEvent,
}: {
  readonly copy: StudioUiCopy;
  readonly frame: StageFrameMessage["frame"] | undefined;
  readonly assets?: readonly AssetsMessage["assets"][number][];
  readonly listNames?: Readonly<Record<string, string>>;
  readonly selectedActorId: string | undefined;
  readonly onSelectActor?: (actorId: string) => void;
  readonly onPlaceActor?: (actorId: string, position: { x: number; y: number }) => void;
  readonly onTransformActor?: (
    actorId: string,
    patch: { direction?: number; size?: number },
  ) => void;
  readonly onCostume?: (actorId: string, costumeId: string) => void;
  readonly onBackdrop?: (backdropId: string) => void;
  readonly onBrowseCharacters?: () => void;
  readonly showBackdropPicker?: boolean;
  readonly editingDisabled?: boolean;
  readonly onStageEvent?: (
    event: { event: "keyPressed"; key: string } | { event: "actorClicked"; actorId: string },
  ) => void;
}) {
  const state = frame?.state;
  const pointerDrag = useRef<{
    actorId: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
  }>();
  const viewportRef = useRef<HTMLDivElement>(null);
  const backdropPickerRef = useRef<HTMLDetailsElement>(null);
  const suppressActorClick = useRef(false);
  const [dragPreview, setDragPreview] = useState<{ actorId: string; x: number; y: number }>();
  const [transformDraft, setTransformDraft] = useState<{
    actorId: string;
    direction: number;
    size: number;
  }>();
  useEffect(() => setTransformDraft(undefined), [selectedActorId, frame?.running]);
  const dragPosition = (actorId: string, clientX: number, clientY: number) => {
    const drag = pointerDrag.current;
    if (drag?.actorId !== actorId || state === undefined) return undefined;
    const bounds = viewportRef.current?.getBoundingClientRect();
    if (!bounds) return undefined;
    return stagePointerDragPosition(
      { x: drag.x, y: drag.y },
      { x: drag.startX, y: drag.startY },
      { x: clientX, y: clientY },
      bounds,
      state.viewport,
    );
  };
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.name]));
  const backdropImage = imageForId(state?.backdropId, assets);
  const backdrops = assets.filter((asset) => asset.kind === "backdrop");
  const visibleVariables = (state?.variables ?? []).filter((variable) => variable.visible);
  const visibleLists = (state?.lists ?? []).filter((list) => list.visible);
  const activeSoundIds = state?.sounds?.activeSoundIds ?? [];
  const stageActors =
    state === undefined
      ? []
      : (state.actors ?? [
          {
            id: "actor:main",
            name: copy.stageSprite,
            x: state.sprite.x,
            y: state.sprite.y,
            direction: state.sprite.heading,
            size: Math.round(state.sprite.radius * 10),
            visible: true,
          },
        ]);
  const goalStyle =
    state === undefined
      ? undefined
      : {
          left: stagePercent(state.goal.x, state.viewport.width),
          bottom: stagePercent(state.goal.y, state.viewport.height),
        };
  return (
    <section className="stage-panel" aria-label={copy.stage} data-empty={state === undefined}>
      <header className="stage-panel-header">
        <strong>{copy.stage}</strong>
        {onStageEvent === undefined ? null : <small>{copy.stageKeyboardHint}</small>}
        <div aria-live="polite">
          <span>
            {frame === undefined
              ? copy.stageNoFrame
              : `${copy.executionFrame} ${frame.frameIndex + 1} ${copy.of} ${frame.frameCount} · ${copy.stageNode}: ${frame.highlightedNodeId ?? "$"}`}
          </span>
          {frame?.actorId === undefined && frame?.scriptId === undefined ? null : (
            <small className="stage-active-route">
              {[frame.actorId, frame.scriptId, frame.statementType]
                .filter((item): item is string => item !== undefined)
                .join(" · ")}
            </small>
          )}
        </div>
      </header>
      {showBackdropPicker && onBackdrop !== undefined && state !== undefined ? (
        <div className="stage-scene-actions">
          <details ref={backdropPickerRef} className="stage-backdrop-picker">
            <summary
              aria-label={`${copy.sceneSelectBackdrop}: ${assetNames.get(state.backdropId ?? "") ?? copy.actorNoCostume}`}
            >
              {backdropImage === undefined ? (
                <span className="stage-backdrop-preview" aria-hidden="true" />
              ) : (
                <img className="stage-backdrop-preview" src={backdropImage} alt="" />
              )}
              <span>
                {copy.sceneBackdrops}:{" "}
                <strong>{assetNames.get(state.backdropId ?? "") ?? copy.actorNoCostume}</strong>
              </span>
            </summary>
            <div className="stage-backdrop-options" role="group" aria-label={copy.sceneBackdrops}>
              {backdrops.map((asset) => {
                const image = imageForAsset(asset);
                return (
                  <button
                    key={asset.id}
                    type="button"
                    aria-label={`${copy.sceneSelectBackdrop}: ${asset.name}`}
                    aria-pressed={asset.id === state.backdropId}
                    disabled={editingDisabled}
                    onClick={() => {
                      onBackdrop(asset.id);
                      if (backdropPickerRef.current) backdropPickerRef.current.open = false;
                    }}
                  >
                    {image === undefined ? (
                      <span className="stage-backdrop-thumb" aria-hidden="true" />
                    ) : (
                      <img src={image} alt="" />
                    )}
                    <span>{asset.name}</span>
                  </button>
                );
              })}
            </div>
          </details>
          {onBrowseCharacters === undefined ? null : (
            <button
              type="button"
              className="stage-add-character"
              disabled={editingDisabled}
              onClick={onBrowseCharacters}
            >
              {copy.sceneCreateActorFromCostume}
            </button>
          )}
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className="stage-viewport"
        role="group"
        data-running={frame?.running ? "true" : "false"}
        tabIndex={onStageEvent === undefined || state === undefined ? undefined : 0}
        aria-label={`${copy.stage}: ${copy.stageKeyboardHint}`}
        onKeyDown={(event) => {
          if (
            event.target !== event.currentTarget ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            onStageEvent === undefined ||
            state === undefined
          )
            return;
          const key = studioStageKey(event.key);
          if (key === undefined) return;
          event.preventDefault();
          onStageEvent({ event: "keyPressed", key });
        }}
        onDragOver={(event) => {
          if (
            !frame?.running &&
            (onPlaceActor !== undefined || onCostume !== undefined || onBackdrop !== undefined)
          )
            event.preventDefault();
        }}
        onDrop={(event) => {
          if (state === undefined || frame?.running) return;
          const backdropId = event.dataTransfer.getData(STAGE_BACKDROP_DRAG_TYPE);
          if (
            backdropId !== "" &&
            onBackdrop !== undefined &&
            assets.some((asset) => asset.kind === "backdrop" && asset.id === backdropId)
          ) {
            event.preventDefault();
            onBackdrop(backdropId);
            return;
          }
          const costumeId = event.dataTransfer.getData(STAGE_COSTUME_DRAG_TYPE);
          if (
            costumeId !== "" &&
            selectedActorId !== undefined &&
            onCostume !== undefined &&
            stageActors.some((actor) => actor.id === selectedActorId) &&
            assets.some((asset) => asset.kind === "costume" && asset.id === costumeId)
          ) {
            event.preventDefault();
            onCostume(selectedActorId, costumeId);
            return;
          }
          if (onPlaceActor === undefined) return;
          event.preventDefault();
          const actorId = event.dataTransfer.getData("application/x-agorix-stage-actor");
          if (!stageActors.some((actor) => actor.id === actorId)) return;
          const position = stageDropPosition(
            event.clientX,
            event.clientY,
            event.currentTarget.getBoundingClientRect(),
            state.viewport,
          );
          if (position !== undefined) onPlaceActor(actorId, position);
        }}
      >
        {state === undefined ? (
          <p>{copy.stageNoFrame}</p>
        ) : (
          <>
            <div
              className="stage-backdrop"
              data-backdrop-id={state.backdropId ?? "default"}
              aria-hidden="true"
            />
            {backdropImage === undefined ? null : (
              <img className="stage-art-backdrop" src={backdropImage} alt="" aria-hidden="true" />
            )}
            <div className="stage-grid" aria-hidden="true" />
            <div
              className={frame?.reachedGoal ? "stage-goal reached" : "stage-goal"}
              style={goalStyle}
              role="img"
              aria-label={copy.stageGoal}
            />
            {stageActors
              .filter((actor) => actor.visible)
              .map((actor) => {
                const position = dragPreview?.actorId === actor.id ? dragPreview : actor;
                const appearance = transformDraft?.actorId === actor.id ? transformDraft : actor;
                const size = Math.max(28, Math.min(110, Math.round((appearance.size / 100) * 48)));
                const costumeImage = imageForId(actor.costumeId ?? "asset:costume.default", assets);
                return (
                  <button
                    key={actor.id}
                    type="button"
                    className={
                      actor.id === selectedActorId ? "stage-sprite selected" : "stage-sprite"
                    }
                    draggable={!frame?.running && onPlaceActor !== undefined}
                    onClick={() => {
                      if (suppressActorClick.current) {
                        suppressActorClick.current = false;
                        return;
                      }
                      onSelectActor?.(actor.id);
                      if (state !== undefined)
                        onStageEvent?.({ event: "actorClicked", actorId: actor.id });
                    }}
                    onDragStart={(event) => {
                      if (pointerDrag.current?.actorId === actor.id) {
                        event.preventDefault();
                        return;
                      }
                      if (frame?.running || onPlaceActor === undefined) return;
                      onSelectActor?.(actor.id);
                      event.dataTransfer.setData("application/x-agorix-stage-actor", actor.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onPointerDown={(event) => {
                      suppressActorClick.current = false;
                      if (frame?.running || onPlaceActor === undefined || event.button !== 0)
                        return;
                      pointerDrag.current = {
                        actorId: actor.id,
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                        x: actor.x,
                        y: actor.y,
                      };
                      event.currentTarget.setPointerCapture(event.pointerId);
                      onSelectActor?.(actor.id);
                    }}
                    onPointerMove={(event) => {
                      if (frame?.running) return;
                      if (pointerDrag.current?.pointerId !== event.pointerId) return;
                      const next = dragPosition(actor.id, event.clientX, event.clientY);
                      if (next) setDragPreview({ actorId: actor.id, ...next });
                    }}
                    onPointerUp={(event) => {
                      const drag = pointerDrag.current;
                      if (drag?.actorId !== actor.id || drag.pointerId !== event.pointerId) return;
                      const next = dragPosition(actor.id, event.clientX, event.clientY);
                      pointerDrag.current = undefined;
                      setDragPreview(undefined);
                      if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      if (!frame?.running && next && (next.x !== drag.x || next.y !== drag.y)) {
                        suppressActorClick.current = true;
                        onPlaceActor?.(actor.id, next);
                      }
                    }}
                    onPointerCancel={(event) => {
                      if (pointerDrag.current?.pointerId !== event.pointerId) return;
                      pointerDrag.current = undefined;
                      setDragPreview(undefined);
                    }}
                    aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown"
                    title={copy.stageActorKeyboardHint}
                    onKeyDown={(event) => {
                      if (
                        !event.altKey ||
                        event.ctrlKey ||
                        event.metaKey ||
                        frame?.running ||
                        onPlaceActor === undefined
                      )
                        return;
                      const position = stageNudgePosition(
                        actor,
                        state.viewport,
                        event.key,
                        event.shiftKey ? 10 : 1,
                      );
                      if (position === undefined) return;
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectActor?.(actor.id);
                      if (position.x !== actor.x || position.y !== actor.y)
                        onPlaceActor(actor.id, position);
                    }}
                    onDragOver={(event) => {
                      if (!frame?.running && onCostume !== undefined) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      if (frame?.running || onCostume === undefined) return;
                      const costumeId = event.dataTransfer.getData(STAGE_COSTUME_DRAG_TYPE);
                      if (
                        !assets.some((asset) => asset.kind === "costume" && asset.id === costumeId)
                      )
                        return;
                      event.preventDefault();
                      event.stopPropagation();
                      onSelectActor?.(actor.id);
                      onCostume(actor.id, costumeId);
                    }}
                    data-costume-id={actor.costumeId ?? "default"}
                    data-dragging={dragPreview?.actorId === actor.id}
                    style={{
                      left: stagePercent(position.x, state.viewport.width),
                      bottom: stagePercent(position.y, state.viewport.height),
                      width: `${size}px`,
                      height: `${size}px`,
                      transform: `translate(-50%, 50%) rotate(${-appearance.direction}deg)`,
                    }}
                    aria-label={`${copy.stageSprite} ${actor.name}: x ${actor.x}, y ${actor.y}, ${copy.actorDirection} ${actor.direction}${actor.costumeId === undefined ? "" : `, ${copy.actorCostume} ${assetNames.get(actor.costumeId) ?? actor.costumeId}`}`}
                  >
                    {costumeImage === undefined ? null : (
                      <img
                        className="stage-art-sprite"
                        src={costumeImage}
                        alt=""
                        aria-hidden="true"
                      />
                    )}
                    {actor.bubble === undefined ? null : (
                      <span className={`stage-bubble stage-bubble-${actor.bubble.kind}`}>
                        {actor.bubble.text}
                      </span>
                    )}
                  </button>
                );
              })}
            {(() => {
              const actor = stageActors.find(
                (candidate) => candidate.id === selectedActorId && candidate.visible,
              );
              if (actor === undefined || frame?.running || onTransformActor === undefined)
                return null;
              const rotate = (delta: number) =>
                onTransformActor(actor.id, {
                  direction: (((actor.direction + delta) % 360) + 360) % 360,
                });
              const resize = (delta: number) =>
                onTransformActor(actor.id, {
                  size: Math.max(1, Math.min(400, actor.size + delta)),
                });
              const preview = transformDraft?.actorId === actor.id ? transformDraft : actor;
              const commitTransform = (kind: "direction" | "size", value: number) => {
                if (
                  transformDraft?.actorId !== actor.id ||
                  !Number.isInteger(value) ||
                  frame?.running
                )
                  return;
                setTransformDraft(undefined);
                if (value !== actor[kind]) onTransformActor(actor.id, { [kind]: value });
              };
              const slider = (kind: "direction" | "size") => (
                <label className="stage-transform-slider">
                  <span>
                    {kind === "direction" ? copy.actorDirection : copy.actorSize}: {preview[kind]}
                    {kind === "direction" ? "°" : "%"}
                  </span>
                  <input
                    type="range"
                    min={kind === "direction" ? 0 : 1}
                    max={kind === "direction" ? 359 : 400}
                    step={1}
                    aria-label={`${kind === "direction" ? copy.actorDirection : copy.actorSize}: ${actor.name}`}
                    value={preview[kind]}
                    onInput={(event) =>
                      setTransformDraft({
                        actorId: actor.id,
                        direction:
                          kind === "direction"
                            ? Number(event.currentTarget.value)
                            : preview.direction,
                        size: kind === "size" ? Number(event.currentTarget.value) : preview.size,
                      })
                    }
                    onPointerUp={(event) =>
                      commitTransform(kind, Number(event.currentTarget.value))
                    }
                    onPointerCancel={() => setTransformDraft(undefined)}
                    onKeyUp={(event) => commitTransform(kind, Number(event.currentTarget.value))}
                    onBlur={(event) => commitTransform(kind, Number(event.currentTarget.value))}
                  />
                </label>
              );
              return (
                <div
                  className="stage-actor-tools"
                  style={{
                    left: `clamp(95px, ${stagePercent(actor.x, state.viewport.width)}, calc(100% - 95px))`,
                    bottom: `clamp(8px, ${stagePercent(actor.y, state.viewport.height)}, calc(100% - 110px))`,
                  }}
                  role="group"
                  aria-label={`${actor.name}: ${copy.actorDirection}, ${copy.actorSize}`}
                >
                  <button
                    type="button"
                    aria-label={`${copy.stageRotateLeft}: ${actor.name}`}
                    onClick={() => rotate(-15)}
                  >
                    ↶
                  </button>
                  <button
                    type="button"
                    aria-label={`${copy.stageRotateRight}: ${actor.name}`}
                    onClick={() => rotate(15)}
                  >
                    ↷
                  </button>
                  <button
                    type="button"
                    aria-label={`${copy.stageSizeSmaller}: ${actor.name}`}
                    onClick={() => resize(-10)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label={`${copy.stageSizeLarger}: ${actor.name}`}
                    onClick={() => resize(10)}
                  >
                    +
                  </button>
                  {slider("direction")}
                  {slider("size")}
                </div>
              );
            })()}
            {visibleVariables.length === 0 && visibleLists.length === 0 ? null : (
              <div className="stage-watchers" aria-label={copy.stageWatchers}>
                {visibleVariables.map((variable) => (
                  <div key={variable.id} className="stage-watcher" data-variable-id={variable.id}>
                    <span>{variable.label}</span>
                    <strong>{variable.value}</strong>
                  </div>
                ))}
                {visibleLists.map((list) => (
                  <div key={list.id} className="stage-list-watcher" data-list-id={list.id}>
                    <strong>
                      {listNames[list.id] ?? list.label} · {list.items.length}
                    </strong>
                    {list.items.length === 0 ? (
                      <span>{copy.stageEmptyList}</span>
                    ) : (
                      <ol>
                        {list.items.map((item, index) => (
                          <li key={index}>{item}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
            {activeSoundIds.length === 0 ? null : (
              <div className="stage-sounds" aria-label={copy.activeSounds}>
                <span>{copy.activeSounds}</span>
                {activeSoundIds.map((soundId) => (
                  <strong key={soundId}>{assetNames.get(soundId) ?? soundId}</strong>
                ))}
                {state?.sounds?.volume === undefined ? null : <span>{state.sounds.volume}%</span>}
              </div>
            )}
          </>
        )}
      </div>
      {state === undefined ? null : (
        <dl className="stage-readout">
          <div>
            <dt>x</dt>
            <dd>{state.sprite.x.toFixed(1)}</dd>
          </div>
          <div>
            <dt>y</dt>
            <dd>{state.sprite.y.toFixed(1)}</dd>
          </div>
          <div>
            <dt>{copy.heading}</dt>
            <dd>{state.sprite.heading.toFixed(0)}</dd>
          </div>
          <div>
            <dt>{copy.actors}</dt>
            <dd>{stageActors.length}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function ActorTree({
  copy,
  actors,
  selectedActorId,
  onSelect,
}: {
  readonly copy: StudioUiCopy;
  readonly actors: readonly ActorsMessage["actors"][number][];
  readonly selectedActorId: string | undefined;
  readonly onSelect: (actorId: string) => void;
}) {
  if (actors.length === 0) return null;
  return (
    <section className="actor-tree" aria-label={copy.actors}>
      <header>
        <strong>{copy.actors}</strong>
        <span>{actors.length}</span>
      </header>
      <div className="actor-tree-list" role="listbox" aria-label={copy.selectActor}>
        {actors.map((actor) => (
          <button
            key={actor.id}
            type="button"
            className={actor.id === selectedActorId ? "selected" : ""}
            aria-selected={actor.id === selectedActorId}
            role="option"
            onClick={() => onSelect(actor.id)}
          >
            <span>
              <strong>{actor.name}</strong>
              <small>{actor.id}</small>
            </span>
            <span>
              {actor.visible ? copy.actorShown : copy.actorHidden} · {actor.scriptCount ?? 0}{" "}
              {copy.actorScripts}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function ActorInspector({
  copy,
  actors,
  assets,
  selectedActorId,
  onPatch,
}: {
  readonly copy: StudioUiCopy;
  readonly actors: readonly ActorsMessage["actors"][number][];
  readonly assets: readonly AssetsMessage["assets"][number][];
  readonly selectedActorId: string | undefined;
  readonly onPatch: (
    actorId: string,
    patch: Record<string, string | number | boolean | undefined>,
  ) => void;
}) {
  const actor = actors.find((candidate) => candidate.id === selectedActorId) ?? actors[0];
  if (actor === undefined) return null;
  const costumes = assets.filter((asset) => asset.kind === "costume");
  const selectedCostume = costumes.find((asset) => asset.id === actor.costumeId);
  const selectedImage = imageForId(actor.costumeId, assets);
  const numberPatch = (field: "x" | "y" | "direction" | "size") => (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onPatch(actor.id, { [field]: parsed });
  };
  return (
    <section className="actor-inspector" aria-label={copy.actorInspector}>
      <header>
        <strong>{actor.name}</strong>
        <span>
          {actor.scriptCount ?? 0} {copy.actorScripts}
        </span>
      </header>
      <details className="actor-costume-picker">
        <summary aria-label={`${copy.sceneSelectCostume}: ${actor.name}`}>
          <span className="actor-costume-preview" aria-hidden="true">
            {selectedImage === undefined ? (
              actor.name.slice(0, 1)
            ) : (
              <img src={selectedImage} alt="" />
            )}
          </span>
          <span>
            <small>{copy.actorCostume}</small>
            <strong>{selectedCostume?.name ?? copy.actorNoCostume}</strong>
          </span>
        </summary>
        <div className="actor-costume-grid" role="group" aria-label={copy.sceneCostumes}>
          {costumes.map((asset) => {
            const image = imageForAsset(asset);
            return (
              <button
                key={asset.id}
                type="button"
                aria-label={`${copy.sceneSelectCostume}: ${asset.name}`}
                aria-pressed={asset.id === actor.costumeId}
                onClick={() => onPatch(actor.id, { costumeId: asset.id })}
              >
                {image === undefined ? (
                  <span aria-hidden="true">{asset.name.slice(0, 1)}</span>
                ) : (
                  <img src={image} alt="" />
                )}
                <span>{asset.name}</span>
              </button>
            );
          })}
        </div>
      </details>
      <details className="actor-properties">
        <summary>{copy.actorProperties}</summary>
        <div className="actor-properties-fields">
          <label>
            {copy.actorName}
            <input
              value={actor.name}
              onChange={(event) => onPatch(actor.id, { name: event.currentTarget.value })}
            />
          </label>
          <div className="actor-grid">
            <label>
              x
              <input
                type="number"
                value={actor.x}
                onChange={(event) => numberPatch("x")(event.currentTarget.value)}
              />
            </label>
            <label>
              y
              <input
                type="number"
                value={actor.y}
                onChange={(event) => numberPatch("y")(event.currentTarget.value)}
              />
            </label>
            <label>
              {copy.actorDirection}
              <input
                type="number"
                value={actor.direction}
                onChange={(event) => numberPatch("direction")(event.currentTarget.value)}
              />
            </label>
            <label>
              {copy.actorSize}
              <input
                type="number"
                min="1"
                value={actor.size}
                onChange={(event) => numberPatch("size")(event.currentTarget.value)}
              />
            </label>
          </div>
          <label className="actor-visible">
            <input
              type="checkbox"
              checked={actor.visible}
              onChange={(event) => onPatch(actor.id, { visible: event.currentTarget.checked })}
            />
            {copy.actorVisible}
          </label>
          <p className="actor-ref">{actor.id}</p>
        </div>
      </details>
    </section>
  );
}

export function AssetPanel({
  copy,
  assets,
}: {
  readonly copy: StudioUiCopy;
  readonly assets: readonly AssetsMessage["assets"][number][];
}) {
  const [kindFilter, setKindFilter] = useState("");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredAssets = assets.filter((asset) => {
    const kindMatches = kindFilter === "" || asset.kind === kindFilter;
    const queryMatches =
      normalizedQuery === "" ||
      [asset.name, asset.id, asset.kind, asset.preview ?? "", ...asset.tags]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return kindMatches && queryMatches;
  });
  if (assets.length === 0) return null;
  return (
    <section className="asset-panel" aria-label={copy.assetLibrary}>
      <header>
        <strong>{copy.assets}</strong>
        <span>
          {filteredAssets.length}/{assets.length}
        </span>
      </header>
      <div className="asset-filters">
        <label>
          {copy.assetSearch}
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={copy.assetSearchPlaceholder}
          />
        </label>
        <label>
          {copy.assetKind}
          <select value={kindFilter} onChange={(event) => setKindFilter(event.currentTarget.value)}>
            <option value="">{copy.assetKindAll}</option>
            <option value="costume">{copy.assetKindCostume}</option>
            <option value="backdrop">{copy.assetKindBackdrop}</option>
            <option value="sound">{copy.assetKindSound}</option>
          </select>
        </label>
      </div>
      <div className="asset-list">
        {filteredAssets.length === 0 ? <p>{copy.assetNoMatches}</p> : null}
        {filteredAssets.map((asset) => (
          <article key={asset.id} className="asset-row">
            <div className="asset-preview" aria-hidden="true">
              {imageForAsset(asset) === undefined ? (
                asset.kind.slice(0, 2).toUpperCase()
              ) : (
                <img src={imageForAsset(asset)} alt="" />
              )}
            </div>
            <div>
              <h3>{asset.name}</h3>
              <p>
                {asset.kind} · {asset.id}
              </p>
              <p>{asset.tags.join(", ")}</p>
              <p>
                {asset.width !== undefined && asset.height !== undefined
                  ? `${copy.assetDimensions}: ${asset.width}x${asset.height}`
                  : asset.durationMs !== undefined
                    ? `${copy.assetDuration}: ${asset.durationMs}ms`
                    : (asset.preview ?? "")}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ValidationPanel({
  copy,
  issues,
}: {
  readonly copy: StudioUiCopy;
  readonly issues: readonly ValidationMessage["issues"][number][];
}) {
  if (issues.length === 0) return null;
  const errors = issues.filter((issue) => issue.severity === "error").length;
  return (
    <section className="validation-panel" aria-label={copy.validation}>
      <header>
        <strong>{copy.validation}</strong>
        <span>
          {errors} {copy.validationErrors} · {issues.length} {copy.validationIssues}
        </span>
      </header>
      <ol>
        {issues.map((issue) => (
          <li key={issue.id} data-severity={issue.severity}>
            <strong>{copy.validationKinds[issue.kind]}</strong>
            <p>{issue.message}</p>
            <code>
              {issue.path} → {issue.ref}
            </code>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Workbench({
  bridge,
  density = "comfortable",
  locale = "en",
}: {
  readonly bridge: HostBridge;
  readonly density?: WorkbenchDensity;
  readonly locale?: StudioUiLocale;
}) {
  const copyLocale = normalizeStudioUiLocale(locale);
  const copy = copyFor(copyLocale);
  const [layout, setLayout] = useState<WorkbenchDensity>(density);
  const [dragging, setDragging] = useState(false);
  const layoutRef = useRef<WorkbenchDensity>(density);
  const [workspace, setWorkspace] = useState<BlockWorkspaceSnapshot | undefined>();
  const [findings, setFindings] = useState<readonly ProgramFinding[]>([]);
  const [showFindingSummary, setShowFindingSummary] = useState(false);
  const [pendingVariableDelete, setPendingVariableDelete] = useState<string | undefined>();
  const [pendingListDelete, setPendingListDelete] = useState<string | undefined>();
  const [status, setStatus] = useState("");
  const [execution, setExecution] = useState<ExecutionState | undefined>();
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [stageFrame, setStageFrame] = useState<StageFrameMessage["frame"] | undefined>();
  const [actors, setActors] = useState<ActorsMessage | undefined>();
  const [selectedActorId, setSelectedActorId] = useState<string | undefined>();
  const [selectedScriptId, setSelectedScriptId] = useState<string | undefined>();
  const [selectedProcedureId, setSelectedProcedureId] = useState<string | undefined>();
  const pendingScriptCreation = useRef(false);
  const pendingActorCreation = useRef(false);
  const [assets, setAssets] = useState<AssetsMessage["assets"]>([]);
  const [backdropId, setBackdropId] = useState<string | undefined>();
  const [libraryTab, setLibraryTab] = useState<"blocks" | "scene">("blocks");
  const [paletteFocus, setPaletteFocus] = useState<string | undefined>();
  const [workspaceView, setWorkspaceView] = useState<"build" | "scene" | "review">("build");
  const [characterGalleryRequest, setCharacterGalleryRequest] = useState(0);
  const [toolsOpen, setToolsOpen] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth > 1100,
  );
  const [oriOpen, setOriOpen] = useState(true);
  const [oriWidth, setOriWidth] = useState<number | undefined>();
  const workbenchRef = useRef<HTMLDivElement>(null);
  const oriDockRef = useRef<HTMLDivElement>(null);
  const oriResizeStart = useRef<{ x: number; width: number } | undefined>(undefined);
  const oriWidthLimit = () => {
    const viewport = typeof window === "undefined" ? 1440 : window.innerWidth;
    const width = workbenchRef.current?.getBoundingClientRect().width ?? viewport;
    return Math.max(190, Math.min(420, width - (toolsOpen && viewport > 1100 ? 224 : 0) - 540));
  };
  const currentOriWidth = () => {
    const viewport = typeof window === "undefined" ? 1440 : window.innerWidth;
    return (
      oriDockRef.current?.getBoundingClientRect().width ??
      (viewport <= 1100 ? 210 : Math.max(250, Math.min(320, viewport * 0.24)))
    );
  };
  const resizeOri = (width: number) =>
    setOriWidth(Math.max(190, Math.min(oriWidthLimit(), Math.round(width))));
  useEffect(() => {
    const fitDock = () =>
      setOriWidth((width) => (width === undefined ? undefined : Math.min(width, oriWidthLimit())));
    window.addEventListener("resize", fitDock);
    return () => window.removeEventListener("resize", fitDock);
  }, [toolsOpen]);
  const [selectedExpression, setSelectedExpression] = useState<BlockType | undefined>();
  const [selectedNumeric, setSelectedNumeric] = useState<BlockType | undefined>();
  const [validationIssues, setValidationIssues] = useState<ValidationMessage["issues"]>([]);
  const [missionSpec, setMissionSpec] = useState<MissionSpecView | undefined>();
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const pausedReasonRef = useRef<string | undefined>();
  const [breakpointBlockIds, setBreakpointBlockIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const breakpointBlockIdsRef = useRef<ReadonlySet<string>>(breakpointBlockIds);
  const [selectedWatchId, setSelectedWatchId] = useState("");
  const selectedWatchIdRef = useRef("");
  const [pauseOnChange, setPauseOnChange] = useState(false);
  const pauseOnChangeRef = useRef(false);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot | undefined>();
  const debugSnapshotRef = useRef<DebugSnapshot | undefined>();
  const previousProgramHash = useRef<string | undefined>();
  const [programHash, setProgramHash] = useState<string | undefined>();
  const [selection, setSelection] = useState<SelectionState>({ include: [], overrides: {} });
  const [sync, setSync] = useState<SyncView>({});
  const [ambientHint, setAmbientHint] = useState<AmbientHintView | undefined>();
  const [focusRequest, setFocusRequest] = useState<FocusRequest | undefined>();
  const pendingAnnouncement = useRef<string | undefined>();
  const [agentUi, dispatchAgent] = useReducer(reduceAgentUi, undefined, initialAgentUi);

  useEffect(() => {
    const unsubscribe = bridge.subscribe((message) => {
      dispatchAgent(message);
      if (message.type === "density") {
        setLayout(message.value);
        const note = densityAnnouncement(layoutRef.current, message, copy);
        layoutRef.current = message.value;
        if (note !== undefined) setStatus(note);
        return;
      }
      if (message.type === "sync") {
        setSync({
          ...(message.selectedBlockId === undefined
            ? {}
            : { selectedBlockId: message.selectedBlockId }),
          ...(message.executingBlockId === undefined
            ? {}
            : { executingBlockId: message.executingBlockId }),
          ...(message.failedBlockId === undefined ? {} : { failedBlockId: message.failedBlockId }),
        });
        return;
      }
      if (message.type === "workspace") {
        setWorkspace(message.workspace);
        setFindings(message.findings ?? []);
        setShowFindingSummary(false);
        if (
          previousProgramHash.current !== undefined &&
          previousProgramHash.current !== message.programHash
        ) {
          breakpointBlockIdsRef.current = new Set();
          setBreakpointBlockIds(breakpointBlockIdsRef.current);
          debugSnapshotRef.current = undefined;
          setDebugSnapshot(undefined);
          pausedReasonRef.current = undefined;
        }
        previousProgramHash.current = message.programHash;
        setPendingVariableDelete(undefined);
        setPendingListDelete(undefined);
        setProgramHash(message.programHash);
        if (pendingScriptCreation.current) {
          const created = message.workspace.scripts.at(-1);
          setSelectedScriptId(created?.programId ?? created?.id);
          pendingScriptCreation.current = false;
        }
        if (pendingAnnouncement.current !== undefined) {
          setStatus(pendingAnnouncement.current);
          pendingAnnouncement.current = undefined;
        } else {
          setStatus(copy.updated);
        }
        return;
      }
      if (message.type === "ambientHint") {
        setAmbientHint(message.hint);
        return;
      }
      if (message.type === "executionState") {
        setExecution(message);
        setStatus(
          pausedReasonRef.current ?? `${message.status}: ${message.stepsUsed} ${copy.steps}`,
        );
        if (message.status === "completed" || message.status === "stopped") {
          playingRef.current = false;
          setPlaying(false);
          pausedReasonRef.current = undefined;
        }
        return;
      }
      if (message.type === "historyState") {
        setHistory({ canUndo: message.canUndo, canRedo: message.canRedo });
        return;
      }
      if (message.type === "stageFrame") {
        setStageFrame(message.frame);
        const advance = advanceDebugSession(
          debugSnapshotRef.current,
          message.frame,
          breakpointBlockIdsRef.current,
        );
        debugSnapshotRef.current = advance.snapshot;
        setDebugSnapshot(advance.snapshot);
        if (playingRef.current && advance.breakpointBlockId !== undefined) {
          playingRef.current = false;
          setPlaying(false);
          pausedReasonRef.current = copy.debugPausedBlock;
          setStatus(copy.debugPausedBlock);
        } else if (
          playingRef.current &&
          pauseOnChangeRef.current &&
          advance.changedVariableIds.includes(selectedWatchIdRef.current)
        ) {
          playingRef.current = false;
          setPlaying(false);
          pausedReasonRef.current = copy.debugPausedVariable;
          setStatus(copy.debugPausedVariable);
        }
        return;
      }
      if (message.type === "actors") {
        setActors(message);
        const followCreatedActor = pendingActorCreation.current;
        pendingActorCreation.current = false;
        setSelectedActorId((current) =>
          !followCreatedActor &&
          current !== undefined &&
          message.actors.some((actor) => actor.id === current)
            ? current
            : (message.selectedActorId ?? message.actors[0]?.id),
        );
        return;
      }
      if (message.type === "assets") {
        setAssets(message.assets);
        return;
      }
      if (message.type === "scene") {
        setBackdropId(message.backdropId);
        return;
      }
      if (message.type === "validation") {
        setValidationIssues(message.issues);
        return;
      }
      if (message.type === "missionSpec") {
        setMissionSpec(message.spec);
        return;
      }
      const text = statusFor(message, copy);
      if (message.type === "error") pendingScriptCreation.current = false;
      if (text !== undefined) setStatus(text);
    });
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "ready" });
    return unsubscribe;
  }, [bridge, copy]);

  const proposalId = agentUi.proposal?.proposalId;
  const operations = agentUi.proposal?.operations;
  useEffect(() => {
    // The selection restarts from "keep everything" whenever a different proposal is shown.
    setSelection(fullSelection(operations));
  }, [proposalId]);
  const anchored = canvasHints(agentUi.proposal, selection);
  const revealableBlockIds =
    workspace === undefined
      ? []
      : toRows(workspace).flatMap((row) => (row.kind === "block" ? [row.block.id] : []));

  const post = (intent: Intent) => {
    if (intent.type === "insertBlock" && window.innerWidth <= 1100) setToolsOpen(false);
    if (intent.type === "askAgent") setOriOpen(true);
    bridge.post({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "intent",
      intent,
      ...(programHash === undefined ? {} : { baseHash: programHash }),
    });
  };

  const revealHelpBlock = (blockId: string) => {
    if (workspace === undefined) return;
    const row = toRows(workspace).find(
      (candidate) => candidate.kind === "block" && candidate.block.id === blockId,
    );
    if (row?.kind !== "block") return;
    const script = workspace.scripts[row.block.location.container.scriptIndex];
    const scriptId = script?.programId ?? script?.id;
    const owner = actors?.actors.find(
      (actor) => scriptId !== undefined && actor.scriptIds?.includes(scriptId) === true,
    );
    if (owner !== undefined) setSelectedActorId(owner.id);
    if (scriptId !== undefined) setSelectedScriptId(scriptId);
    setWorkspaceView("build");
    setFocusRequest((previous) => ({
      pos: locationKey(row.block.location),
      nonce: (previous?.nonce ?? 0) + 1,
    }));
  };

  const announce = (text: string) => {
    pendingAnnouncement.current = text;
    setStatus(text);
  };

  const add = (blockType: BlockType) => {
    const scriptIds = actors?.actors.find((actor) => actor.id === selectedActorId)?.scriptIds;
    const targetScriptId =
      selectedScriptId !== undefined && scriptIds?.includes(selectedScriptId)
        ? selectedScriptId
        : scriptIds?.[0];
    const scriptIndex =
      scriptIds === undefined
        ? 0
        : (workspace?.scripts.findIndex(
            (candidate) => targetScriptId === (candidate.programId ?? candidate.id),
          ) ?? -1);
    const script = workspace?.scripts[scriptIndex];
    if (script === undefined) return;
    const procedureIndex =
      script.procedures?.findIndex((procedure) => procedure.id === selectedProcedureId) ?? -1;
    const container =
      procedureIndex < 0
        ? ({ kind: "script", scriptIndex } as const)
        : ({ kind: "procedure", scriptIndex, procedureIndex } as const);
    const length =
      procedureIndex < 0
        ? script.statements.length
        : script.procedures![procedureIndex]!.body.length;
    const labels: Readonly<Record<string, string>> = copy.blockLabels;
    announce(copy.addedAnnouncement(labels[blockType] ?? blockType));
    setFocusRequest((previous) => ({
      pos: locationKey({ container, index: length }),
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    post({
      type: "insertBlock",
      blockType,
      to: { container, index: length },
    });
  };

  const postExecution = (command: ExecutionCommand) => {
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "executionCommand", command });
  };

  const updateActor = (
    actorId: string,
    patch: Record<string, string | number | boolean | undefined>,
  ) => {
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "updateActor", actorId, patch });
  };

  const updateBackdrop = (id: string) => {
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "updateStage", backdropId: id });
  };

  const updateMissionSpec = (spec: Omit<MissionSpecView, "hash">) => {
    bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "updateMissionSpec", spec });
    announce(copy.missionSpecSaved);
  };

  const execute = (command: ExecutionCommand) => {
    pausedReasonRef.current = undefined;
    if (command === "run") {
      playingRef.current = true;
      setPlaying(true);
      postExecution("step");
      return;
    }
    if (command === "step" || command === "stop" || command === "reset") {
      playingRef.current = false;
      setPlaying(false);
    }
    postExecution(command);
  };

  useEffect(() => {
    if (!playing || workspace === undefined) return;
    if (execution?.status === "completed" || execution?.status === "stopped") {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => postExecution("step"), 450);
    return () => window.clearTimeout(timer);
  }, [playing, workspace, execution?.status, execution?.frameIndex]);

  const activeScriptIds = actors?.actors.find((actor) => actor.id === selectedActorId)?.scriptIds;
  const activeScriptId =
    selectedScriptId !== undefined && activeScriptIds?.includes(selectedScriptId)
      ? selectedScriptId
      : activeScriptIds?.[0];
  const activeScriptIndex =
    activeScriptId === undefined
      ? 0
      : (workspace?.scripts.findIndex(
          (script) => (script.programId ?? script.id) === activeScriptId,
        ) ?? -1);
  const activeProcedureId = workspace?.scripts[activeScriptIndex]?.procedures?.some(
    (procedure) => procedure.id === selectedProcedureId,
  )
    ? selectedProcedureId
    : undefined;

  const sceneLibrary = () => (
    <SceneLibrary
      copy={copy}
      actors={actors?.actors ?? []}
      assets={assets}
      selectedActorId={selectedActorId}
      backdropId={backdropId}
      characterGalleryRequest={characterGalleryRequest}
      onSelectActor={(id) => {
        setSelectedActorId(id);
        setSelectedScriptId(undefined);
      }}
      onCostume={(actorId, costumeId) => updateActor(actorId, { costumeId })}
      onBackdrop={updateBackdrop}
      onCreateActor={(name, costumeId) => {
        pendingActorCreation.current = true;
        bridge.post({
          schema: STUDIO_PROTOCOL_VERSION,
          type: "createActor",
          name,
          ...(costumeId === undefined ? {} : { costumeId }),
        });
      }}
      onDeleteActor={(actorId, ownedScriptIds) => {
        if (programHash === undefined) return;
        bridge.post({
          schema: STUDIO_PROTOCOL_VERSION,
          type: "deleteActor",
          actorId,
          ownedScriptIds,
          baseHash: programHash,
        });
      }}
      onCreateScript={(actorId, trigger, detail) => {
        if (programHash === undefined) return;
        pendingScriptCreation.current = true;
        bridge.post({
          schema: STUDIO_PROTOCOL_VERSION,
          type: "createScript",
          actorId,
          trigger,
          ...(trigger === "onMessage" && detail !== undefined ? { message: detail } : {}),
          ...(trigger === "onKeyPressed" && detail !== undefined ? { key: detail } : {}),
          baseHash: programHash,
        });
      }}
      onImportAsset={(kind, name, source) => {
        bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "importAsset", kind, name, source });
      }}
      onUpdateAsset={(assetId, name, source) => {
        bridge.post({
          schema: STUDIO_PROTOCOL_VERSION,
          type: "updateAsset",
          assetId,
          name,
          source,
        });
      }}
    />
  );

  return (
    <div
      ref={workbenchRef}
      className="workbench"
      style={
        oriWidth === undefined ? undefined : ({ "--ori-width": `${oriWidth}px` } as CSSProperties)
      }
      data-density={layout}
      data-dragging={dragging}
      data-workspace-view={workspaceView}
      data-tools-open={toolsOpen}
      data-ori-open={oriOpen}
      onDragStart={() => setDragging(true)}
      onDragEnd={() => setDragging(false)}
      onDrop={() => setDragging(false)}
    >
      <header className="studio-banner">
        <div className="studio-brand">
          <span>{copy.ideEyebrow}</span>
          <h1>{copy.ideTitle}</h1>
        </div>
        <p>{copy.ideSubtitle}</p>
        <div className="studio-shell-actions">
          <button
            type="button"
            aria-pressed={toolsOpen}
            aria-controls="studio-tools"
            onClick={() => {
              setPaletteFocus(undefined);
              setToolsOpen((open) => !open);
            }}
          >
            {toolsOpen ? copy.hideTools : copy.showTools}
          </button>
          <button
            type="button"
            aria-pressed={oriOpen}
            aria-controls="studio-ori"
            onClick={() => setOriOpen((open) => !open)}
          >
            {oriOpen ? copy.hideOri : copy.showOri}
          </button>
        </div>
      </header>
      <aside id="studio-tools" className="studio-tools" aria-label={copy.toolsTitle}>
        <div className="library-tabs" role="group" aria-label={copy.libraryScene}>
          <button
            type="button"
            aria-pressed={libraryTab === "blocks"}
            onClick={() => setLibraryTab("blocks")}
          >
            {copy.libraryBlocks}
          </button>
          <button
            type="button"
            aria-pressed={libraryTab === "scene"}
            onClick={() => setLibraryTab("scene")}
          >
            {copy.libraryScene}
          </button>
        </div>
        {libraryTab === "blocks" ? (
          <div aria-label={copy.libraryBlocks}>
            <h2>{copy.toolsTitle}</h2>
            <p>{copy.toolsHint}</p>
            <form
              className="variable-creator"
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.querySelector("input");
                const name = input?.value.trim() ?? "";
                if (name === "") return;
                post({ type: "addVariable", name });
                if (input !== null) input.value = "";
              }}
            >
              <label>
                <span>{copy.variableName}</span>
                <input maxLength={40} />
              </label>
              <button type="submit">{copy.variableAdd}</button>
              {(workspace?.variables ?? []).length === 0 ? null : (
                <ul>
                  {workspace?.variables?.map((variable) => (
                    <li key={variable.id}>
                      <details className="variable-management">
                        <summary>{variable.name}</summary>
                        <div className="variable-management-actions">
                          <label>
                            <span>{copy.variableInitialValue}</span>
                            <input
                              type="number"
                              min={NUMERIC_LITERAL_MIN}
                              max={NUMERIC_LITERAL_MAX}
                              key={`${variable.id}:${variable.initialValue}`}
                              defaultValue={variable.initialValue}
                              aria-label={`${variable.name}: ${copy.variableInitialValue}`}
                              onBlur={(event) => {
                                const raw = event.currentTarget.value.trim();
                                const value = Number(raw);
                                if (
                                  raw !== "" &&
                                  Number.isFinite(value) &&
                                  value >= NUMERIC_LITERAL_MIN &&
                                  value <= NUMERIC_LITERAL_MAX &&
                                  value !== variable.initialValue
                                )
                                  post({
                                    type: "setVariableInitialValue",
                                    variableId: variable.id,
                                    value,
                                  });
                                event.currentTarget.value = String(variable.initialValue);
                              }}
                            />
                          </label>
                          <label className="watcher-toggle">
                            <input
                              type="checkbox"
                              checked={variable.visible}
                              onChange={(event) =>
                                post({
                                  type: "setVariableVisible",
                                  variableId: variable.id,
                                  visible: event.currentTarget.checked,
                                })
                              }
                            />
                            <span>{copy.watcherVisible}</span>
                          </label>
                          <label>
                            <span>{copy.variableName}</span>
                            <input
                              id={`rename-variable-${variable.id}`}
                              key={`${variable.id}:${variable.name}`}
                              maxLength={40}
                              defaultValue={variable.name}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(
                                `rename-variable-${variable.id}`,
                              );
                              if (!(input instanceof HTMLInputElement)) return;
                              const name = input.value.trim();
                              if (name && name !== variable.name)
                                post({ type: "renameVariable", variableId: variable.id, name });
                            }}
                          >
                            {copy.variableRename}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (pendingVariableDelete === variable.id) {
                                post({ type: "deleteVariable", variableId: variable.id });
                                setPendingVariableDelete(undefined);
                              } else setPendingVariableDelete(variable.id);
                            }}
                          >
                            {pendingVariableDelete === variable.id
                              ? copy.variableConfirmDelete
                              : copy.variableDelete}
                          </button>
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </form>
            <form
              className="list-creator"
              onSubmit={(event) => {
                event.preventDefault();
                const input = event.currentTarget.querySelector("input");
                const name = input?.value.trim() ?? "";
                if (name === "") return;
                post({ type: "addList", name });
                if (input !== null) input.value = "";
              }}
            >
              <label>
                <span>{copy.listName}</span>
                <input maxLength={40} />
              </label>
              <button type="submit">{copy.listAdd}</button>
              {(workspace?.lists ?? []).length === 0 ? null : (
                <ul>
                  {workspace?.lists?.map((list) => (
                    <li key={list.id}>
                      <details className="list-initial-items">
                        <summary>
                          {list.name} · {list.initialItems.length} {copy.listItemsInitial}
                        </summary>
                        <div className="list-management-actions">
                          <label className="watcher-toggle">
                            <input
                              type="checkbox"
                              checked={list.visible}
                              onChange={(event) =>
                                post({
                                  type: "setListVisible",
                                  listId: list.id,
                                  visible: event.currentTarget.checked,
                                })
                              }
                            />
                            <span>{copy.watcherVisible}</span>
                          </label>
                          <label>
                            <span>{copy.listName}</span>
                            <input
                              id={`rename-${list.id}`}
                              key={`${list.id}:${list.name}`}
                              maxLength={40}
                              defaultValue={list.name}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById(`rename-${list.id}`);
                              if (!(input instanceof HTMLInputElement)) return;
                              const name = input.value.trim();
                              if (name && name !== list.name)
                                post({ type: "renameList", listId: list.id, name });
                            }}
                          >
                            {copy.listRename}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (pendingListDelete === list.id) {
                                post({ type: "deleteList", listId: list.id });
                                setPendingListDelete(undefined);
                              } else setPendingListDelete(list.id);
                            }}
                          >
                            {pendingListDelete === list.id
                              ? copy.listConfirmDelete
                              : copy.listDelete}
                          </button>
                        </div>
                        <ol>
                          {list.initialItems.map((item, index) => (
                            <li key={`${list.id}:${index}`}>
                              <label>
                                <span>
                                  {copy.listItem} {index + 1}
                                </span>
                                <input
                                  key={`${list.id}:${index}:${item}`}
                                  type="number"
                                  min={NUMERIC_LITERAL_MIN}
                                  max={NUMERIC_LITERAL_MAX}
                                  defaultValue={item}
                                  aria-label={`${list.name}: ${copy.listItem} ${index + 1}`}
                                  onBlur={(event) => {
                                    const raw = event.currentTarget.value.trim();
                                    const next = Number(raw);
                                    if (
                                      raw !== "" &&
                                      Number.isFinite(next) &&
                                      next >= NUMERIC_LITERAL_MIN &&
                                      next <= NUMERIC_LITERAL_MAX &&
                                      next !== item
                                    )
                                      post({
                                        type: "setListInitialItems",
                                        listId: list.id,
                                        items: list.initialItems.map((value, position) =>
                                          position === index ? next : value,
                                        ),
                                      });
                                    event.currentTarget.value = String(item);
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                aria-label={`${copy.listRemoveInitial} ${index + 1} ${list.name}`}
                                onClick={() =>
                                  post({
                                    type: "setListInitialItems",
                                    listId: list.id,
                                    items: list.initialItems.filter(
                                      (_, position) => position !== index,
                                    ),
                                  })
                                }
                              >
                                {copy.listRemoveInitial}
                              </button>
                            </li>
                          ))}
                        </ol>
                        <button
                          type="button"
                          className="list-add-initial"
                          disabled={list.initialItems.length >= LIST_MAX_ITEMS}
                          onClick={() =>
                            post({
                              type: "setListInitialItems",
                              listId: list.id,
                              items: [...list.initialItems, 0],
                            })
                          }
                        >
                          {copy.listAddInitial}
                        </button>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
            </form>
            {workspace === undefined ? null : (
              <ProcedureNavigator
                workspace={workspace}
                copy={copy}
                onOpen={(scriptId, procedureId) => {
                  const owner = actors?.actors.find((actor) => actor.scriptIds?.includes(scriptId));
                  if (owner !== undefined) setSelectedActorId(owner.id);
                  setSelectedScriptId(scriptId);
                  setSelectedProcedureId(procedureId);
                }}
              />
            )}
            {workspace !== undefined && activeScriptIndex >= 0 ? (
              <ProcedureTools
                key={activeScriptIndex}
                workspace={workspace}
                scriptIndex={activeScriptIndex}
                copy={copy}
                onIntent={post}
                onEditBody={setSelectedProcedureId}
                editingProcedureId={activeProcedureId}
              />
            ) : null}
            <Palette
              copy={copy}
              onAdd={add}
              onSelectExpression={setSelectedExpression}
              selectedExpression={selectedExpression}
              onSelectNumeric={setSelectedNumeric}
              selectedNumeric={selectedNumeric}
              hasLists={(workspace?.lists?.length ?? 0) > 0}
              hasVariables={(workspace?.variables?.length ?? 0) > 0}
              hasActors={(actors?.actors.length ?? 0) > 0}
              hasProcedures={
                (activeScriptId === undefined
                  ? (workspace?.scripts[0]?.procedures?.length ?? 0)
                  : (workspace?.scripts.find(
                      (script) => (script.programId ?? script.id) === activeScriptId,
                    )?.procedures?.length ?? 0)) > 0
              }
              sectionFilter={paletteFocus}
            />
          </div>
        ) : (
          <div aria-label={copy.libraryScene}>{sceneLibrary()}</div>
        )}
      </aside>
      <main className="studio-main">
        <nav className="studio-editor-tabs" aria-label={copy.workspaceViews}>
          {(["build", "scene", "review"] as const).map((view) => (
            <button
              key={view}
              type="button"
              aria-pressed={workspaceView === view}
              onClick={() => {
                setWorkspaceView(view);
                if (view === "build") {
                  setLibraryTab("blocks");
                  setToolsOpen(window.innerWidth > 1100);
                } else {
                  setToolsOpen(false);
                }
              }}
            >
              {view === "build"
                ? copy.workspaceBuild
                : view === "scene"
                  ? copy.workspaceScene
                  : copy.workspaceReview}
            </button>
          ))}
          <button
            type="button"
            className="studio-code-tab"
            onClick={() => bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "openCode" })}
          >
            {copy.workspaceCode}
          </button>
        </nav>
        <section className="studio-play" aria-label={copy.evidenceTitle}>
          <div className="studio-history-actions" role="group" aria-label={copy.historyUndo}>
            <button
              type="button"
              disabled={!history.canUndo}
              onClick={() =>
                bridge.post({
                  schema: STUDIO_PROTOCOL_VERSION,
                  type: "historyCommand",
                  command: "undo",
                })
              }
            >
              {copy.historyUndo}
            </button>
            <button
              type="button"
              disabled={!history.canRedo}
              onClick={() =>
                bridge.post({
                  schema: STUDIO_PROTOCOL_VERSION,
                  type: "historyCommand",
                  command: "redo",
                })
              }
            >
              {copy.historyRedo}
            </button>
          </div>
          <ExecutionToolbar
            copy={copy}
            disabled={workspace === undefined}
            playing={playing}
            state={execution}
            onCommand={execute}
          />
          <StagePanel
            copy={copy}
            frame={stageFrame}
            assets={assets}
            listNames={Object.fromEntries(
              (workspace?.lists ?? []).map((list) => [list.id, list.name]),
            )}
            selectedActorId={selectedActorId}
            onSelectActor={setSelectedActorId}
            onPlaceActor={(actorId, position) => updateActor(actorId, position)}
            onTransformActor={(actorId, patch) => updateActor(actorId, patch)}
            onCostume={(actorId, costumeId) => updateActor(actorId, { costumeId })}
            onBackdrop={updateBackdrop}
            {...(workspaceView === "scene"
              ? { onBrowseCharacters: () => setCharacterGalleryRequest((request) => request + 1) }
              : {})}
            showBackdropPicker={workspaceView === "scene"}
            editingDisabled={execution?.status === "running"}
            onStageEvent={(event) =>
              bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "stageEvent", ...event })
            }
          />
        </section>
        <section
          className="studio-scene-editor"
          aria-label={copy.libraryScene}
          hidden={workspaceView !== "scene"}
        >
          <h2>{copy.libraryScene}</h2>
          {workspaceView === "scene" ? (
            <>
              <ActorInspector
                copy={copy}
                actors={actors?.actors ?? []}
                assets={assets}
                selectedActorId={selectedActorId}
                onPatch={updateActor}
              />
              {sceneLibrary()}
            </>
          ) : null}
        </section>
        <section
          className="studio-program"
          aria-label={copy.canvasLabel}
          hidden={workspaceView !== "build"}
        >
          <div className="studio-program-heading">
            <h2>{copy.canvasLabel}</h2>
            <button
              type="button"
              aria-controls="studio-tools"
              aria-expanded={toolsOpen}
              onClick={() => {
                setLibraryTab("blocks");
                setPaletteFocus(undefined);
                setToolsOpen((open) => !open);
              }}
            >
              {toolsOpen ? copy.hideTools : copy.showTools}
            </button>
          </div>
          <nav className="studio-component-launcher" aria-label={copy.paletteBlocks}>
            {[
              [copy.paletteMotion, "motion"],
              [copy.paletteLooks, "looks"],
              [copy.paletteControl, "control"],
              [copy.paletteSensing, "sensing"],
            ].map(([label, tone]) => (
              <button
                key={tone}
                type="button"
                data-tone={tone}
                aria-expanded={toolsOpen && paletteFocus === label}
                aria-controls="studio-tools"
                onClick={() => {
                  setLibraryTab("blocks");
                  setPaletteFocus(label);
                  setToolsOpen(true);
                }}
              >
                <span aria-hidden="true">◆</span> {label}
              </button>
            ))}
          </nav>
          <ProgramFindingsPanel
            copy={copy}
            findings={findings}
            onInspect={(nodeId) => {
              if (nodeId.includes("/procedures["))
                bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "openCode" });
              else revealHelpBlock(blockIdForNode(nodeId));
            }}
            onAskOri={() => {
              setShowFindingSummary(true);
              setOriOpen(true);
            }}
          />
          {workspace === undefined ? (
            <p>{copy.openProjectToStart}</p>
          ) : (
            <Canvas
              copy={copy}
              workspace={workspace}
              assets={assets}
              actors={actors?.actors ?? []}
              visibleScriptIds={activeScriptIds}
              selectedScriptId={activeScriptId}
              activeProcedureId={activeProcedureId}
              onCloseProcedure={() => setSelectedProcedureId(undefined)}
              onSelectScript={setSelectedScriptId}
              onDeleteScript={(scriptId) => {
                if (programHash === undefined || selectedActorId === undefined) return;
                bridge.post({
                  schema: STUDIO_PROTOCOL_VERSION,
                  type: "deleteScript",
                  actorId: selectedActorId,
                  scriptId,
                  baseHash: programHash,
                });
                if (selectedScriptId === scriptId) setSelectedScriptId(undefined);
              }}
              selectedExpression={selectedExpression}
              selectedNumeric={selectedNumeric}
              onIntent={post}
              breakpointBlockIds={breakpointBlockIds}
              onToggleBreakpoint={(id) => {
                const next = new Set(breakpointBlockIdsRef.current);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                breakpointBlockIdsRef.current = next;
                setBreakpointBlockIds(next);
              }}
              onAnnounce={announce}
              focusRequest={focusRequest}
              ghosts={agentUi.proposal === undefined ? undefined : anchored.ghosts}
              sync={sync}
              hints={
                agentUi.proposal === undefined
                  ? agentUi.help?.blockIds !== undefined
                    ? {
                        hints: Object.fromEntries(
                          agentUi.help.blockIds.map((id) => [id, copy.helpLookHere]),
                        ),
                        skipped: [],
                      }
                    : ambientHint?.blockId === undefined
                      ? undefined
                      : { hints: { [ambientHint.blockId]: ambientHint.label }, skipped: [] }
                  : { hints: anchored.hints, skipped: anchored.skipped }
              }
              ambientHint={agentUi.proposal === undefined ? ambientHint : undefined}
            />
          )}
          <p className="zone-hint">{copy.zoneHint}</p>
          <div className="zones">
            <AgentZone verb="explain" label={copy.zoneExplain} onIntent={post} />
            <AgentZone verb="debug" label={copy.zoneDebug} onIntent={post} />
            <AgentZone verb="challenge" label={copy.zoneChallenge} onIntent={post} />
          </div>
        </section>
        <section
          className="studio-evidence"
          aria-label={copy.evidenceTitle}
          hidden={workspaceView !== "review"}
        >
          <h2>{copy.evidenceTitle}</h2>
          <VisualDebuggerPanel
            copy={copy}
            variables={workspace?.variables ?? []}
            selectedVariableId={selectedWatchId}
            onSelectVariable={(id) => {
              selectedWatchIdRef.current = id;
              setSelectedWatchId(id);
              if (id === "") {
                pauseOnChangeRef.current = false;
                setPauseOnChange(false);
              }
            }}
            pauseOnChange={pauseOnChange}
            onPauseOnChange={(value) => {
              pauseOnChangeRef.current = value;
              setPauseOnChange(value);
            }}
            snapshot={debugSnapshot}
          />
          <EventTracePanel copy={copy} state={execution} selectedActorId={selectedActorId} />
          <ValidationPanel copy={copy} issues={validationIssues} />
        </section>
        <details className="studio-details" hidden={workspaceView !== "scene"}>
          <summary>{copy.detailsTitle}</summary>
          <MissionSpecPanel copy={copy} spec={missionSpec} onSave={updateMissionSpec} />
          <ActorTree
            copy={copy}
            actors={actors?.actors ?? []}
            selectedActorId={selectedActorId}
            onSelect={setSelectedActorId}
          />
          <AssetPanel copy={copy} assets={assets} />
        </details>
        <div className="status" role="status" aria-live="polite">
          {status}
        </div>
      </main>
      <div id="studio-ori" className="studio-ori-dock" ref={oriDockRef}>
        <div
          className="studio-ori-resize"
          role="separator"
          tabIndex={0}
          aria-label={copy.oriResize}
          aria-orientation="vertical"
          aria-valuemin={190}
          aria-valuemax={oriWidthLimit()}
          aria-valuenow={oriWidth ?? Math.round(currentOriWidth())}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            oriResizeStart.current = { x: event.clientX, width: currentOriWidth() };
            event.currentTarget.setPointerCapture?.(event.pointerId);
            event.preventDefault();
          }}
          onPointerMove={(event) => {
            const start = oriResizeStart.current;
            if (start !== undefined) resizeOri(start.width + start.x - event.clientX);
          }}
          onPointerUp={(event) => {
            oriResizeStart.current = undefined;
            if (event.currentTarget.hasPointerCapture?.(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            oriResizeStart.current = undefined;
          }}
          onDoubleClick={() => setOriWidth(undefined)}
          onKeyDown={(event) => {
            const width = currentOriWidth();
            if (event.key === "ArrowLeft") resizeOri(width + 20);
            else if (event.key === "ArrowRight") resizeOri(width - 20);
            else if (event.key === "Home") resizeOri(190);
            else if (event.key === "End") resizeOri(oriWidthLimit());
            else return;
            event.preventDefault();
          }}
        />
        <AgentPanel
          state={agentUi}
          send={(message) => bridge.post(message)}
          selection={selection}
          onSelectionChange={setSelection}
          onRevealBlock={revealHelpBlock}
          revealableBlockIds={revealableBlockIds}
          locale={copyLocale}
          findingSummary={
            showFindingSummary
              ? copy.findingOriSummary(
                  findings.filter((finding) => finding.kind === "loop-never-exits").length,
                  findings.filter((finding) => finding.kind === "loop-without-wait").length,
                  findings.filter((finding) => finding.kind.startsWith("shared-")).length,
                  findings.filter((finding) => finding.kind === "performance-budget").length,
                )
              : undefined
          }
        />
      </div>
    </div>
  );
}
