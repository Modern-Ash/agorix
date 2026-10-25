import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Locale } from "../../i18n.js";
import type { KidsCustomKind } from "../kidsCustom.js";
import { processKidsImage } from "../kidsImage.js";
import { floodFill, hexToRgba, pushSnapshot } from "../kidsPaint.js";

const SIDE = 256;
const COLORS = [
  "#252342",
  "#ef627d",
  "#ffb14a",
  "#61b992",
  "#548de4",
  "#a17ad6",
  "#ffffff",
] as const;

const MAX_UNDO = 20;
const MIN_SELECTION = 4;
type Tool = "brush" | "eraser" | "fill" | "line" | "rect" | "ellipse" | "text" | "select";
const TOOLS: readonly Tool[] = [
  "brush",
  "eraser",
  "fill",
  "line",
  "rect",
  "ellipse",
  "text",
  "select",
];
const TOOL_LABEL: Record<Tool, { es: string; en: string }> = {
  brush: { es: "Pincel", en: "Brush" },
  eraser: { es: "Goma", en: "Eraser" },
  fill: { es: "Rellenar", en: "Fill" },
  line: { es: "Línea", en: "Line" },
  rect: { es: "Rectángulo", en: "Rectangle" },
  ellipse: { es: "Círculo", en: "Circle" },
  text: { es: "Texto", en: "Text" },
  select: { es: "Seleccionar y mover", en: "Select and move" },
};

/** Two layers: 0 is behind, 1 is in front. A drawing is saved with both flattened into one image. */
type Layer = 0 | 1;
interface Snapshot {
  readonly back: ImageData;
  readonly front: ImageData;
}
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
type Drag =
  | { readonly mode: "stroke" }
  | { readonly mode: "shape"; readonly x: number; readonly y: number; readonly base: ImageData }
  | { readonly mode: "select"; readonly x: number; readonly y: number }
  | {
      readonly mode: "move";
      readonly x: number;
      readonly y: number;
      readonly base: ImageData;
      readonly lifted: HTMLCanvasElement;
      readonly from: Rect;
    };

interface Props {
  readonly kind: KidsCustomKind;
  readonly locale: Locale;
  readonly onSave: (dataUrl: string) => void;
  readonly onCancel: () => void;
  readonly onError: () => void;
  readonly initialImage?: string | undefined;
}

function normalized(ax: number, ay: number, bx: number, by: number): Rect {
  const x = Math.round(Math.min(ax, bx));
  const y = Math.round(Math.min(ay, by));
  return {
    x,
    y,
    w: Math.min(SIDE, Math.round(Math.max(ax, bx))) - x,
    h: Math.min(SIDE, Math.round(Math.max(ay, by))) - y,
  };
}

function inside(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
}

