import { useEffect, useState, type ChangeEvent } from "react";
import { KidsSoundEditor } from "./KidsSoundEditor.js";
import { samplesFromChannels } from "../kidsSoundEdit.js";
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

export function KidsAudioPanel({ t, locale }: Props) {
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
