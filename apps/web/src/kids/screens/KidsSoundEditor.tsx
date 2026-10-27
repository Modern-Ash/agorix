import { useMemo, useRef, useState } from "react";
import type { Locale } from "../../i18n.js";
import {
  createSoundEditor,
  editSound,
  encodeWav,
  redoSound,
  SOUND_EDIT_RATE,
  soundSeconds,
  undoSound,
  waveformPeaks,
  type SoundEdit,
  type SoundEditorState,
} from "../kidsSoundEdit.js";

const COPY = {
  es: {
    title: "Editar audio de",
    duration: "Duración",
    seconds: "s",
    start: "Desde",
    end: "Hasta",
    trim: "Recortar",
    reverse: "Dar vuelta",
    louder: "Más fuerte",
    quieter: "Más suave",
    fadeIn: "Entrada suave",
    fadeOut: "Salida suave",
    faster: "Más rápido",
    slower: "Más lento",
    undo: "Deshacer",
    redo: "Rehacer",
    listen: "Escuchar",
    save: "Guardar cambios",
    cancel: "Cancelar",
    wave: "Forma de onda",
    note: "Los cambios se guardan solo en este dispositivo y se pueden deshacer.",
  },
  en: {
    title: "Edit audio for",
    duration: "Length",
    seconds: "s",
    start: "From",
    end: "To",
    trim: "Trim",
    reverse: "Reverse",
    louder: "Louder",
    quieter: "Softer",
    fadeIn: "Fade in",
    fadeOut: "Fade out",
    faster: "Faster",
    slower: "Slower",
    undo: "Undo",
    redo: "Redo",
    listen: "Listen",
    save: "Save changes",
    cancel: "Cancel",
    wave: "Waveform",
    note: "Changes stay on this device and can be undone.",
  },
} as const;

interface Props {
  readonly locale: Locale;
  readonly name: string;
  readonly samples: Float32Array;
  readonly onSave: (blob: Blob) => void;
  readonly onCancel: () => void;
}

export function KidsSoundEditor({ locale, name, samples, onSave, onCancel }: Props) {
  const copy = COPY[locale];
  const [state, setState] = useState<SoundEditorState>(() => createSoundEditor(samples));
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(100);
  const context = useRef<AudioContext | null>(null);
  const peaks = useMemo(() => waveformPeaks(state.present), [state.present]);

  function change(edit: SoundEdit) {
    setState((current) => editSound(current, edit));
    setFrom(0);
    setTo(100);
  }
  function listen() {
    try {
      void context.current?.close().catch(() => undefined);
      const audio = new AudioContext();
      context.current = audio;
      const buffer = audio.createBuffer(1, state.present.length, SOUND_EDIT_RATE);
      buffer.copyToChannel(Float32Array.from(state.present), 0);
      const source = audio.createBufferSource();
      source.buffer = buffer;
      source.connect(audio.destination);
      source.onended = () => void audio.close().catch(() => undefined);
      source.start();
    } catch {
      // A blocked speaker never changes the audio being edited.
    }
  }
  function stopAnd(action: () => void) {
    void context.current?.close().catch(() => undefined);
    action();
  }

  const length = state.present.length;
  const action = (label: string, edit: SoundEdit) => (
    <button type="button" className="kids-button" onClick={() => change(edit)}>
      {label}
    </button>
  );

  return (
    <section className="kids-adult-card kids-sound-editor" aria-label={`${copy.title} ${name}`}>
      <h3>
        {copy.title} {name}
      </h3>
      <svg
        role="img"
        aria-label={copy.wave}
        viewBox="0 0 96 32"
        className="kids-sound-wave"
        width="100%"
        height="64"
      >
        {peaks.map((peak, index) => (
          <line
            key={index}
            x1={index * 2 + 1}
            x2={index * 2 + 1}
            y1={16 - peak * 15}
            y2={16 + peak * 15}
            stroke="currentColor"
            strokeWidth="1.2"
          />
        ))}
      </svg>
      <p role="status" className="kids-note">
        {copy.duration}: {soundSeconds(state.present)} {copy.seconds}
      </p>
      <div>
        <label>
          {copy.start}{" "}
          <input
            type="range"
            min={0}
            max={95}
            value={from}
            onChange={(event) => setFrom(Math.min(Number(event.target.value), to - 5))}
          />
        </label>
        <label>
          {copy.end}{" "}
          <input
            type="range"
            min={5}
            max={100}
            value={to}
            onChange={(event) => setTo(Math.max(Number(event.target.value), from + 5))}
          />
        </label>
        {action(copy.trim, {
          kind: "trim",
          start: Math.floor((length * from) / 100),
          end: Math.floor((length * to) / 100),
        })}
      </div>
      <div>
        {action(copy.reverse, { kind: "reverse" })}
        {action(copy.louder, { kind: "louder" })}
        {action(copy.quieter, { kind: "quieter" })}
        {action(copy.fadeIn, { kind: "fadeIn" })}
        {action(copy.fadeOut, { kind: "fadeOut" })}
        {action(copy.faster, { kind: "faster" })}
        {action(copy.slower, { kind: "slower" })}
      </div>
      <div>
        <button
          type="button"
          className="kids-button"
          disabled={state.past.length === 0}
          onClick={() => setState(undoSound)}
        >
          {copy.undo}
        </button>
        <button
          type="button"
          className="kids-button"
          disabled={state.future.length === 0}
          onClick={() => setState(redoSound)}
        >
          {copy.redo}
        </button>
        <button type="button" className="kids-button" onClick={listen}>
          {copy.listen}
        </button>
        <button
          type="button"
          className="kids-button kids-primary"
          onClick={() => stopAnd(() => onSave(encodeWav(state.present)))}
        >
          {copy.save}
        </button>
        <button type="button" className="kids-button" onClick={() => stopAnd(onCancel)}>
          {copy.cancel}
        </button>
      </div>
      <p className="kids-note">{copy.note}</p>
    </section>
  );
}
