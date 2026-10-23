import { useState } from "react";
import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { loadKidsCustom } from "../kidsCustom.js";
import { useKidsFlag } from "../kidsFlags.js";
import type { KidsAvatarRef, KidsWorldRef } from "../kidsProjects.js";
import { KidsBackdrop, KidsSprite, builtinWorld, emojiSlot } from "./KidsArt.js";
import { kidsTable, type KidsText } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import type { Locale } from "../../i18n.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly onAvatar: (avatar: KidsAvatar) => void;
  readonly onWorld: (world: KidsWorld) => void;
  readonly onStart: (world: KidsWorldRef, avatar: KidsAvatarRef) => void;
  readonly onManageCustom?: () => void;
}

export function CreateScreen({
  t,
  locale,
  avatar,
  world,
  onAvatar,
  onWorld,
  onStart,
  onManageCustom,
}: Props) {
  const worlds = kidsTable(locale, "worlds");
  const customEnabled = useKidsFlag("customImages");
  const custom = customEnabled ? loadKidsCustom() : [];
  const [chosenAvatar, setChosenAvatar] = useState<KidsAvatarRef>(emojiSlot(avatar));
  const [chosenWorld, setChosenWorld] = useState<KidsWorldRef>(builtinWorld(world));
  return (
    <section className="kids-screen kids-create" aria-labelledby="kids-create-title">
      <h1 id="kids-create-title">{t("create")}</h1>
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
        {custom
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
          <button type="button" className="kids-button" onClick={onManageCustom}>
            {t("addCustomExplorer")}
          </button>
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
        {custom
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
          <button type="button" className="kids-button" onClick={onManageCustom}>
            {t("addCustomBackdrop")}
          </button>
        ) : null}
      </div>
      {customEnabled ? <p className="kids-note">{t("customAdultHint")}</p> : null}
      <button
        type="button"
        className="kids-button kids-primary kids-create-start"
        onClick={() => onStart(chosenWorld, chosenAvatar)}
      >
        {t("createStart")}
      </button>
    </section>
  );
}