export function KidsDrawArt({ kind, locale, onSave, onCancel, onError, initialImage }: Props) {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag | null>(null);
  const selection = useRef<Rect | null>(null);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [brush, setBrush] = useState(8);
  const [tool, setTool] = useState<Tool>("brush");
  const [layer, setLayer] = useState<Layer>(1);
  const [filled, setFilled] = useState(false);
  const [text, setText] = useState("");
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!initialImage);
  const es = locale === "es";

  function context(which: Layer): CanvasRenderingContext2D | null {
    return (
      (which === 0 ? back : front).current?.getContext("2d", { willReadFrequently: true }) ?? null
    );
  }

  function wipeLayer(which: Layer) {
    const context2d = context(which);
    if (!context2d) return;
    context2d.clearRect(0, 0, SIDE, SIDE);
    if (which === 0 && kind === "backdrop") {
      context2d.fillStyle = "#ffffff";
      context2d.fillRect(0, 0, SIDE, SIDE);
    }
  }

  function showSelection(rect: Rect | null) {
    selection.current = rect;
    const context2d = overlay.current?.getContext("2d");
    if (!context2d) return;
    context2d.clearRect(0, 0, SIDE, SIDE);
    if (!rect) return;
    context2d.setLineDash([6, 4]);
    context2d.lineWidth = 2;
    context2d.strokeStyle = "#252342";
    context2d.strokeRect(rect.x, rect.y, rect.w, rect.h);
    context2d.strokeStyle = "#ffffff";
    context2d.lineDashOffset = 5;
    context2d.strokeRect(rect.x, rect.y, rect.w, rect.h);
    context2d.lineDashOffset = 0;
  }

  function clear() {
    wipeLayer(0);
    wipeLayer(1);
    showSelection(null);
  }

  function sync() {
    setDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  }

  function snapshot(): Snapshot | null {
    const a = context(0);
    const b = context(1);
    if (!a || !b) return null;
    return { back: a.getImageData(0, 0, SIDE, SIDE), front: b.getImageData(0, 0, SIDE, SIDE) };
  }

  function restore(value: Snapshot) {
    context(0)?.putImageData(value.back, 0, 0);
    context(1)?.putImageData(value.front, 0, 0);
    showSelection(null);
  }

  function remember() {
    const current = snapshot();
    if (!current) return;
    undoStack.current = pushSnapshot(undoStack.current, current, MAX_UNDO);
    redoStack.current = [];
    sync();
  }

  function travel(from: Snapshot[], to: Snapshot[]) {
    const current = snapshot();
    const target = from.pop();
    if (!current || !target) return;
    to.push(current);
    restore(target);
    sync();
  }

  function wipe() {
    remember();
    clear();
  }

  function flip() {
    if (!ready) return;
    remember();
    for (const which of [0, 1] as const) {
      const element = (which === 0 ? back : front).current;
      const context2d = context(which);
      if (!element || !context2d) continue;
      const copy = document.createElement("canvas");
      copy.width = SIDE;
      copy.height = SIDE;
      copy.getContext("2d")?.drawImage(element, 0, 0);
      context2d.save();
      context2d.clearRect(0, 0, SIDE, SIDE);
      context2d.translate(SIDE, 0);
      context2d.scale(-1, 1);
      context2d.drawImage(copy, 0, 0);
      context2d.restore();
    }
    showSelection(null);
  }

  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
    sync();
    clear();
    if (!initialImage) {
      setReady(true);
      return;
    }
    setReady(false);
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      context(1)?.drawImage(image, 0, 0, SIDE, SIDE);
      setReady(true);
    };
    image.onerror = () => {
      if (!cancelled) onError();
    };
    image.src = initialImage;
    return () => {
      cancelled = true;
    };
  }, [kind, initialImage]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SIDE, ((event.clientX - bounds.left) / bounds.width) * SIDE)),
      y: Math.max(0, Math.min(SIDE, ((event.clientY - bounds.top) / bounds.height) * SIDE)),
    };
  }

  /** Erasing shows what is behind; on the back layer of a backdrop it paints the white paper. */
  function eraseOnBack(): boolean {
    return layer === 0 && kind === "backdrop";
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const context2d = context(layer);
    if (!context2d) return;
    const { x, y } = point(event);
    if (tool === "select") {
      const chosen = selection.current;
      event.currentTarget.setPointerCapture(event.pointerId);
      if (chosen && inside(chosen, x, y)) {
        remember();
        const lifted = document.createElement("canvas");
        lifted.width = chosen.w;
        lifted.height = chosen.h;
        lifted
          .getContext("2d")
          ?.putImageData(context2d.getImageData(chosen.x, chosen.y, chosen.w, chosen.h), 0, 0);
        context2d.clearRect(chosen.x, chosen.y, chosen.w, chosen.h);
        if (eraseOnBack()) {
          context2d.fillStyle = "#ffffff";
          context2d.fillRect(chosen.x, chosen.y, chosen.w, chosen.h);
        }
        drag.current = {
          mode: "move",
          x,
          y,
          base: context2d.getImageData(0, 0, SIDE, SIDE),
          lifted,
          from: chosen,
        };
      } else {
        showSelection(null);
        drag.current = { mode: "select", x, y };
      }
      return;
    }
    remember();
    if (tool === "fill") {
      const image = context2d.getImageData(0, 0, SIDE, SIDE);
      if (floodFill(image.data, SIDE, SIDE, x, y, hexToRgba(color)))
        context2d.putImageData(image, 0, 0);
      return;
    }
    if (tool === "text") {
      const word = text.trim();
      if (!word) return;
      context2d.globalCompositeOperation = "source-over";
      context2d.fillStyle = color;
      context2d.font = `${12 + brush * 2}px sans-serif`;
      context2d.textBaseline = "middle";
      context2d.fillText(word, x, y, SIDE - x);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const erasing = tool === "eraser";
    const paint = erasing && eraseOnBack() ? "#ffffff" : color;
    context2d.globalCompositeOperation =
      erasing && !eraseOnBack() ? "destination-out" : "source-over";
    context2d.strokeStyle = paint;
    context2d.fillStyle = paint;
    context2d.lineWidth = brush;
    context2d.lineCap = "round";
    context2d.lineJoin = "round";
    if (tool === "brush" || erasing) {
      context2d.beginPath();
      context2d.arc(x, y, brush / 2, 0, Math.PI * 2);
      context2d.fill();
      context2d.beginPath();
      context2d.moveTo(x, y);
      drag.current = { mode: "stroke" };
    } else {
      drag.current = { mode: "shape", x, y, base: context2d.getImageData(0, 0, SIDE, SIDE) };
    }
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const current = drag.current;
    if (!current) return;
    const context2d = context(layer);
    if (!context2d) return;
    const { x, y } = point(event);
    if (current.mode === "stroke") {
      context2d.lineTo(x, y);
      context2d.stroke();
    } else if (current.mode === "select") {
      showSelection(normalized(current.x, current.y, x, y));
    } else if (current.mode === "move") {
      const dx = Math.round(x - current.x);
      const dy = Math.round(y - current.y);
      context2d.putImageData(current.base, 0, 0);
      context2d.drawImage(current.lifted, current.from.x + dx, current.from.y + dy);
      showSelection({ ...current.from, x: current.from.x + dx, y: current.from.y + dy });
    } else {
      context2d.putImageData(current.base, 0, 0);
      context2d.beginPath();
      if (tool === "line") {
        context2d.moveTo(current.x, current.y);
        context2d.lineTo(x, y);
      } else if (tool === "rect") {
        context2d.rect(current.x, current.y, x - current.x, y - current.y);
      } else {
        context2d.ellipse(
          (current.x + x) / 2,
          (current.y + y) / 2,
          Math.abs(x - current.x) / 2,
          Math.abs(y - current.y) / 2,
          0,
          0,
          Math.PI * 2,
        );
      }
      if (filled && tool !== "line") context2d.fill();
      context2d.stroke();
    }
  }

  function stop() {
    const current = drag.current;
    drag.current = null;
    if (current?.mode === "select") {
      const chosen = selection.current;
      if (!chosen || chosen.w < MIN_SELECTION || chosen.h < MIN_SELECTION) showSelection(null);
    }
    for (const which of [0, 1] as const) {
      const context2d = context(which);
      if (context2d) context2d.globalCompositeOperation = "source-over";
    }
  }

  async function save() {
    const a = back.current;
    const b = front.current;
    if (!a || !b || busy || !ready) return;
    setBusy(true);
    try {
      const flat = document.createElement("canvas");
      flat.width = SIDE;
      flat.height = SIDE;
      const context2d = flat.getContext("2d");
      if (!context2d) throw new Error("canvas unavailable");
      context2d.drawImage(a, 0, 0);
      context2d.drawImage(b, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => flat.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("canvas unavailable");
      onSave(await processKidsImage(blob));
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="kids-draw-art"
      aria-label={es ? "Dibujar imagen propia" : "Draw your own image"}
    >
      <h3>
        {kind === "explorer"
          ? es
            ? "Dibujá tu explorador"
            : "Draw your character"
          : es
            ? "Dibujá tu fondo"
            : "Draw your backdrop"}
      </h3>
      <p className="kids-note">
        {es
          ? "Dibujá con el dedo o el mouse. Tu dibujo queda solo en este dispositivo."
          : "Draw with your finger or mouse. Your drawing stays on this device."}
      </p>
      <div className="kids-draw-tools" role="group" aria-label={es ? "Herramientas" : "Tools"}>
        {TOOLS.map((item) => (
          <button
            key={item}
            type="button"
            className="kids-button"
            aria-pressed={tool === item}
            onClick={() => setTool(item)}
          >
            {TOOL_LABEL[item][es ? "es" : "en"]}
          </button>
        ))}
      </div>
      <div className="kids-draw-tools" role="group" aria-label={es ? "Capas" : "Layers"}>
        <button
          type="button"
          className="kids-button"
          aria-pressed={layer === 0}
          onClick={() => setLayer(0)}
        >
          {es ? "Capa de atrás" : "Back layer"}
        </button>
        <button
          type="button"
          className="kids-button"
          aria-pressed={layer === 1}
          onClick={() => setLayer(1)}
        >
          {es ? "Capa del frente" : "Front layer"}
        </button>
        <label>
          <input
            type="checkbox"
            checked={filled}
            onChange={(event) => setFilled(event.target.checked)}
          />{" "}
          {es ? "Formas rellenas" : "Filled shapes"}
        </label>
      </div>
      {tool === "text" ? (
        <label>
          {es ? "Palabra para estampar" : "Word to stamp"}
          <input
            type="text"
            maxLength={12}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
      ) : null}
      <div className="kids-draw-colors" role="group" aria-label={es ? "Colores" : "Colors"}>
        {COLORS.map((item) => (
          <button
            key={item}
            type="button"
            className="kids-draw-color"
            style={{ backgroundColor: item }}
            aria-label={`${es ? "Color" : "Color"} ${item}`}
            aria-pressed={color === item}
            onClick={() => setColor(item)}
          />
        ))}
      </div>
      <label className="kids-draw-brush">
        {es ? "Grosor" : "Brush size"}
        <input
          type="range"
          min="4"
          max="24"
          step="4"
          value={brush}
          onChange={(event) => setBrush(Number(event.target.value))}
        />
      </label>
      <div className="kids-draw-stack">
        <canvas
          ref={back}
          width={SIDE}
          height={SIDE}
          className="kids-draw-layer"
          aria-hidden="true"
        />
        <canvas
          ref={front}
          width={SIDE}
          height={SIDE}
          className="kids-draw-canvas"
          role="img"
          aria-label={es ? "Lienzo para dibujar" : "Drawing canvas"}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
        />
        <canvas
          ref={overlay}
          width={SIDE}
          height={SIDE}
          className="kids-draw-layer kids-draw-selection"
          aria-hidden="true"
        />
      </div>
      <div className="kids-draw-actions">
        <button
          type="button"
          className="kids-button"
          disabled={depth.undo === 0}
          onClick={() => travel(undoStack.current, redoStack.current)}
        >
          {es ? "Deshacer trazo" : "Undo stroke"}
        </button>
        <button
          type="button"
          className="kids-button"
          disabled={depth.redo === 0}
          onClick={() => travel(redoStack.current, undoStack.current)}
        >
          {es ? "Rehacer trazo" : "Redo stroke"}
        </button>
        <button type="button" className="kids-button" disabled={!ready} onClick={flip}>
          {es ? "Voltear dibujo" : "Flip drawing"}
        </button>
        <button type="button" className="kids-button" onClick={wipe}>
          {es ? "Borrar dibujo" : "Clear drawing"}
        </button>
        <button type="button" className="kids-button" onClick={onCancel}>
          {es ? "Cancelar" : "Cancel"}
        </button>
        <button
          type="button"
          className="kids-button kids-primary"
          disabled={busy || !ready}
          onClick={() => void save()}
        >
          {es ? "Guardar dibujo" : "Save drawing"}
        </button>
      </div>
    </section>
  );
}
