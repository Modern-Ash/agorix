import {
  STUDIO_STAGE_KEYS,
  studioStageKey,
  type ActorView,
  type AssetView,
} from "@agorix/studio-protocol";
import type { StudioUiCopy } from "./i18n.js";
import { imageForAsset, imageForId } from "./visualArt.js";
import { useEffect, useRef, useState } from "react";
import { validEmbeddedImageSource } from "@agorix/program-model";
import { canPreviewSound, playSoundPreview } from "./soundPreview.js";

export const STAGE_COSTUME_DRAG_TYPE = "application/x-agorix-stage-costume";
export const STAGE_BACKDROP_DRAG_TYPE = "application/x-agorix-stage-backdrop";

export function SceneLibrary({
  copy,
  actors,
  assets,
  selectedActorId,
  backdropId,
  onSelectActor,
  onCostume,
  onBackdrop,
  onCreateActor,
  onDeleteActor,
  onCreateScript,
  onImportAsset,
  onUpdateAsset,
}: {
  readonly copy: StudioUiCopy;
  readonly actors: readonly ActorView[];
  readonly assets: readonly AssetView[];
  readonly selectedActorId: string | undefined;
  readonly backdropId: string | undefined;
  readonly onSelectActor: (id: string) => void;
  readonly onCostume: (actorId: string, costumeId: string) => void;
  readonly onBackdrop: (backdropId: string) => void;
  readonly onCreateActor?: (name: string) => void;
  readonly onDeleteActor?: (actorId: string, ownedScriptIds: readonly string[]) => void;
  readonly onCreateScript?: (
    actorId: string,
    trigger: "greenFlag" | "onMessage" | "onKeyPressed" | "onActorClicked",
    detail?: string,
  ) => void;
  readonly onImportAsset?: (kind: "costume" | "backdrop", name: string, source: string) => void;
  readonly onUpdateAsset?: (assetId: string, name: string, source: string) => void;
}) {
  const drawing = useRef<HTMLCanvasElement>(null);
  const drawingHistory = useRef<ImageData[]>([]);
  const [assetKind, setAssetKind] = useState<"costume" | "backdrop">("costume");
  const [activeSection, setActiveSection] = useState<
    "actors" | "costumes" | "backdrops" | "sounds" | "create"
  >("actors");
  const [assetName, setAssetName] = useState("");
  const [assetError, setAssetError] = useState("");
  const [pendingActorDelete, setPendingActorDelete] = useState<string>();
  const [soundPreviewError, setSoundPreviewError] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string>();
  const [pendingAsset, setPendingAsset] = useState<
    | { mode: "create"; kind: "costume" | "backdrop"; knownIds: readonly string[] }
    | { mode: "update"; id: string; name: string; source: string }
  >();
  const [drawingActive, setDrawingActive] = useState(false);
  const [ink, setInk] = useState("#7855d8");
  const [drawTool, setDrawTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(5);
  const [undoCount, setUndoCount] = useState(0);
  const [scriptTrigger, setScriptTrigger] = useState<
    "greenFlag" | "onMessage" | "onKeyPressed" | "onActorClicked"
  >("greenFlag");
  const [scriptMessage, setScriptMessage] = useState("");
  const [scriptKey, setScriptKey] = useState("Space");
  const clearDrawing = () => {
    const canvas = drawing.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory.current = [];
    setUndoCount(0);
  };
  const startCreate = (kind: "costume" | "backdrop") => {
    clearDrawing();
    setEditingAssetId(undefined);
    setAssetKind(kind);
    setAssetName("");
    setAssetError("");
    setActiveSection("create");
  };
  const startEdit = (asset: AssetView) => {
    if (asset.kind !== "costume" && asset.kind !== "backdrop") return;
    const source = imageForAsset(asset);
    if (source === undefined) return;
    clearDrawing();
    setEditingAssetId(asset.id);
    setAssetKind(asset.kind);
    setAssetName(asset.name);
    setAssetError("");
    setActiveSection("create");
    const image = new Image();
    image.onload = () => {
      const canvas = drawing.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(
        image,
        (canvas.width - width) / 2,
        (canvas.height - height) / 2,
        width,
        height,
      );
    };
    image.src = source;
  };
  const submitAsset = (name: string, source: string) => {
    if (!validEmbeddedImageSource(source)) {
      setAssetError(copy.sceneInvalidImage);
      return;
    }
    const safeName = (name.trim() || copy.sceneNewImage).slice(0, 80);
    if (editingAssetId === undefined) {
      setPendingAsset({
        mode: "create",
        kind: assetKind,
        knownIds: assets.map((asset) => asset.id),
      });
      onImportAsset?.(assetKind, safeName, source);
    } else {
      setPendingAsset({ mode: "update", id: editingAssetId, name: safeName, source });
      onUpdateAsset?.(editingAssetId, safeName, source);
    }
    setAssetError("");
  };
  useEffect(() => {
    if (
      pendingAsset !== undefined &&
      assets.some((asset) =>
        pendingAsset.mode === "create"
          ? asset.kind === pendingAsset.kind && !pendingAsset.knownIds.includes(asset.id)
          : asset.id === pendingAsset.id &&
            asset.name === pendingAsset.name &&
            asset.source === pendingAsset.source,
      )
    ) {
      setActiveSection(assetKind === "costume" ? "costumes" : "backdrops");
      setEditingAssetId(undefined);
      setPendingAsset(undefined);
    }
  }, [assets, assetKind, pendingAsset]);
  const rememberDrawing = (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
    drawingHistory.current.push(context.getImageData(0, 0, canvas.width, canvas.height));
    if (drawingHistory.current.length > 12) drawingHistory.current.shift();
    setUndoCount(drawingHistory.current.length);
  };
  const paint = (event: React.PointerEvent<HTMLCanvasElement>, starting = false) => {
    if (!drawingActive && !starting) return;
    const canvas = drawing.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const x = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
    const y = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
    if (drawTool === "eraser") {
      context.clearRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
      return;
    }
    context.fillStyle = ink;
    context.beginPath();
    context.arc(x, y, brushSize, 0, Math.PI * 2);
    context.fill();
  };
  const selected = actors.find((actor) => actor.id === selectedActorId) ?? actors[0];
  useEffect(() => setPendingActorDelete(undefined), [selectedActorId]);
  const costumes = assets.filter((asset) => asset.kind === "costume");
  const backdrops = assets.filter((asset) => asset.kind === "backdrop");
  const sounds = assets.filter((asset) => asset.kind === "sound");
  const preview = (asset: AssetView) => {
    const image = imageForAsset(asset);
    return image === undefined ? (
      <span aria-hidden="true">{asset.name.slice(0, 1)}</span>
    ) : (
      <img src={image} alt="" />
    );
  };
  return (
    <div className="scene-library" aria-label={copy.libraryScene}>
      <nav className="scene-section-tabs" aria-label={copy.libraryScene}>
        {(
          [
            ["actors", copy.sceneActors, actors.length],
            ["costumes", copy.sceneCostumes, costumes.length],
            ["backdrops", copy.sceneBackdrops, backdrops.length],
            ["sounds", copy.sceneSounds, sounds.length],
            ...(onImportAsset === undefined
              ? []
              : [["create", copy.sceneCreateImage, undefined] as const]),
          ] as const
        ).map(([section, label, count]) => (
          <button
            key={section}
            type="button"
            aria-pressed={activeSection === section}
            onClick={() => setActiveSection(section)}
          >
            <span>{label}</span>
            {count === undefined ? null : <small>{count}</small>}
          </button>
        ))}
      </nav>
      <section aria-label={copy.sceneActors} hidden={activeSection !== "actors"}>
        <h3>{copy.sceneActors}</h3>
        {onCreateActor === undefined ? null : (
          <form
            className="scene-create-actor"
            onSubmit={(event) => {
              event.preventDefault();
              const input = event.currentTarget.querySelector("input");
              const name = input?.value.trim() ?? "";
              if (name.length === 0) return;
              onCreateActor(name);
              if (input !== null) input.value = "";
            }}
          >
            <input aria-label={copy.sceneActorName} maxLength={80} />
            <button type="submit">{copy.sceneCreateActor}</button>
          </form>
        )}
        <div className="scene-library-grid scene-actors">
          {actors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              aria-pressed={actor.id === selected?.id}
              onClick={() => onSelectActor(actor.id)}
              title={actor.name}
            >
              {imageForId(actor.costumeId, assets) === undefined ? (
                <span aria-hidden="true">{actor.name.slice(0, 1)}</span>
              ) : (
                <img src={imageForId(actor.costumeId, assets)} alt="" />
              )}
              <span>{actor.name}</span>
            </button>
          ))}
        </div>
        {selected === undefined || onDeleteActor === undefined ? null : (
          <button
            type="button"
            className="scene-delete-actor"
            disabled={actors.length <= 1 || selected.scriptIds === undefined}
            onClick={() => {
              if (selected.scriptIds === undefined) return;
              if (pendingActorDelete === selected.id) {
                onDeleteActor(selected.id, selected.scriptIds);
                setPendingActorDelete(undefined);
              } else setPendingActorDelete(selected.id);
            }}
          >
            {pendingActorDelete === selected.id
              ? copy.sceneConfirmDeleteActor(selected.name, selected.scriptIds?.length ?? 0)
              : copy.sceneDeleteActor}
          </button>
        )}
        {selected === undefined || onCreateScript === undefined ? null : (
          <form
            className="scene-create-script"
            onSubmit={(event) => {
              event.preventDefault();
              if (scriptTrigger === "onMessage" && scriptMessage.trim() === "") return;
              onCreateScript(
                selected.id,
                scriptTrigger,
                scriptTrigger === "onMessage"
                  ? scriptMessage.trim()
                  : scriptTrigger === "onKeyPressed"
                    ? scriptKey
                    : undefined,
              );
            }}
          >
            <label>
              {copy.sceneNewScript}
              <select
                value={scriptTrigger}
                onChange={(event) =>
                  setScriptTrigger(
                    event.currentTarget.value as
                      "greenFlag" | "onMessage" | "onKeyPressed" | "onActorClicked",
                  )
                }
              >
                <option value="greenFlag">{copy.canvasWhenRun}</option>
                <option value="onMessage">{copy.sceneOnMessage}</option>
                <option value="onKeyPressed">{copy.sceneOnKey}</option>
                <option value="onActorClicked">{copy.sceneOnActorClick}</option>
              </select>
            </label>
            {scriptTrigger === "onMessage" ? (
              <input
                aria-label={copy.sceneMessageName}
                maxLength={80}
                value={scriptMessage}
                onChange={(event) => setScriptMessage(event.currentTarget.value)}
              />
            ) : null}
            {scriptTrigger === "onKeyPressed" ? (
              <div className="scene-key-picker">
                <label>
                  {copy.sceneKey}
                  <select
                    aria-label={copy.sceneKey}
                    value={scriptKey}
                    onChange={(event) => setScriptKey(event.currentTarget.value)}
                  >
                    {STUDIO_STAGE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {key}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={copy.sceneCaptureKey}
                  title={copy.sceneCaptureKey}
                  onKeyDown={(event) => {
                    if (event.altKey || event.ctrlKey || event.metaKey) return;
                    const key = studioStageKey(event.key);
                    if (key === undefined) return;
                    event.preventDefault();
                    event.stopPropagation();
                    setScriptKey(key);
                  }}
                >
                  {copy.sceneCaptureKey}
                </button>
              </div>
            ) : null}
            <button type="submit">{copy.sceneAddScript}</button>
          </form>
        )}
      </section>
      <section aria-label={copy.sceneCostumes} hidden={activeSection !== "costumes"}>
        <h3>
          {copy.sceneCostumes}
          {selected === undefined ? "" : ` · ${selected.name}`}
        </h3>
        <p className="scene-costume-hint">{copy.sceneDragCostume}</p>
        <div className="scene-library-grid">
          {costumes.map((asset) => (
            <div
              key={asset.id}
              className="scene-asset-card"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(STAGE_COSTUME_DRAG_TYPE, asset.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <button
                type="button"
                disabled={selected === undefined}
                aria-pressed={asset.id === selected?.costumeId}
                aria-label={`${copy.sceneSelectCostume}: ${asset.name}`}
                onClick={() => {
                  if (selected !== undefined) onCostume(selected.id, asset.id);
                }}
              >
                {preview(asset)}
                <span>{asset.name}</span>
              </button>
              {onUpdateAsset === undefined ? null : (
                <button type="button" className="scene-edit-asset" onClick={() => startEdit(asset)}>
                  {copy.sceneEditImage}
                </button>
              )}
            </div>
          ))}
        </div>
        {onImportAsset === undefined ? null : (
          <button
            type="button"
            className="scene-create-shortcut"
            onClick={() => {
              startCreate("costume");
            }}
          >
            + {copy.sceneCreateImage}
          </button>
        )}
      </section>
      <section aria-label={copy.sceneBackdrops} hidden={activeSection !== "backdrops"}>
        <h3>{copy.sceneBackdrops}</h3>
        <p className="scene-backdrop-hint">{copy.sceneDragBackdrop}</p>
        <div className="scene-library-grid">
          {backdrops.map((asset) => (
            <div
              key={asset.id}
              className="scene-asset-card"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(STAGE_BACKDROP_DRAG_TYPE, asset.id);
                event.dataTransfer.effectAllowed = "copy";
              }}
            >
              <button
                type="button"
                aria-pressed={asset.id === backdropId}
                aria-label={`${copy.sceneSelectBackdrop}: ${asset.name}`}
                onClick={() => onBackdrop(asset.id)}
              >
                {preview(asset)}
                <span>{asset.name}</span>
              </button>
              {onUpdateAsset === undefined ? null : (
                <button type="button" className="scene-edit-asset" onClick={() => startEdit(asset)}>
                  {copy.sceneEditImage}
                </button>
              )}
            </div>
          ))}
        </div>
        {onImportAsset === undefined ? null : (
          <button
            type="button"
            className="scene-create-shortcut"
            onClick={() => {
              startCreate("backdrop");
            }}
          >
            + {copy.sceneCreateImage}
          </button>
        )}
      </section>
      <section aria-label={copy.sceneSounds} hidden={activeSection !== "sounds"}>
        <h3>{copy.sceneSounds}</h3>
        <p className="scene-sound-hint">{copy.sceneSoundHint}</p>
        {sounds.length === 0 ? <p>{copy.sceneNoSounds}</p> : null}
        <div className="scene-library-grid scene-sounds">
          {sounds.map((asset) => (
            <div key={asset.id} className="scene-sound-card">
              <span className="scene-sound-icon" aria-hidden="true">
                ♫
              </span>
              <strong>{asset.name}</strong>
              {asset.durationMs === undefined ? null : (
                <small>{(asset.durationMs / 1000).toFixed(1)} s</small>
              )}
              <button
                type="button"
                disabled={!canPreviewSound(asset)}
                aria-label={`${copy.scenePreviewSound}: ${asset.name}`}
                onClick={() => setSoundPreviewError(!playSoundPreview(asset))}
              >
                {canPreviewSound(asset) ? copy.scenePreviewSound : copy.scenePreviewUnavailable}
              </button>
            </div>
          ))}
        </div>
        {soundPreviewError ? <p role="status">{copy.scenePreviewUnavailable}</p> : null}
      </section>
      {onImportAsset === undefined ? null : (
        <section
          aria-label={copy.sceneCreateImage}
          className="scene-create-image"
          data-editing={editingAssetId !== undefined}
          hidden={activeSection !== "create"}
        >
          <h3>{editingAssetId === undefined ? copy.sceneCreateImage : copy.sceneEditImage}</h3>
          <select
            aria-label={copy.sceneImageKind}
            value={assetKind}
            disabled={editingAssetId !== undefined}
            onChange={(event) => setAssetKind(event.target.value as "costume" | "backdrop")}
          >
            <option value="costume">{copy.sceneCostumes}</option>
            <option value="backdrop">{copy.sceneBackdrops}</option>
          </select>
          <input
            aria-label={copy.sceneImageName}
            maxLength={80}
            value={assetName}
            onChange={(event) => setAssetName(event.target.value)}
            placeholder={copy.sceneNewImage}
          />
          <label>
            {copy.sceneImportImage}
            <input
              type="file"
              accept="image/png,image/webp"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (
                  !file ||
                  (file.type !== "image/png" && file.type !== "image/webp") ||
                  file.size >= 60 * 1024
                ) {
                  setAssetError(copy.sceneInvalidImage);
                  return;
                }
                const reader = new FileReader();
                reader.onload = () =>
                  submitAsset(
                    assetName || file.name.replace(/\.[^.]+$/, ""),
                    reader.result as string,
                  );
                reader.onerror = () => setAssetError(copy.sceneInvalidImage);
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <canvas
            ref={drawing}
            width={160}
            height={120}
            aria-label={copy.sceneDrawImage}
            onPointerDown={(event) => {
              const context = event.currentTarget.getContext("2d");
              if (context) {
                rememberDrawing(event.currentTarget, context);
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrawingActive(true);
                paint(event, true);
              }
            }}
            onPointerMove={paint}
            onPointerUp={() => setDrawingActive(false)}
            onPointerCancel={() => setDrawingActive(false)}
          />
          <div className="scene-draw-tools" role="group" aria-label={copy.sceneDrawImage}>
            <button
              type="button"
              aria-pressed={drawTool === "brush"}
              onClick={() => setDrawTool("brush")}
            >
              {copy.sceneBrush}
            </button>
            <button
              type="button"
              aria-pressed={drawTool === "eraser"}
              onClick={() => setDrawTool("eraser")}
            >
              {copy.sceneEraser}
            </button>
            <input
              aria-label={copy.sceneInkColor}
              type="color"
              value={ink}
              onChange={(event) => setInk(event.target.value)}
            />
            <select
              aria-label={copy.sceneBrushSize}
              value={brushSize}
              onChange={(event) => setBrushSize(Number(event.target.value))}
            >
              <option value={3}>3 px</option>
              <option value={5}>5 px</option>
              <option value={9}>9 px</option>
            </select>
          </div>
          <div className="scene-draw-actions">
            <button
              type="button"
              onClick={() => {
                const canvas = drawing.current;
                if (canvas) submitAsset(assetName, canvas.toDataURL("image/png"));
              }}
            >
              {editingAssetId === undefined ? copy.sceneSaveDrawing : copy.sceneSaveChanges}
            </button>
            {editingAssetId === undefined ? null : (
              <button
                type="button"
                onClick={() => {
                  setEditingAssetId(undefined);
                  setPendingAsset(undefined);
                  setActiveSection(assetKind === "costume" ? "costumes" : "backdrops");
                }}
              >
                {copy.sceneCancelEdit}
              </button>
            )}
            <button
              type="button"
              disabled={undoCount === 0}
              onClick={() => {
                const canvas = drawing.current;
                const previous = drawingHistory.current.pop();
                if (canvas && previous) canvas.getContext("2d")?.putImageData(previous, 0, 0);
                setUndoCount(drawingHistory.current.length);
              }}
            >
              {copy.sceneUndoDrawing}
            </button>
            <button
              type="button"
              onClick={() => {
                const canvas = drawing.current;
                const context = canvas?.getContext("2d");
                if (canvas && context) {
                  rememberDrawing(canvas, context);
                  context.clearRect(0, 0, canvas.width, canvas.height);
                }
              }}
            >
              {copy.sceneClearImage}
            </button>
          </div>
          {assetError === "" ? null : <p role="alert">{assetError}</p>}
        </section>
      )}
    </div>
  );
}
