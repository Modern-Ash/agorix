import type { ActorView, AssetView } from "@agorix/studio-protocol";
import type { StudioUiCopy } from "./i18n.js";
import { imageForAsset, imageForId } from "./visualArt.js";
import { useRef, useState } from "react";
import { validEmbeddedImageSource } from "@agorix/program-model";

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
  onCreateScript,
  onImportAsset,
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
  readonly onCreateScript?: (
    actorId: string,
    trigger: "greenFlag" | "onMessage" | "onKeyPressed" | "onActorClicked",
    detail?: string,
  ) => void;
  readonly onImportAsset?: (kind: "costume" | "backdrop", name: string, source: string) => void;
}) {
  const drawing = useRef<HTMLCanvasElement>(null);
  const drawingHistory = useRef<ImageData[]>([]);
  const [assetKind, setAssetKind] = useState<"costume" | "backdrop">("costume");
  const [activeSection, setActiveSection] = useState<
    "actors" | "costumes" | "backdrops" | "create"
  >("actors");
  const [assetName, setAssetName] = useState("");
  const [assetError, setAssetError] = useState("");
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
  const submitAsset = (name: string, source: string) => {
    if (!validEmbeddedImageSource(source)) {
      setAssetError(copy.sceneInvalidImage);
      return;
    }
    onImportAsset?.(assetKind, (name.trim() || copy.sceneNewImage).slice(0, 80), source);
    setAssetError("");
    setActiveSection(assetKind === "costume" ? "costumes" : "backdrops");
  };
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
  const costumes = assets.filter((asset) => asset.kind === "costume");
  const backdrops = assets.filter((asset) => asset.kind === "backdrop");
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
              <label>
                {copy.sceneKey}
                <select
                  aria-label={copy.sceneKey}
                  value={scriptKey}
                  onChange={(event) => setScriptKey(event.currentTarget.value)}
                >
                  {[
                    "Space",
                    "Enter",
                    "ArrowUp",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowRight",
                    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                  ].map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
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
        <div className="scene-library-grid">
          {costumes.map((asset) => (
            <button
              key={asset.id}
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
          ))}
        </div>
        {onImportAsset === undefined ? null : (
          <button
            type="button"
            className="scene-create-shortcut"
            onClick={() => {
              setAssetKind("costume");
              setActiveSection("create");
            }}
          >
            + {copy.sceneCreateImage}
          </button>
        )}
      </section>
      <section aria-label={copy.sceneBackdrops} hidden={activeSection !== "backdrops"}>
        <h3>{copy.sceneBackdrops}</h3>
        <div className="scene-library-grid">
          {backdrops.map((asset) => (
            <button
              key={asset.id}
              type="button"
              aria-pressed={asset.id === backdropId}
              aria-label={`${copy.sceneSelectBackdrop}: ${asset.name}`}
              onClick={() => onBackdrop(asset.id)}
            >
              {preview(asset)}
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
        {onImportAsset === undefined ? null : (
          <button
            type="button"
            className="scene-create-shortcut"
            onClick={() => {
              setAssetKind("backdrop");
              setActiveSection("create");
            }}
          >
            + {copy.sceneCreateImage}
          </button>
        )}
      </section>
      {onImportAsset === undefined ? null : (
        <section
          aria-label={copy.sceneCreateImage}
          className="scene-create-image"
          hidden={activeSection !== "create"}
        >
          <h3>{copy.sceneCreateImage}</h3>
          <select
            aria-label={copy.sceneImageKind}
            value={assetKind}
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
            <button
              type="button"
              onClick={() => {
                const canvas = drawing.current;
                if (canvas) submitAsset(assetName, canvas.toDataURL("image/png"));
              }}
            >
              {copy.sceneSaveDrawing}
            </button>
          </div>
          {assetError === "" ? null : <p role="alert">{assetError}</p>}
        </section>
      )}
    </div>
  );
}
