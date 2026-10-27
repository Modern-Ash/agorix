import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { KidsSoundEditor } from "./KidsSoundEditor.js";
import { samplesFromChannels } from "../kidsSoundEdit.js";
import {
  decodeKidsRecording,
  microphoneAllowed,
  RECORDING_MAX_MS,
  RecordingError,
  setMicrophoneAllowed,
  startKidsRecording,
  type KidsRecording,
} from "../kidsRecorder.js";
import { KIDS_AVATARS } from "../kidsState.js";
import { loadKidsCustom } from "../kidsCustom.js";
import {
  actorAudioKey,
  KidsAudioError,
  loadKidsAudio,
  removeKidsAudio,
  saveKidsAudio,
} from "../kidsAudio.js";
import type { KidsAvatarRef } from "../kidsProjects.js";
import type { KidsText } from "../useKidsText.js";
import { KIDS_GALLERY_CHARACTERS, galleryCharacterName } from "../kidsGallery.js";
import type { Locale } from "../../i18n.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
}

const MIC = {
  es: {
    title: "Grabar con el micrófono",
    allow: "Permitir grabar con el micrófono de este dispositivo",
    note: "Solo una persona adulta puede grabar, hasta 5 segundos. La voz no sale del dispositivo: se escucha y se edita antes de guardarla, y se puede quitar cuando quieras. Apagar este permiso saca los botones de grabar.",
    record: "Grabar a",
    stop: "Parar",
    recording: "Grabando",
    seconds: "s",
    denied: "El navegador no dio permiso para usar el micrófono.",
    unsupported: "Este dispositivo no puede grabar desde el navegador.",
    failed: "No pudimos grabar. Probá de nuevo.",
    empty: "No se grabó nada. Probá de nuevo.",
  },
  en: {
    title: "Record with the microphone",
    allow: "Allow recording with this device's microphone",
    note: "Only a grown-up can record, up to 5 seconds. The voice never leaves the device: it is heard and edited before it is saved, and it can be removed any time. Turning this off removes the record buttons.",
    record: "Record for",
    stop: "Stop",
    recording: "Recording",
    seconds: "s",
    denied: "The browser did not allow the microphone.",
    unsupported: "This device cannot record from the browser.",
    failed: "We couldn't record. Try again.",
    empty: "Nothing was recorded. Try again.",
  },
} as const;

