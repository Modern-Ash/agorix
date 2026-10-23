import { useState } from "react";
import type { ReflectionKind } from "@agorix/learning-evidence";
import type { KidsAvatar, KidsWorld } from "../kidsState.js";
import { recordKidsReflection } from "../kidsEvidence.js";
import type { KidsText } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import { listFreeProjectRefs } from "../kidsProjects.js";
import { KidsSprite, emojiSlot } from "./KidsArt.js";

interface Props {
  readonly t: KidsText;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly freeProjectId?: string | undefined;
  readonly prediction: "yes" | "no" | "dunno";
  readonly outcome: "success" | "wall" | "passed" | "short";
  readonly onKeepPlaying: () => void;
  readonly onNext: () => void;
}

export function ReflectScreen({
  t,
  avatar,
  world,
  freeProjectId,
  prediction,
  outcome,
  onKeepPlaying,
  onNext,
}: Props) {
  const [cause, setCause] = useState<ReflectionKind | null>(null);
  const [feeling, setFeeling] = useState<string | null>(null);
  const goal = KIDS_WORLD_STYLES[world].goalGlyph;
  const avatarArt =
    (freeProjectId
      ? listFreeProjectRefs().find((entry) => entry.id === freeProjectId)?.avatar
      : undefined) ?? emojiSlot(avatar);
  const matched =
    prediction === "dunno" ? null : (prediction === "yes") === (outcome === "success");

  function finish(next: () => void) {
    if (!cause || !feeling) return;
    recordKidsReflection(cause);
    next();
  }

  return (
    <section className="kids-screen kids-reflect" aria-labelledby="kids-reflect-title">
      <div className="kids-reflect-hero" aria-hidden="true">
        <KidsSprite
          slot={avatarArt}
          label={avatarArt.kind === "custom" ? t("customExplorer") : undefined}
        />{" "}
        ★ {goal}
      </div>
      <h1 id="kids-reflect-title">{t("reflectTitle", { s: avatar, g: goal })}</h1>
      <p>{t("reflectQ", { s: avatar })}</p>
      <div className="kids-reflect-choices" role="group" aria-label={t("reflectQ", { s: avatar })}>
        {(
          [
            ["intent", "move"],
            ["decision", "turnL"],
            ["verification", "repeat"],
          ] as const
        ).map(([kind, label]) => (
          <button
            type="button"
            key={kind}
            className="kids-button"
            aria-pressed={cause === kind}
            onClick={() => setCause(kind)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <p>{t("feel")}</p>
      <div className="kids-reflect-choices" role="group" aria-label={t("feel")}>
        {["😊", "😐", "😟"].map((face) => (
          <button
            type="button"
            key={face}
            className="kids-button"
            aria-label={face}
            aria-pressed={feeling === face}
            onClick={() => setFeeling(face)}
          >
            {face}
          </button>
        ))}
      </div>
      <p className="kids-reflect-prediction">
        {t("predLog")} {t(prediction)} {matched === null ? "·" : matched ? "✓" : "✗"}
      </p>
      <div className="kids-row">
        <button
          type="button"
          className="kids-button"
          disabled={!cause || !feeling}
          onClick={() => finish(onKeepPlaying)}
        >
          {t("keepPlaying")}
        </button>
        <button
          type="button"
          className="kids-button kids-primary"
          disabled={!cause || !feeling}
          onClick={() => finish(onNext)}
        >
          {t("nextMission")}
        </button>
      </div>
    </section>
  );
}
