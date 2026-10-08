import { useEffect, useReducer, useRef, useState } from "react";
import type { BlockType, BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { Intent } from "@agorix/interaction-core";
import {
  STUDIO_PROTOCOL_VERSION,
  type ExecutionCommand,
  type ChangeRefusalReason,
  type HostMessage,
  type AmbientHintView,
} from "@agorix/studio-protocol";
import type { HostBridge } from "./bridge.js";
import { AgentZone, Canvas, type FocusRequest, type SyncView } from "./Canvas.js";
import { locationKey } from "./blockView.js";
import { Palette } from "./Palette.js";
import { densityAnnouncement } from "./density.js";
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

function stagePercent(value: number, max: number): string {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return "0%";
  return `${Math.max(-20, Math.min(120, (value / max) * 100))}%`;
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

export function StagePanel({
  copy,
  frame,
  assets = [],
  selectedActorId,
}: {
  readonly copy: StudioUiCopy;
  readonly frame: StageFrameMessage["frame"] | undefined;
  readonly assets?: readonly AssetsMessage["assets"][number][];
  readonly selectedActorId: string | undefined;
}) {
  const state = frame?.state;
  const assetNames = new Map(assets.map((asset) => [asset.id, asset.name]));
  const visibleVariables = (state?.variables ?? []).filter((variable) => variable.visible);
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
    <section className="stage-panel" aria-label={copy.stage}>
      <header className="stage-panel-header">
        <strong>{copy.stage}</strong>
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
      <div className="stage-viewport" data-running={frame?.running ? "true" : "false"}>
        {state === undefined ? (
          <p>{copy.stageNoFrame}</p>
        ) : (
          <>
            <div
              className="stage-backdrop"
              data-backdrop-id={state.backdropId ?? "default"}
              aria-hidden="true"
            />
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
                const size = Math.max(14, Math.min(42, Math.round((actor.size / 100) * 22)));
                return (
                  <div
                    key={actor.id}
                    className={
                      actor.id === selectedActorId ? "stage-sprite selected" : "stage-sprite"
                    }
                    data-costume-id={actor.costumeId ?? "default"}
                    style={{
                      left: stagePercent(actor.x, state.viewport.width),
                      bottom: stagePercent(actor.y, state.viewport.height),
                      width: `${size}px`,
                      height: `${size}px`,
                      transform: `translate(-50%, 50%) rotate(${-actor.direction}deg)`,
                    }}
                    role="img"
                    aria-label={`${copy.stageSprite} ${actor.name}: x ${actor.x}, y ${actor.y}, ${copy.actorDirection} ${actor.direction}${actor.costumeId === undefined ? "" : `, ${copy.actorCostume} ${assetNames.get(actor.costumeId) ?? actor.costumeId}`}`}
                  >
                    {actor.bubble === undefined ? null : (
                      <span className={`stage-bubble stage-bubble-${actor.bubble.kind}`}>
                        {actor.bubble.text}
                      </span>
                    )}
                  </div>
                );
              })}
            {visibleVariables.length === 0 ? null : (
              <div className="stage-watchers" aria-label={copy.variables}>
                {visibleVariables.map((variable) => (
                  <div key={variable.id} className="stage-watcher" data-variable-id={variable.id}>
                    <span>{variable.label}</span>
                    <strong>{variable.value}</strong>
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
  const numberPatch = (field: "x" | "y" | "direction" | "size") => (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) onPatch(actor.id, { [field]: parsed });
  };
  return (
    <section className="actor-inspector" aria-label={copy.actorInspector}>
      <header>
        <strong>{copy.actorInspector}</strong>
        <span>
          {actor.scriptCount ?? 0} {copy.actorScripts}
        </span>
      </header>
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
      <label>
        {copy.actorCostume}
        <select
          value={actor.costumeId ?? ""}
          onChange={(event) =>
            onPatch(actor.id, { costumeId: event.currentTarget.value || undefined })
          }
        >
          {actor.costumeId === undefined ? <option value="">{copy.actorNoCostume}</option> : null}
          {costumes.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.name} · {asset.id}
            </option>
          ))}
        </select>
      </label>
      <p className="actor-ref">{actor.id}</p>
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
              {asset.kind.slice(0, 2).toUpperCase()}
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
  const [workspace, setWorkspace] = useState<BlockWorkspaceSnapshot | undefined>();
  const [status, setStatus] = useState("");
  const [execution, setExecution] = useState<ExecutionState | undefined>();
  const [stageFrame, setStageFrame] = useState<StageFrameMessage["frame"] | undefined>();
  const [actors, setActors] = useState<ActorsMessage | undefined>();
  const [selectedActorId, setSelectedActorId] = useState<string | undefined>();
  const [assets, setAssets] = useState<AssetsMessage["assets"]>([]);
  const [playing, setPlaying] = useState(false);
  const [programHash, setProgramHash] = useState<string | undefined>();
  const [selection, setSelection] = useState<SelectionState>({ include: [], overrides: {} });
  const [sync, setSync] = useState<SyncView>({});
  const [ambientHint, setAmbientHint] = useState<AmbientHintView | undefined>();
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
        setProgramHash(message.programHash);
        setStatus(copy.updated);
        return;
      }
      if (message.type === "ambientHint") {
        setAmbientHint(message.hint);
        return;
      }
      if (message.type === "executionState") {
        setExecution(message);
        setStatus(`${message.status}: ${message.stepsUsed} ${copy.steps}`);
        if (message.status === "completed" || message.status === "stopped") {
          setPlaying(false);
        }
        return;
      }
      if (message.type === "stageFrame") {
        setStageFrame(message.frame);
        return;
      }
      if (message.type === "actors") {
        setActors(message);
        setSelectedActorId((current) =>
          current !== undefined && message.actors.some((actor) => actor.id === current)
            ? current
            : (message.selectedActorId ?? message.actors[0]?.id),
        );
        return;
      }
      if (message.type === "assets") {
        setAssets(message.assets);
        return;
      }
      const text = statusFor(message, copy);
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

  const post = (intent: Intent) =>
    bridge.post({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "intent",
      intent,
      ...(programHash === undefined ? {} : { baseHash: programHash }),
    });

  const announce = (text: string) => {
    announced.current = true;
    setStatus(text);
  };

  const add = (blockType: BlockType) => {
    const script = workspace?.scripts[0];
    if (script === undefined) return;
    const container = { kind: "script", scriptIndex: 0 } as const;
    const labels: Readonly<Record<string, string>> = copy.blockLabels;
    announce(copy.addedAnnouncement(labels[blockType] ?? blockType));
    setFocusRequest((previous) => ({
      pos: locationKey({ container, index: script.statements.length }),
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    post({
      type: "insertBlock",
      blockType,
      to: { container, index: script.statements.length },
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

  const execute = (command: ExecutionCommand) => {
    if (command === "run") {
      setPlaying(true);
      postExecution("step");
      return;
    }
    if (command === "stop" || command === "reset") {
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

  return (
    <div className="workbench" data-density={density}>
      <Palette copy={copy} onAdd={add} />
      <main>
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
          selectedActorId={selectedActorId}
        />
        <EventTracePanel copy={copy} state={execution} selectedActorId={selectedActorId} />
        <ActorTree
          copy={copy}
          actors={actors?.actors ?? []}
          selectedActorId={selectedActorId}
          onSelect={setSelectedActorId}
        />
        <ActorInspector
          copy={copy}
          actors={actors?.actors ?? []}
          assets={assets}
          selectedActorId={selectedActorId}
          onPatch={updateActor}
        />
        <AssetPanel copy={copy} assets={assets} />
        {workspace === undefined ? (
          <p>{copy.openProjectToStart}</p>
        ) : (
          <Canvas
            copy={copy}
            workspace={workspace}
            onIntent={post}
            onAnnounce={announce}
            focusRequest={focusRequest}
            copy={copy}
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
        <div className="zones">
          <AgentZone verb="explain" label={copy.zoneExplain} onIntent={post} />
          <AgentZone verb="debug" label={copy.zoneDebug} onIntent={post} />
          <AgentZone verb="challenge" label={copy.zoneChallenge} onIntent={post} />
        </div>
        <div className="status" role="status" aria-live="polite">
          {status}
        </div>
      </main>
      <AgentPanel
        state={agentUi}
        send={(message) => bridge.post(message)}
        selection={selection}
        onSelectionChange={setSelection}
        locale={copyLocale}
      />
    </div>
  );
}
