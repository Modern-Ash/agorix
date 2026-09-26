import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectMetadata } from "@agorix/persistence";
import { POC_TOOLBOX, type BlockNode } from "@agorix/block-editor";
import { runProgram } from "@agorix/runtime";
import {
  framesFromRuntimeObservations,
  resetStageSession,
  type ObservationFrame,
} from "@agorix/stage";
import {
  addBlockToWorkspace,
  blockNodeId,
  codeSliceForNode,
  createEditorModel,
  deleteBlockFromWorkspace,
  editNumericBlockField,
  moveBlockInWorkspace,
  resetWorkspace,
  type AddableBlockType,
  type EditorModel,
  type EditorProjection,
} from "./editorModel.js";
import {
  createBrowserProjectPersistence,
  loadEditorProject,
  saveEditorProject,
  type LoadedEditorProject,
  type ProjectPersistence,
} from "./projectStorage.js";
import "./App.css";

type RunStatus = "idle" | "running" | "stopped" | "complete" | "error";

const addableBlocks = new Set<AddableBlockType>([
  "motion_move",
  "motion_turn",
  "control_repeat",
  "control_if",
]);

function isAddable(type: string): type is AddableBlockType {
  return addableBlocks.has(type as AddableBlockType);
}

function mergeProjection(model: EditorModel, projection: EditorProjection): EditorModel {
  return { ...model, ...projection };
}

function createProjectMetadata(createdAt: string, programBlockCount: number): ProjectMetadata {
  return {
    createdAt,
    updatedAt: new Date().toISOString(),
    missionProgress: programBlockCount > 0 ? 1 : 0,
    hintLevel: 0,
  };
}

function countProgramBlocks(model: EditorModel): number {
  return model.program.scripts.reduce((total, script) => total + script.statements.length, 0);
}

function initialProjectFor(
  persistence: ProjectPersistence | undefined,
): LoadedEditorProject & { readonly model: EditorModel } {
  const loaded = loadEditorProject(persistence);
  return { ...loaded, model: loaded.model ?? createEditorModel() };
}

function numericFieldFor(block: BlockNode): "steps" | "degrees" | "count" | undefined {
  switch (block.type) {
    case "motion_move":
      return "steps";
    case "motion_turn":
      return "degrees";
    case "control_repeat":
      return "count";
    default:
      return undefined;
  }
}

function displayNameFor(block: BlockNode): string {
  switch (block.type) {
    case "motion_move":
      return "Move";
    case "motion_turn":
      return "Turn";
    case "control_repeat":
      return "Repeat";
    case "control_if":
      return "If touching goal";
    default:
      return block.type;
  }
}

function blockValue(block: BlockNode, field: "steps" | "degrees" | "count"): number {
  const value = block.fields?.[field];
  return typeof value === "number" ? value : 0;
}

function CodePanel({
  code,
  highlightedNodeId,
  model,
}: {
  code: string;
  highlightedNodeId?: string;
  model: EditorModel;
}) {
  const range = highlightedNodeId === undefined ? undefined : model.codeMapping[highlightedNodeId];
  if (range === undefined) {
    return <pre className="code-surface">{code}</pre>;
  }
  return (
    <pre className="code-surface" aria-label="Code">
      {code.slice(0, range.start)}
      <mark>{code.slice(range.start, range.end)}</mark>
      {code.slice(range.end)}
    </pre>
  );
}

function StageView({ frame }: { frame: ObservationFrame | undefined }) {
  const state = frame?.state;
  const sprite = state?.sprite ?? { x: 52, y: 128, heading: 0, radius: 12 };
  const goal = state?.goal ?? { x: 212, y: 128, radius: 14 };
  const viewport = state?.viewport ?? { width: 264, height: 192 };
  return (
    <section className="stage-panel" aria-labelledby="stage-title">
      <div className="panel-heading">
        <h2 id="stage-title">Stage</h2>
        <span className="status-pill">
          {frame?.reachedGoal ? "Goal reached" : "Reach the goal"}
        </span>
      </div>
      <svg
        className="stage-canvas"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        role="img"
        aria-label="Sprite and goal stage"
      >
        <rect width={viewport.width} height={viewport.height} rx="14" />
        <line x1="24" y1="128" x2="240" y2="128" />
        <circle className="goal" cx={goal.x} cy={goal.y} r={goal.radius} />
        <g transform={`translate(${sprite.x} ${sprite.y}) rotate(${sprite.heading})`}>
          <circle className="sprite" r={sprite.radius} />
          <path d="M 4 0 L 16 -6 L 16 6 Z" />
        </g>
      </svg>
    </section>
  );
}

