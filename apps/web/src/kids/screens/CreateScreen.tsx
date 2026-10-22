import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
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
  readonly onStart: () => void;
}

export function CreateScreen({ t, locale, avatar, world, onAvatar, onWorld, onStart }: Props) {
  const worlds = kidsTable(locale, "worlds");
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
            aria-pressed={avatar === candidate}
            onClick={() => onAvatar(candidate)}
          >
            {candidate}
          </button>
        ))}
      </div>
      <h2>{t("createBg")}</h2>
      <div className="kids-create-worlds">
        {KIDS_WORLDS.map((candidate) => (
          <button
            type="button"
            key={candidate}
            className="kids-button"
            aria-pressed={world === candidate}
            style={{ background: KIDS_WORLD_STYLES[candidate].tint }}
            onClick={() => onWorld(candidate)}
          >
            <span aria-hidden="true">{KIDS_WORLD_STYLES[candidate].character}</span>{" "}
            {worlds[candidate]}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="kids-button kids-primary kids-create-start"
        onClick={onStart}
      >
        {t("createStart")}
      </button>
    </section>
  );
}
