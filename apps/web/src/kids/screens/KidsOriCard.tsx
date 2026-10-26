import { useState } from "react";
import { KIDS_GRID } from "@agorix/curriculum";
import type { ProposalReview } from "@agorix/proposals";
import type { KidsOriOffer } from "../kidsOri.js";
import type { KidsText } from "../useKidsText.js";
import type { BandProfile } from "../kidsAgeBand.js";
import { KidsSprite } from "./KidsArt.js";
import { expressionForMotion, outcomeOfOffer } from "../kidsOriExpression.js";

interface Props {
  readonly t: KidsText;
  readonly locale: "es" | "en";
  readonly avatar: string;
  readonly goalGlyph: string;
  readonly offer: KidsOriOffer;
  readonly shape?: BandProfile["oriShape"] | undefined;
  readonly review?: ProposalReview | undefined;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onAccept: (inspected: boolean) => void;
  readonly onModify: (value: number, inspected: boolean) => void;
  readonly onReject: (inspected: boolean) => void;
}

function suggestedValue(offer: KidsOriOffer): number {
  const operation = offer.proposal?.operations[0];
  if (operation?.type !== "appendStatement") return 0;
  const statement = operation.statement;
  if (statement.type === "move") return statement.steps / KIDS_GRID.cellSize;
  if (statement.type === "repeat") return statement.count;
  if (statement.type === "turn") return statement.degrees;
  return 0;
}

export function KidsOriCard({
  t,
  locale,
  avatar,
  goalGlyph,
  offer,
  shape,
  review,
  open,
  onOpen,
  onAccept,
  onModify,
  onReject,
}: Props) {
  const suggested = suggestedValue(offer);
  const [choice, setChoice] = useState(suggested);
  const [inspected, setInspected] = useState(false);
  const canModify =
    offer.proposal?.operations.length === 1 &&
    (offer.kind === "move" || offer.kind === "repeat" || offer.kind === "turn");
  const choices =
    offer.kind === "turn" ? [-90, 90] : offer.kind === "repeat" ? [2, 3, 4, 5, 6] : [1, 2, 3, 4, 5];
  const labels = offer.proposal?.operations.flatMap((operation) => {
    if (operation.type !== "appendStatement") return [];
    const statement = operation.statement;
    if (statement.type === "turn") return [t(statement.degrees < 0 ? "turnL" : "turnR")];
    if (statement.type === "repeat") return [`${t("repeat")} ${statement.count}`];
    if (statement.type === "move") return [`${t("move")} ${statement.steps / KIDS_GRID.cellSize}`];
    return [];
  });
  const feedback =
    offer.kind === "done"
      ? t("oriWin")
      : offer.kind === "wall"
        ? t("oriFail")
        : offer.kind === "passed"
          ? t("passed", { g: goalGlyph })
          : t("oriIdle");
  const why =
    offer.kind === "move"
      ? t("whyMove", { s: avatar, g: goalGlyph, n: offer.amount ?? 0 })
      : offer.kind === "turn"
        ? t("whyTurn", { s: avatar, g: goalGlyph })
        : offer.kind === "repeat"
          ? t("whyRepeat", { n: offer.amount ?? 0 })
          : offer.kind === "wall"
            ? t("whyWall", { s: avatar })
            : offer.kind === "passed"
              ? t("whyPassed", { s: avatar })
              : t("whyWin");

  return (
    <aside className="kids-ori-card" aria-label="Ori" data-ori-shape={shape}>
      <KidsSprite
        slot="ori"
        expression={
          offer.proposal ? "curious" : expressionForMotion("observing", outcomeOfOffer(offer.kind))
        }
      />
      <div className="kids-ori-content">
        <strong>Ori · {offer.proposal ? t("oriIdle") : feedback}</strong>
        {!offer.proposal ? <p>{why}</p> : null}
        {offer.proposal && !open ? (
          <button type="button" className="kids-button" onClick={onOpen}>
            {t("proposal")}
          </button>
        ) : null}
        {offer.proposal && open ? (
          <div className="kids-ori-proposal">
            <strong>{t("oriSuggests")}</strong>
            <p>
              {t("wouldAdd")}: {labels?.join(", ")}
            </p>
            <p>
              <strong>{t("why")}</strong> {why}
            </p>
            <button type="button" className="kids-button" onClick={() => setInspected(true)}>
              {locale === "es" ? "Ver cambios" : "See changes"}
            </button>
            {inspected ? (
              <pre className="kids-ori-diff">
                {review?.diff.map((entry) => entry.afterText ?? "").join("\n")}
              </pre>
            ) : null}
            <p className="kids-note">{t("mayBeWrong")}</p>
            {canModify ? (
              <select
                aria-label={t("change")}
                value={choice}
                onChange={(event) => setChoice(Number(event.target.value))}
              >
                {choices.map((value) => (
                  <option key={value} value={value}>
                    {offer.kind === "turn" ? t(value < 0 ? "turnL" : "turnR") : value}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="kids-ori-actions">
              <button
                type="button"
                className="kids-button kids-primary"
                onClick={() => onAccept(inspected)}
              >
                {t("use")}
              </button>
              <button
                type="button"
                className="kids-button"
                disabled={!canModify || choice === suggested}
                onClick={() => onModify(choice, inspected)}
              >
                {t("change")}
              </button>
              <button type="button" className="kids-button" onClick={() => onReject(inspected)}>
                {t("noThanks")}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