export function KidsAudioPanel({ t, locale }: Props) {
  const mic = MIC[locale];
  const [micOn, setMicOn] = useState(() => microphoneAllowed());
  const [recording, setRecording] = useState<{
    readonly actor: KidsAvatarRef;
    readonly seconds: number;
  } | null>(null);
  const active = useRef<KidsRecording | null>(null);
  // Leaving the panel always lets go of the microphone.
  useEffect(() => () => active.current?.stop(), []);
  const actors: readonly KidsAvatarRef[] = [
    ...KIDS_AVATARS.map((value) => ({ kind: "emoji" as const, value })),
    ...KIDS_GALLERY_CHARACTERS.map((item) => ({ kind: "gallery" as const, id: item.id })),
    ...loadKidsCustom()
      .filter((item) => item.kind === "explorer")
      .map((item) => ({ kind: "custom" as const, id: item.id })),
  ];
  const [present, setPresent] = useState<ReadonlySet<string>>(new Set());
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<{
    readonly actor: KidsAvatarRef;
    readonly samples: Float32Array;
  } | null>(null);

  useEffect(() => {
    let live = true;
    void Promise.all(
      actors.map(async (actor) => {
        try {
          return (await loadKidsAudio(actor)) ? actorAudioKey(actor) : undefined;
        } catch {
          return undefined;
        }
      }),
    ).then((keys) => {
      if (live) setPresent(new Set(keys.filter((key): key is string => key !== undefined)));
    });
    return () => {
      live = false;
    };
  }, []);

  function name(actor: KidsAvatarRef): string {
    if (actor.kind === "emoji") return actor.value;
    if (actor.kind === "gallery") return galleryCharacterName(actor.id, locale);
    return `${t("customExplorer")} ${actor.id.slice(7)}`;
  }

  function failure(error: unknown): void {
    const code = error instanceof KidsAudioError ? error.code : "storageUnavailable";
    setMessage(
      t(
        code === "unsupportedType"
          ? "audioErrorType"
          : code === "tooLarge"
            ? "audioErrorSize"
            : code === "tooLong"
              ? "audioErrorLength"
              : code === "decodeFailed"
                ? "audioErrorDecode"
                : "audioErrorStorage",
      ),
    );
  }

  async function choose(actor: KidsAvatarRef, event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await saveKidsAudio(actor, file);
      setPresent((old) => new Set([...old, actorAudioKey(actor)]));
      setMessage(t("audioSaved"));
    } catch (error) {
      failure(error);
    } finally {
      event.target.value = "";
    }
  }

  async function edit(actor: KidsAvatarRef): Promise<void> {
    let context: AudioContext | undefined;
    try {
      const blob = await loadKidsAudio(actor);
      if (!blob) return;
      context = new AudioContext();
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      const channels = Array.from({ length: decoded.numberOfChannels }, (_value, index) =>
        decoded.getChannelData(index),
      );
      setEditing({ actor, samples: samplesFromChannels(channels, decoded.sampleRate) });
    } catch {
      setMessage(t("audioErrorDecode"));
    } finally {
      void context?.close().catch(() => undefined);
    }
  }

  async function saveEdited(actor: KidsAvatarRef, blob: Blob): Promise<void> {
    try {
      await saveKidsAudio(actor, blob);
      setEditing(null);
      setMessage(t("audioSaved"));
    } catch (error) {
      failure(error);
    }
  }

  async function record(actor: KidsAvatarRef): Promise<void> {
    if (active.current) return;
    setMessage("");
    try {
      const started = await startKidsRecording();
      active.current = started;
      const began = Date.now();
      setRecording({ actor, seconds: 0 });
      const tick = setInterval(
        () =>
          setRecording((now) =>
            now ? { ...now, seconds: Math.min(5, Math.floor((Date.now() - began) / 1000)) } : now,
          ),
        250,
      );
      try {
        const blob = await started.result;
        const samples = await decodeKidsRecording(blob);
        setEditing({ actor, samples });
      } finally {
        clearInterval(tick);
        active.current = null;
        setRecording(null);
      }
    } catch (error) {
      active.current = null;
      setRecording(null);
      if (error instanceof RecordingError) setMessage(mic[error.code]);
      else setMessage(t("audioErrorDecode"));
    }
  }

  async function remove(actor: KidsAvatarRef): Promise<void> {
    try {
      await removeKidsAudio(actor);
      setPresent((old) => new Set([...old].filter((key) => key !== actorAudioKey(actor))));
      setMessage(t("audioRemoved"));
    } catch (error) {
      failure(error);
    }
  }

  return (
    <section className="kids-adult-card kids-audio-panel" aria-labelledby="kids-audio-title">
      <h2 id="kids-audio-title">{t("customSounds")}</h2>
      <p>{t("customSoundsStay")}</p>
      <section aria-labelledby="kids-mic-title" className="kids-adult-mic">
        <h3 id="kids-mic-title">{mic.title}</h3>
        <label>
          <input
            type="checkbox"
            checked={micOn}
            onChange={(event) => {
              const next = event.target.checked;
              if (!next) active.current?.stop();
              setMicrophoneAllowed(next);
              setMicOn(next);
            }}
          />{" "}
          {mic.allow}
        </label>
        <p className="kids-note">{mic.note}</p>
        {recording ? (
          <p role="status" className="kids-note">
            {mic.recording}: {Math.max(0, Math.ceil(RECORDING_MAX_MS / 1000) - recording.seconds)}{" "}
            {mic.seconds}{" "}
            <button type="button" className="kids-button" onClick={() => active.current?.stop()}>
              {mic.stop}
            </button>
          </p>
        ) : null}
      </section>
      <div className="kids-images-list">
        {actors.map((actor) => {
          const key = actorAudioKey(actor);
          return (
            <div className="kids-image-row" key={key}>
              <strong>{name(actor)}</strong>
              <label className="kids-button kids-image-file">
                {t("chooseAudio")}
                <input
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/ogg"
                  aria-label={`${t("chooseAudio")} ${name(actor)}`}
                  onChange={(event) => void choose(actor, event)}
                />
              </label>
              {micOn && !recording ? (
                <button type="button" className="kids-button" onClick={() => void record(actor)}>
                  {mic.record} {name(actor)}
                </button>
              ) : null}
              {present.has(key) ? (
                <>
                  <button type="button" className="kids-button" onClick={() => void edit(actor)}>
                    {locale === "es" ? "Editar audio de" : "Edit audio for"} {name(actor)}
                  </button>
                  <button type="button" className="kids-button" onClick={() => void remove(actor)}>
                    {t("removeAudio")} {name(actor)}
                  </button>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      {editing ? (
        <KidsSoundEditor
          locale={locale}
          name={name(editing.actor)}
          samples={editing.samples}
          onSave={(blob) => void saveEdited(editing.actor, blob)}
          onCancel={() => setEditing(null)}
        />
      ) : null}
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