export function App() {
  const persistenceRef = useRef<ProjectPersistence | undefined>(createBrowserProjectPersistence());
  const initialProjectRef = useRef<ReturnType<typeof initialProjectFor>>();
  if (initialProjectRef.current === undefined) {
    initialProjectRef.current = initialProjectFor(persistenceRef.current);
  }

  const [model, setModel] = useState<EditorModel>(() => initialProjectRef.current!.model);
  const [createdAt, setCreatedAt] = useState(
    () => initialProjectRef.current!.metadata?.createdAt ?? new Date().toISOString(),
  );
  const [status, setStatus] = useState<RunStatus>("idle");
  const [message, setMessage] = useState(
    () =>
      initialProjectRef.current!.message ??
      "Nothing happens yet — add a block to 'When you press Run' to get started.",
  );
  const [persistenceMessage, setPersistenceMessage] = useState<string | undefined>(
    () => initialProjectRef.current!.message,
  );
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | undefined>();
  const [frameIndex, setFrameIndex] = useState(0);
  const [frames, setFrames] = useState<readonly ObservationFrame[]>([]);
  const timerRef = useRef<number | undefined>();

  const statements = model.workspace.scripts[0]?.statements ?? [];
  const activeFrame = frames[frameIndex];
  const highlightedCode =
    highlightedNodeId === undefined ? "" : codeSliceForNode(model, highlightedNodeId);

  const toolbox = useMemo(
    () =>
      POC_TOOLBOX.map((section) => ({
        ...section,
        blocks: section.blocks.filter((block) => isAddable(block.type)),
      })),
    [],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (initialProjectRef.current?.message !== undefined) {
      return;
    }
    const metadata = createProjectMetadata(createdAt, countProgramBlocks(model));
    setPersistenceMessage(saveEditorProject(persistenceRef.current, model.program, metadata));
  }, [createdAt, model.program]);

  function applyProjection(projection: EditorProjection) {
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setModel((current) => mergeProjection(current, projection));
    setHighlightedNodeId(undefined);
    setFrames([]);
    setFrameIndex(0);
    setStatus("idle");
  }

  function addBlock(type: AddableBlockType) {
    applyProjection(addBlockToWorkspace(model.workspace, type));
    setMessage("Every block you add shows up here as code.");
  }

  function editBlock(index: number, block: BlockNode, value: number) {
    const field = numericFieldFor(block);
    if (field === undefined) {
      return;
    }
    applyProjection(editNumericBlockField(model.workspace, index, field, value));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= statements.length) {
      return;
    }
    applyProjection(moveBlockInWorkspace(model.workspace, index, nextIndex));
  }

  function deleteBlock(index: number) {
    applyProjection(deleteBlockFromWorkspace(model.workspace, index));
  }

  function stopRun() {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current);
      timerRef.current = undefined;
    }
    setStatus("stopped");
    setMessage("Stopped");
  }

  function resetEditor() {
    stopRun();
    const projection = resetWorkspace();
    initialProjectRef.current = { ...initialProjectRef.current!, message: undefined };
    setPersistenceMessage(undefined);
    setCreatedAt(new Date().toISOString());
    setModel((current) => ({
      ...mergeProjection(current, projection),
      stage: resetStageSession(current.stage),
    }));
    setFrames([]);
    setFrameIndex(0);
    setHighlightedNodeId(undefined);
    setStatus("idle");
    setMessage("Reset");
  }

  function runBlocks() {
    if (status === "running") {
      return;
    }
    if (statements.length === 0) {
      setStatus("error");
      setMessage("Nothing happens yet — add a block to 'When you press Run' to get started.");
      return;
    }
    try {
      const result = runProgram(
        model.program,
        {
          sprite: {
            x: model.stage.initial.sprite.x,
            y: model.stage.initial.sprite.y,
            heading: model.stage.initial.sprite.heading,
          },
          goal: { x: model.stage.initial.goal.x, y: model.stage.initial.goal.y },
        },
        { collectObservations: true, stopAfterSteps: 24 },
      );
      const nextFrames = framesFromRuntimeObservations(result.observations);
      setFrames(nextFrames);
      setFrameIndex(0);
      setStatus("running");
      setMessage("Running…");
      if (timerRef.current !== undefined) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = window.setInterval(() => {
        setFrameIndex((current) => {
          const next = current + 1;
          if (next >= nextFrames.length) {
            window.clearInterval(timerRef.current);
            timerRef.current = undefined;
            setStatus("complete");
            setMessage(
              result.world.sprite.x === result.world.goal.x &&
                result.world.sprite.y === result.world.goal.y
                ? "You did it! Your sprite reached the goal."
                : "Not there yet. Your sprite stopped before reaching the goal — try adjusting how far it moves or turns.",
            );
            setHighlightedNodeId(undefined);
            return Math.max(nextFrames.length - 1, 0);
          }
          setHighlightedNodeId(nextFrames[next]?.highlightedNodeId);
          return next;
        });
      }, 550);
      setHighlightedNodeId(nextFrames[0]?.highlightedNodeId);
    } catch {
      setStatus("error");
      setMessage("This block setup needs a small fix before it can run.");
    }
  }

  return (
    <main className="editor-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Agorix First Mission</p>
          <h1>Build with blocks. See the code.</h1>
        </div>
        <div className="run-controls" aria-label="Run controls">
          <button type="button" onClick={runBlocks} disabled={status === "running"}>
            Run
          </button>
          <button type="button" onClick={stopRun} disabled={status !== "running"}>
            Stop
          </button>
          <button type="button" onClick={resetEditor}>
            Reset
          </button>
        </div>
      </header>

      <section className="mission-strip" aria-live="polite">
        <div>
          <h2>Mission: Get your sprite to the goal.</h2>
          <p>Use blocks to move it there.</p>
        </div>
        <div className="state-stack">
          <strong className={`run-state run-state-${status}`}>{message}</strong>
          {persistenceMessage === undefined ? null : (
            <strong className="run-state run-state-error">{persistenceMessage}</strong>
          )}
        </div>
      </section>

      <div className="workspace-grid">
        <aside className="toolbox" aria-labelledby="toolbox-title">
          <h2 id="toolbox-title">Blocks</h2>
          {toolbox.map((section) => (
            <section key={section.name}>
              <h3>{section.name}</h3>
              <div className="toolbox-list">
                {section.blocks.map((block) => (
                  <button
                    key={block.type}
                    type="button"
                    onClick={() => addBlock(block.type as AddableBlockType)}
                  >
                    {block.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </aside>

        <section className="program-panel" aria-labelledby="workspace-title">
          <div className="panel-heading">
            <h2 id="workspace-title">When you press Run</h2>
            <span>{statements.length} blocks</span>
          </div>
          <div className="block-stack">
            {statements.length === 0 ? (
              <p className="empty-state">Add a Move block to start.</p>
            ) : null}
            {statements.map((block, index) => {
              const field = numericFieldFor(block);
              const nodeId = blockNodeId(index);
              const selected = highlightedNodeId === nodeId;
              return (
                <article
                  key={block.id}
                  className={selected ? "block-card active" : "block-card"}
                  aria-label={`${displayNameFor(block)} block`}
                >
                  <button
                    type="button"
                    className="block-title"
                    onClick={() => setHighlightedNodeId(nodeId)}
                  >
                    {displayNameFor(block)}
                  </button>
                  {field === undefined ? (
                    <span>Touching the goal?</span>
                  ) : (
                    <label>
                      <span>{field}</span>
                      <input
                        type="number"
                        value={blockValue(block, field)}
                        onChange={(event) =>
                          editBlock(index, block, Number(event.currentTarget.value))
                        }
                      />
                    </label>
                  )}
                  {block.type === "control_if" ? (
                    <p className="block-note">If Touching the goal?, then run inside blocks.</p>
                  ) : null}
                  <div className="block-actions">
                    <button
                      type="button"
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === statements.length - 1}
                    >
                      Down
                    </button>
                    <button type="button" onClick={() => deleteBlock(index)}>
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <StageView frame={activeFrame} />

        <section className="code-panel" aria-labelledby="code-title">
          <div className="panel-heading">
            <h2 id="code-title">Code</h2>
            <span>This is the code behind your blocks.</span>
          </div>
          <CodePanel
            code={model.code}
            {...(highlightedNodeId === undefined ? {} : { highlightedNodeId })}
            model={model}
          />
          {highlightedCode ? (
            <p className="highlight-readout">Current node: {highlightedCode.trim()}</p>
          ) : null}
        </section>

        <aside className="tutor-panel" aria-labelledby="tutor-title">
          <h2 id="tutor-title">Tutor suggestion — may not be right</h2>
          <p>
            The tutor isn't available right now. You can still finish this mission — check your code
            against the blocks, and use Reset if you want a fresh start.
          </p>
        </aside>
      </div>
    </main>
  );
}
