import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { Locale } from "../../i18n.js";
import type { KidsCustomKind } from "../kidsCustom.js";
import { processKidsImage } from "../kidsImage.js";

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

interface Props {
  readonly kind: KidsCustomKind;
  readonly locale: Locale;
  readonly onSave: (dataUrl: string) => void;
  readonly onCancel: () => void;
  readonly onError: () => void;
}

export function KidsDrawArt({ kind, locale, onSave, onCancel, onError }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [brush, setBrush] = useState(8);
  const [busy, setBusy] = useState(false);
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

  useEffect(() => {
    clear();
  }, [kind]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(SIDE, ((event.clientX - bounds.left) / bounds.width) * SIDE)),
      y: Math.max(0, Math.min(SIDE, ((event.clientY - bounds.top) / bounds.height) * SIDE)),
    };
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = point(event);
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = brush;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.arc(x, y, brush / 2, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x, y);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  }

  async function save() {
    const element = canvas.current;
    if (!element || busy) return;
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
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div className="kids-draw-actions">
        <button type="button" className="kids-button" onClick={clear}>
          {es ? "Borrar dibujo" : "Clear drawing"}
        </button>
        <button type="button" className="kids-button" onClick={onCancel}>
          {es ? "Cancelar" : "Cancel"}
        </button>
        <button
          type="button"
          className="kids-button kids-primary"
          disabled={busy}
          onClick={() => void save()}
        >
          {es ? "Guardar dibujo" : "Save drawing"}
        </button>
      </div>
    </section>
  );
}
