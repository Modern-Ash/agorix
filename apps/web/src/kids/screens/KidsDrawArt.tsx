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
type Tool = "brush" | "eraser" | "fill" | "line" | "rect" | "ellipse";
const TOOLS: readonly Tool[] = ["brush", "eraser", "fill", "line", "rect", "ellipse"];
const TOOL_LABEL: Record<Tool, { es: string; en: string }> = {
  brush: { es: "Pincel", en: "Brush" },
  eraser: { es: "Goma", en: "Eraser" },
  fill: { es: "Rellenar", en: "Fill" },
  line: { es: "Línea", en: "Line" },
  rect: { es: "Rectángulo", en: "Rectangle" },
  ellipse: { es: "Círculo", en: "Circle" },
};

interface Props {
  readonly kind: KidsCustomKind;
  readonly locale: Locale;
  readonly onSave: (dataUrl: string) => void;
  readonly onCancel: () => void;
  readonly onError: () => void;
  readonly initialImage?: string | undefined;
}

export function KidsDrawArt({ kind, locale, onSave, onCancel, onError, initialImage }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [brush, setBrush] = useState(8);
  const [tool, setTool] = useState<Tool>("brush");
  const undoStack = useRef<ImageData[]>([]);
  const redoStack = useRef<ImageData[]>([]);
  const origin = useRef<{ x: number; y: number; base: ImageData } | null>(null);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!initialImage);
  const es = locale === "es";

  function clear() {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, SIDE, SIDE);
    if (kind === "backdrop") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, SIDE, SIDE);
    }
  }

  function sync() {
    setDepth({ undo: undoStack.current.length, redo: redoStack.current.length });
  }

  function remember() {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    undoStack.current = pushSnapshot(
      undoStack.current,
      context.getImageData(0, 0, SIDE, SIDE),
      MAX_UNDO,
    );
    redoStack.current = [];
    sync();
  }

  function travel(from: ImageData[], to: ImageData[]) {
    const context = canvas.current?.getContext("2d");
    const snapshot = from.pop();
    if (!context || !snapshot) return;
    to.push(context.getImageData(0, 0, SIDE, SIDE));
    context.putImageData(snapshot, 0, 0);
    sync();
  }

  function wipe() {
    remember();
    clear();
  }

  function flip() {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context || !ready) return;
    remember();
    const copy = document.createElement("canvas");
    copy.width = SIDE;
    copy.height = SIDE;
    copy.getContext("2d")?.drawImage(element, 0, 0);
    context.save();
    context.clearRect(0, 0, SIDE, SIDE);
    context.translate(SIDE, 0);
    context.scale(-1, 1);
    context.drawImage(copy, 0, 0);
    context.restore();
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
      canvas.current?.getContext("2d")?.drawImage(image, 0, 0, SIDE, SIDE);
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

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (!ready) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    remember();
    if (tool === "fill") {
      const image = context.getImageData(0, 0, SIDE, SIDE);
      if (floodFill(image.data, SIDE, SIDE, x, y, hexToRgba(color)))
        context.putImageData(image, 0, 0);
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const erasing = tool === "eraser";
    const paint = erasing && kind === "backdrop" ? "#ffffff" : color;
    context.globalCompositeOperation =
      erasing && kind === "explorer" ? "destination-out" : "source-over";
    context.strokeStyle = paint;
    context.fillStyle = paint;
    context.lineWidth = brush;
    context.lineCap = "round";
    context.lineJoin = "round";
    if (tool === "brush" || erasing) {
      context.beginPath();
      context.arc(x, y, brush / 2, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x, y);
    } else {
      origin.current = { x, y, base: context.getImageData(0, 0, SIDE, SIDE) };
    }
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    const from = origin.current;
    if (!from) {
      context.lineTo(x, y);
      context.stroke();
      return;
    }
    context.putImageData(from.base, 0, 0);
    context.beginPath();
    if (tool === "line") {
      context.moveTo(from.x, from.y);
      context.lineTo(x, y);
    } else if (tool === "rect") {
      context.rect(from.x, from.y, x - from.x, y - from.y);
    } else {
      context.ellipse(
        (from.x + x) / 2,
        (from.y + y) / 2,
        Math.abs(x - from.x) / 2,
        Math.abs(y - from.y) / 2,
        0,
        0,
        Math.PI * 2,
      );
    }
    context.stroke();
  }

  function stop() {
    drawing.current = false;
    origin.current = null;
    const context = canvas.current?.getContext("2d");
    if (context) context.globalCompositeOperation = "source-over";
  }

  async function save() {
    const element = canvas.current;
    if (!element || busy || !ready) return;
    setBusy(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        element.toBlob(resolve, "image/png"),
      );
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
      <canvas
        ref={canvas}
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
