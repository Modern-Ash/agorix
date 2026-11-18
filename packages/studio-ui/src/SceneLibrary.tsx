import {
  STUDIO_STAGE_KEYS,
  studioStageKey,
  type ActorView,
  type AssetView,
} from "@agorix/studio-protocol";
import type { StudioUiCopy } from "./i18n.js";
import { imageForAsset, imageForId } from "./visualArt.js";
import { useEffect, useRef, useState } from "react";
import { validEmbeddedImageSource, validEmbeddedSoundSource } from "@agorix/program-model";
import { canPreviewSound, playSoundPreview } from "./soundPreview.js";
import { fillImageRegion, transformImagePixels } from "./imageTransforms.js";
import { KIDS_GALLERY_CATEGORIES, type KidsGalleryCategory } from "@agorix/stage";

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
  characterGalleryRequest = 0,
}: {
  readonly copy: StudioUiCopy;
  readonly actors: readonly ActorView[];
  readonly assets: readonly AssetView[];
  readonly selectedActorId: string | undefined;
  readonly backdropId: string | undefined;
  readonly onSelectActor: (id: string) => void;
  readonly onCostume: (actorId: string, costumeId: string) => void;
  readonly onBackdrop: (backdropId: string) => void;
  readonly onCreateActor?: (name: string, costumeId?: string) => void;
  readonly onDeleteActor?: (actorId: string, ownedScriptIds: readonly string[]) => void;
  readonly onCreateScript?: (
    actorId: string,
    trigger: "greenFlag" | "onMessage" | "onKeyPressed" | "onActorClicked",
    detail?: string,
  ) => void;
  readonly onImportAsset?: (
    kind: "costume" | "backdrop" | "sound",
    name: string,
    source: string,
  ) => void;
  readonly onUpdateAsset?: (assetId: string, name: string, source: string) => void;
  readonly characterGalleryRequest?: number;
}) {
  const drawing = useRef<HTMLCanvasElement>(null);
  const drawingHistory = useRef<ImageData[]>([]);
  const shapeDraft = useRef<{ x: number; y: number; image: ImageData }>();
  const imageLoadVersion = useRef(0);
  const [assetKind, setAssetKind] = useState<"costume" | "backdrop">("costume");
  const [activeSection, setActiveSection] = useState<
    "actors" | "costumes" | "backdrops" | "sounds" | "create"
  >("actors");
  const [assetName, setAssetName] = useState("");
  const [assetSearch, setAssetSearch] = useState("");
  const [assetCategory, setAssetCategory] = useState<KidsGalleryCategory>("all");
  const [assetError, setAssetError] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [pendingActorDelete, setPendingActorDelete] = useState<string>();
  const [soundPreviewError, setSoundPreviewError] = useState(false);
  const [soundName, setSoundName] = useState("");
  const [soundImportError, setSoundImportError] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string>();
  const [pendingAsset, setPendingAsset] = useState<
    | { mode: "create"; kind: "costume" | "backdrop"; knownIds: readonly string[] }
    | { mode: "update"; id: string; name: string; source: string }
  >();
  const [drawingActive, setDrawingActive] = useState(false);
  const [ink, setInk] = useState("#7855d8");
  const [drawTool, setDrawTool] = useState<
    "brush" | "eraser" | "fill" | "line" | "rectangle" | "ellipse"
  >("brush");
  const [brushSize, setBrushSize] = useState(5);
  const [undoCount, setUndoCount] = useState(0);
  const [scriptTrigger, setScriptTrigger] = useState<
    "greenFlag" | "onMessage" | "onKeyPressed" | "onActorClicked"
  >("greenFlag");
  const [scriptMessage, setScriptMessage] = useState("");
  const [scriptKey, setScriptKey] = useState("Space");
  useEffect(() => {
    if (characterGalleryRequest === 0) return;
    setActiveSection("costumes");
    setAssetSearch("");
    setAssetCategory("all");
  }, [characterGalleryRequest]);
  const clearDrawing = () => {
    shapeDraft.current = undefined;
    const canvas = drawing.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    drawingHistory.current = [];
    setUndoCount(0);
  };
  const startCreate = (kind: "costume" | "backdrop") => {
    imageLoadVersion.current += 1;
    setImageLoading(false);
    setImageLoadFailed(false);
    clearDrawing();
    setEditingAssetId(undefined);
    setAssetKind(kind);
    setAssetName("");
    setAssetError("");
    setActiveSection("create");
  };
  const loadAssetDrawing = (asset: AssetView, duplicate = false) => {
    if (asset.kind !== "costume" && asset.kind !== "backdrop") return;
    const source = imageForAsset(asset);
    if (source === undefined) return;
    const loadVersion = ++imageLoadVersion.current;
    setImageLoading(true);
    setImageLoadFailed(false);
    clearDrawing();
    setEditingAssetId(duplicate ? undefined : asset.id);
    setAssetKind(asset.kind);
    setAssetName(duplicate ? `${asset.name} ${copy.sceneCopySuffix}` : asset.name);
    setAssetError("");
    setActiveSection("create");
    const image = new Image();
    image.onload = () => {
      if (loadVersion !== imageLoadVersion.current) return;
      const canvas = drawing.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) {
        setImageLoading(false);
        setImageLoadFailed(true);
        setAssetError(copy.sceneImageLoadFailed);
        return;
      }
      try {
        if (image.width <= 0 || image.height <= 0) throw new RangeError("Invalid image size");
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
      } catch {
        setImageLoadFailed(true);
        setAssetError(copy.sceneImageLoadFailed);
      } finally {
        setImageLoading(false);
      }
    };
    image.onerror = () => {
      if (loadVersion !== imageLoadVersion.current) return;
      setImageLoading(false);
      setImageLoadFailed(true);
      setAssetError(copy.sceneImageLoadFailed);
    };
    image.src = source;
  };
  const transformDrawing = (kind: "flipHorizontal" | "rotateHalfTurn") => {
    if (imageLoading || imageLoadFailed) return;
    const canvas = drawing.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    try {
      const current = context.getImageData(0, 0, canvas.width, canvas.height);
      const transformed = transformImagePixels(current.data, canvas.width, canvas.height, kind);
      rememberDrawing(canvas, context);
      current.data.set(transformed);
      context.putImageData(current, 0, 0);
    } catch {
      setAssetError(copy.sceneInvalidImage);
    }
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
    if (imageLoading || imageLoadFailed) return;
    if (!drawingActive && !starting && shapeDraft.current === undefined) return;
    const canvas = drawing.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const bounds = canvas.getBoundingClientRect();
    if (bounds.width === 0 || bounds.height === 0) return;
    const x = ((event.clientX - bounds.left) * canvas.width) / bounds.width;
    const y = ((event.clientY - bounds.top) * canvas.height) / bounds.height;
    if (drawTool === "line" || drawTool === "rectangle" || drawTool === "ellipse") {
      if (starting)
        shapeDraft.current = {
          x,
          y,
          image: context.getImageData(0, 0, canvas.width, canvas.height),
        };
      const draft = shapeDraft.current;
      if (!draft) return;
      context.putImageData(draft.image, 0, 0);
      context.strokeStyle = ink;
      context.lineWidth = brushSize * 2;
      context.beginPath();
      if (drawTool === "line") {
        context.moveTo(draft.x, draft.y);
        context.lineTo(x, y);
      } else if (drawTool === "rectangle") {
        context.rect(
          Math.min(draft.x, x),
          Math.min(draft.y, y),
          Math.abs(x - draft.x),
          Math.abs(y - draft.y),
        );
      } else {
        context.ellipse(
          (draft.x + x) / 2,
          (draft.y + y) / 2,
          Math.max(0.5, Math.abs(x - draft.x) / 2),
          Math.max(0.5, Math.abs(y - draft.y) / 2),
          0,
          0,
          Math.PI * 2,
        );
      }
      context.stroke();
      return;
    }
    if (drawTool === "fill") {
      if (!starting) return;
      const current = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = fillImageRegion(current.data, canvas.width, canvas.height, x, y, ink);
      if (result !== undefined) {
        current.data.set(result);
        context.putImageData(current, 0, 0);
      }
      return;
    }
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
  const visibleAssets = (items: readonly AssetView[]) =>
    items.filter(
      (asset) =>
        (assetCategory === "all" || asset.tags.includes(assetCategory)) &&
        (assetSearch.trim() === "" ||
          `${asset.name} ${asset.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(assetSearch.trim().toLocaleLowerCase())),
    );
  const visibleCostumes = visibleAssets(costumes);
  const visibleBackdrops = visibleAssets(backdrops);
  const assetFilters = (
    <div className="scene-asset-filters">
      <input
        type="search"
        aria-label={copy.sceneSearchAssets}
        placeholder={copy.sceneSearchAssets}
        value={assetSearch}
        onChange={(event) => setAssetSearch(event.currentTarget.value)}
      />
      <select
        aria-label={copy.sceneAssetCategory}
        value={assetCategory}
        onChange={(event) => setAssetCategory(event.currentTarget.value as KidsGalleryCategory)}
      >
        {KIDS_GALLERY_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {copy.sceneAssetCategories[category]}
          </option>
        ))}
      </select>
    </div>
  );
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
        {assetFilters}
        {visibleCostumes.length === 0 ? <p>{copy.sceneNoMatchingAssets}</p> : null}
        <div className="scene-library-grid">
          {visibleCostumes.map((asset) => (
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
              {onCreateActor === undefined ? null : (
                <button
                  type="button"
                  className="scene-actor-from-costume"
                  aria-label={`${copy.sceneCreateActorFromCostume}: ${asset.name}`}
                  onClick={() => onCreateActor(asset.name, asset.id)}
                >
                  {copy.sceneCreateActorFromCostume}
                </button>
              )}
              {onUpdateAsset === undefined ? null : (
                <button
                  type="button"
                  className="scene-edit-asset"
                  onClick={() => loadAssetDrawing(asset)}
                >
                  {copy.sceneEditImage}
                </button>
              )}
              {onImportAsset === undefined ? null : (
                <button
                  type="button"
                  className="scene-duplicate-asset"
                  onClick={() => loadAssetDrawing(asset, true)}
                >
                  {copy.sceneDuplicateImage}
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
        {assetFilters}
        {visibleBackdrops.length === 0 ? <p>{copy.sceneNoMatchingAssets}</p> : null}
        <div className="scene-library-grid">
          {visibleBackdrops.map((asset) => (
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
                <button
                  type="button"
                  className="scene-edit-asset"
                  onClick={() => loadAssetDrawing(asset)}
                >
                  {copy.sceneEditImage}
                </button>
              )}
              {onImportAsset === undefined ? null : (
                <button
                  type="button"
                  className="scene-duplicate-asset"
                  onClick={() => loadAssetDrawing(asset, true)}
                >
                  {copy.sceneDuplicateImage}
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
        {onImportAsset === undefined ? null : (
          <div className="scene-sound-import">
            <input
              aria-label={copy.sceneSoundName}
              maxLength={80}
              value={soundName}
              onChange={(event) => setSoundName(event.target.value)}
            />
            <label>
              {copy.sceneImportSound}
              <input
                type="file"
                accept="audio/wav,.wav"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  if (!file || file.size >= 60 * 1024) {
                    setSoundImportError(true);
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const source = reader.result;
                    if (!validEmbeddedSoundSource(source)) {
                      setSoundImportError(true);
                      return;
                    }
                    onImportAsset(
                      "sound",
                      soundName.trim() || `Sound ${sounds.length + 1}`,
                      source,
                    );
                    setSoundImportError(false);
                    input.value = "";
                  };
                  reader.onerror = () => setSoundImportError(true);
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {soundImportError ? <p role="status">{copy.sceneInvalidSound}</p> : null}
          </div>
        )}
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
                imageLoadVersion.current += 1;
                setImageLoading(false);
                setImageLoadFailed(false);
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
              if (imageLoading || imageLoadFailed) return;
              const context = event.currentTarget.getContext("2d");
              if (context) {
                rememberDrawing(event.currentTarget, context);
                if (drawTool === "fill") {
                  paint(event, true);
                  return;
                }
                event.currentTarget.setPointerCapture(event.pointerId);
                setDrawingActive(true);
                paint(event, true);
              }
            }}
            onPointerMove={paint}
            onPointerUp={(event) => {
              if (shapeDraft.current) paint(event);
              shapeDraft.current = undefined;
              setDrawingActive(false);
            }}
            onPointerCancel={(event) => {
              const draft = shapeDraft.current;
              if (draft) {
                event.currentTarget.getContext("2d")?.putImageData(draft.image, 0, 0);
                drawingHistory.current.pop();
                setUndoCount(drawingHistory.current.length);
              }
              shapeDraft.current = undefined;
              setDrawingActive(false);
            }}
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
            <button
              type="button"
              aria-pressed={drawTool === "fill"}
              onClick={() => setDrawTool("fill")}
            >
              {copy.sceneFill}
            </button>
            {(["line", "rectangle", "ellipse"] as const).map((tool) => (
              <button
                key={tool}
                type="button"
                aria-pressed={drawTool === tool}
                onClick={() => setDrawTool(tool)}
              >
                {tool === "line"
                  ? copy.sceneLine
                  : tool === "rectangle"
                    ? copy.sceneRectangle
                    : copy.sceneEllipse}
              </button>
            ))}
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
              disabled={imageLoading || imageLoadFailed}
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
                  imageLoadVersion.current += 1;
                  setImageLoading(false);
                  setImageLoadFailed(false);
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
              disabled={imageLoading || imageLoadFailed}
              onClick={() => transformDrawing("flipHorizontal")}
            >
              {copy.sceneFlipImage}
            </button>
            <button
              type="button"
              disabled={imageLoading || imageLoadFailed}
              onClick={() => transformDrawing("rotateHalfTurn")}
            >
              {copy.sceneRotateImage}
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
          {imageLoading ? <p role="status">{copy.sceneLoadingImage}</p> : null}
        </section>
      )}
    </div>
  );
}
