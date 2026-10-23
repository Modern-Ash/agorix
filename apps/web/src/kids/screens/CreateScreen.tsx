import { useState, type ChangeEvent } from "react";
import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { addKidsCustom, loadKidsCustom, type KidsCustomKind } from "../kidsCustom.js";
import { KidsImageError, processKidsImage } from "../kidsImage.js";
import { useKidsFlag } from "../kidsFlags.js";
import type { KidsAvatarRef, KidsWorldRef } from "../kidsProjects.js";
import { KidsBackdrop, KidsSprite, builtinWorld, emojiSlot } from "./KidsArt.js";
import { kidsTable, type KidsText } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import type { Locale } from "../../i18n.js";
import { ListenButton } from "./ListenButton.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly readAloud?: boolean;
  readonly onAvatar: (avatar: KidsAvatar) => void;
  readonly onWorld: (world: KidsWorld) => void;
  readonly onStart: (world: KidsWorldRef, avatar: KidsAvatarRef) => void;
}

export function CreateScreen({
  t,
  locale,
  avatar,
  world,
  readAloud = true,
  onAvatar,
  onWorld,
  onStart,
}: Props) {
  const worlds = kidsTable(locale, "worlds");
  const customEnabled = useKidsFlag("customImages");
  const [custom, setCustom] = useState(() => loadKidsCustom());
  const [imageMessage, setImageMessage] = useState("");
  const [chosenAvatar, setChosenAvatar] = useState<KidsAvatarRef>(emojiSlot(avatar));
  const [chosenWorld, setChosenWorld] = useState<KidsWorldRef>(builtinWorld(world));

  async function addImage(kind: KidsCustomKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = addKidsCustom(kind, await processKidsImage(file));
      if (!result.ok) {
        setImageMessage(
          t(
            result.reason === "limit"
              ? "customLimit"
              : result.reason === "invalidImage"
                ? "imageErrorType"
                : "imageErrorQuota",
          ),
        );
        return;
      }
      setCustom(loadKidsCustom());
      if (kind === "explorer") setChosenAvatar({ kind: "custom", id: result.item.id });
      else setChosenWorld({ kind: "custom", id: result.item.id });
      setImageMessage(t("imageSaved"));
    } catch (error) {
      const code = error instanceof KidsImageError ? error.code : "decodeFailed";
      setImageMessage(
        t(
          code === "unsupportedType"
            ? "imageErrorType"
            : code === "tooLarge"
              ? "imageErrorSize"
              : code === "outputTooLarge"
                ? "imageErrorOutput"
                : "imageErrorDecode",
        ),
      );
    } finally {
      event.target.value = "";
    }
  }
  return (
    <section className="kids-screen kids-create" aria-labelledby="kids-create-title">
      <h1 id="kids-create-title">{t("create")}</h1>
      <ListenButton t={t} locale={locale} enabled={readAloud} text={t("createNote")} />
      <p className="kids-note">{t("createNote")}</p>
      <h2>{t("createChar")}</h2>
      <div className="kids-create-choices">
        {KIDS_AVATARS.map((candidate) => (
          <button
            type="button"
            key={candidate}
            className="kids-button"
            aria-label={`${t("createChar")}: ${candidate}`}
            aria-pressed={chosenAvatar.kind === "emoji" && chosenAvatar.value === candidate}
            onClick={() => {
              setChosenAvatar(emojiSlot(candidate));
              onAvatar(candidate);
            }}
          >
            <KidsSprite slot={emojiSlot(candidate)} fallback={candidate} />
          </button>
        ))}
        {customEnabled &&
          custom
            .filter((item) => item.kind === "explorer")
            .map((item) => (
              <button
                type="button"
                className="kids-button kids-custom-choice"
                key={item.id}
                aria-label={`${t("customExplorer")} ${item.id.slice(7)}`}
                aria-pressed={chosenAvatar.kind === "custom" && chosenAvatar.id === item.id}
                onClick={() => setChosenAvatar({ kind: "custom", id: item.id })}
              >
                <KidsSprite slot={{ kind: "custom", id: item.id }} label={t("customExplorer")} />
              </button>
            ))}
        {customEnabled ? (
          <label className="kids-button kids-image-file kids-create-upload">
            {t("addCustomExplorer")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={t("addCustomExplorer")}
              onChange={(event) => void addImage("explorer", event)}
            />
          </label>
        ) : null}
      </div>
      <h2>{t("createBg")}</h2>
      <div className="kids-create-worlds">
        {KIDS_WORLDS.map((candidate) => (
          <button
            type="button"
            key={candidate}
            className="kids-button"
            aria-pressed={chosenWorld.kind === "builtin" && chosenWorld.value === candidate}
            style={{ background: KIDS_WORLD_STYLES[candidate].tint }}
            onClick={() => {
              setChosenWorld(builtinWorld(candidate));
              onWorld(candidate);
            }}
          >
            <KidsBackdrop
              world={builtinWorld(candidate)}
              fallbackBackground="transparent"
              className="kids-world-glyph"
            >
              {KIDS_WORLD_STYLES[candidate].character}
            </KidsBackdrop>{" "}
            {worlds[candidate]}
          </button>
        ))}
        {customEnabled &&
          custom
            .filter((item) => item.kind === "backdrop")
            .map((item) => (
              <button
                type="button"
                className="kids-button kids-custom-world"
                key={item.id}
                aria-label={`${t("customBackdrop")} ${item.id.slice(7)}`}
                aria-pressed={chosenWorld.kind === "custom" && chosenWorld.id === item.id}
                onClick={() => setChosenWorld({ kind: "custom", id: item.id })}
              >
                <KidsBackdrop
                  world={{ kind: "custom", id: item.id }}
                  className="kids-custom-world-thumb"
                />
                {t("customBackdrop")} {item.id.slice(7)}
              </button>
            ))}
        {customEnabled ? (
          <label className="kids-button kids-image-file kids-create-upload">
            {t("addCustomBackdrop")}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={t("addCustomBackdrop")}
              onChange={(event) => void addImage("backdrop", event)}
            />
          </label>
        ) : null}
      </div>
      {customEnabled ? <p className="kids-note">{t("imagesStay")}</p> : null}
      <p role="status" className="kids-note">
        {imageMessage}
      </p>
      <button
        type="button"
        className="kids-button kids-primary kids-create-start"
        onClick={() =>
          onStart(
            customEnabled || chosenWorld.kind === "builtin" ? chosenWorld : builtinWorld(world),
            customEnabled || chosenAvatar.kind === "emoji" ? chosenAvatar : emojiSlot(avatar),
          )
        }
      >
        {t("createStart")}
      </button>
    </section>
  );
}
