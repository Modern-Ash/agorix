import { useEffect, useRef, useState } from "react";
import type { ProjectAsset } from "@agorix/program-model";
import { MAX_EMBEDDED_SOUNDS } from "@agorix/program-model";
import {
  RECORDING_MAX_MS,
  RecordingError,
  decodeKidsRecording,
  microphoneAllowed,
  startKidsRecording,
  type KidsRecording,
} from "../kidsRecorder.js";
import { KidsSoundEditor } from "./KidsSoundEditor.js";

const COPY = {
  es: {
    title: "Mis grabaciones",
    record: "Grabar un sonido",
    recordTip: "Grabá hasta 5 segundos con el micrófono, y se queda solo en este aparato.",
    recording: "Grabando",
    seconds: "s",
    stop: "Parar",
    choose: "Elegir y escuchar",
    use: "Usar",
    full: "Ya tenés 8 grabaciones.",
    none: "Aún no grabaste nada.",
    failed: "No se pudo grabar.",
    unsupported: "Este aparato no puede grabar.",
    denied: "No se pudo usar el micrófono.",
    empty: "No se oyó nada. Probá de nuevo.",
    saved: "Grabación guardada en este proyecto.",
    name: "Mi grabación",
  },
  en: {
    title: "My recordings",
    record: "Record a sound",
    recordTip: "Record up to 5 seconds with the microphone. It stays on this device only.",
    recording: "Recording",
    seconds: "s",
    stop: "Stop",
    choose: "Choose and listen",
    use: "Use",
    full: "You already have 8 recordings.",
    none: "You have not recorded anything yet.",
    failed: "Could not record.",
    unsupported: "This device cannot record.",
    denied: "The microphone could not be used.",
    empty: "Nothing was heard. Try again.",
    saved: "Recording saved in this project.",
    name: "My recording",
  },
} as const;

/** WAV bytes as a data URL, read on the device. */
function dataUrlOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;,]*/, "data:audio/wav"));
    reader.onerror = () => reject(new Error("unreadable"));
    reader.readAsDataURL(blob);
  });
}

/**
 * The child's own recordings in the sound drawer (#1309). Recording needs the adult's switch (the
 * button is not shown without it) and the browser's own prompt. A recording is trimmed, then kept
 * in this project as a sound a block can play; it never leaves the device.
 */
export function KidsRecordedSounds({
  locale,
  sounds,
  value,
  onChoose,
  onUse,
  onSave,
}: {
  readonly locale: "es" | "en";
  readonly sounds: readonly ProjectAsset[];
  readonly value: string;
  /** Listen to a recording (and mark it as the chosen one). */
  readonly onChoose: (id: string) => void;
  /** Put the recording in a block. Without it each recording is only chosen. */
  readonly onUse?: (id: string) => void;
  /** Keeps the recording in the project; throws when it cannot. Without it nothing is recorded. */
  readonly onSave?: (wavDataUrl: string) => void;
}) {
  const copy = COPY[locale];
  const allowed = onSave !== undefined && microphoneAllowed();
  const [seconds, setSeconds] = useState<number | null>(null);
  const [samples, setSamples] = useState<Float32Array | null>(null);
  const [message, setMessage] = useState("");
  const active = useRef<KidsRecording | null>(null);
  useEffect(() => () => active.current?.stop(), []);

  async function record() {
    if (active.current) return;
    setMessage("");
    try {
      const started = await startKidsRecording();
      active.current = started;
      const began = Date.now();
      setSeconds(0);
      const tick = setInterval(
        () => setSeconds(Math.min(5, Math.floor((Date.now() - began) / 1000))),
        250,
      );
      try {
        setSamples(await decodeKidsRecording(await started.result));
      } finally {
        clearInterval(tick);
        active.current = null;
        setSeconds(null);
      }
    } catch (error) {
      active.current = null;
      setSeconds(null);
      setMessage(error instanceof RecordingError ? copy[error.code] : copy.failed);
    }
  }

  async function keep(blob: Blob) {
    try {
      onSave?.(await dataUrlOf(blob));
      setSamples(null);
      setMessage(copy.saved);
    } catch {
      setMessage(copy.failed);
    }
  }

  const full = sounds.length >= MAX_EMBEDDED_SOUNDS;
  return (
    <div className="kids-sound-picker" role="group" aria-label={copy.title}>
      <h3 className="kids-note">{copy.title}</h3>
      <ul className="kids-sound-picker-list">
        {sounds.map((sound) => (
          <li key={sound.id}>
            <button
              type="button"
              className="kids-button"
              aria-pressed={sound.id === value}
              aria-label={`${copy.choose} ${sound.name}`}
              onClick={() => onChoose(sound.id)}
            >
              {sound.name}
            </button>
            {onUse ? (
              <button
                type="button"
                className="kids-button"
                aria-label={`${copy.use} ${sound.name}`}
                onClick={() => onUse(sound.id)}
              >
                {copy.use}
              </button>
            ) : null}
          </li>
        ))}
        {sounds.length === 0 ? <li className="kids-note">{copy.none}</li> : null}
      </ul>
      {allowed && seconds === null ? (
        <button
          type="button"
          className="kids-button"
          data-testid="record-sound"
          title={copy.recordTip}
          disabled={full}
          onClick={() => void record()}
        >
          {copy.record}
        </button>
      ) : null}
      {full ? <p className="kids-note">{copy.full}</p> : null}
      {seconds !== null ? (
        <p role="status" className="kids-note" data-testid="recording-status">
          {copy.recording}: {Math.max(0, Math.ceil(RECORDING_MAX_MS / 1000) - seconds)}{" "}
          {copy.seconds}{" "}
          <button type="button" className="kids-button" onClick={() => active.current?.stop()}>
            {copy.stop}
          </button>
        </p>
      ) : null}
      {samples ? (
        <KidsSoundEditor
          locale={locale}
          name={copy.name}
          samples={samples}
          onSave={(blob) => void keep(blob)}
          onCancel={() => setSamples(null)}
        />
      ) : null}
      <p role="status" className="kids-note">
        {message}
      </p>
    </div>
  );
}
