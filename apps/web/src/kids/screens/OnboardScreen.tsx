import type { Locale } from "../../i18n.js";
import { KIDS_AVATARS, type KidsAvatar } from "../kidsState.js";
import { speak } from "../speak.js";
import type { KidsText } from "../useKidsText.js";
import { KidsSprite, emojiSlot } from "./KidsArt.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly step: 0 | 1 | 2;
  readonly avatar: KidsAvatar;
  readonly readAloud?: boolean;
  readonly onLocale: (locale: Locale) => void;
  readonly onAvatar: (avatar: KidsAvatar) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

function Listen({ t, text, locale }: { t: KidsText; text: string; locale: Locale }) {
  return (
    <button
      type="button"
      className="kids-round"
      aria-label={t("listen")}
      onClick={() => speak(text, locale)}
    >
      <span aria-hidden="true">🔊</span>
    </button>
  );
}

/** Three steps: language, avatar, meet Ori. No name and no account (prototype `onboard`). */
export function OnboardScreen({
  t,
  locale,
  step,
  avatar,
  readAloud = true,
  onLocale,
  onAvatar,
  onNext,
  onBack,
}: Props) {
  return (
    <section className="kids-onboard" aria-labelledby="kids-title">
      <ol className="kids-dots" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <li
            key={index}
            className={
              index === step ? "kids-dot current" : index < step ? "kids-dot past" : "kids-dot"
            }
          />
        ))}
      </ol>

      {step === 0 ? (
        <div className="kids-onboard-body">
          <KidsSprite slot="ori" className="kids-ori-badge">
            <i />
            <i />
          </KidsSprite>
          <div className="kids-title-row">
            <h1 id="kids-title">{t("hello")}</h1>
            {readAloud ? (
              <Listen t={t} locale={locale} text={`${t("hello")} ${t("pickLang")}`} />
            ) : null}
          </div>
          <p className="kids-lead">{t("pickLang")}</p>
          <div className="kids-lang-row" role="group" aria-label={t("pickLang")}>
            {(["es", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className="kids-lang-card"
                aria-pressed={locale === option}
                onClick={() => onLocale(option)}
              >
                <strong aria-hidden="true">{option.toUpperCase()}</strong>
                <span>{option === "es" ? "Español" : "English"}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="kids-onboard-body">
          <div className="kids-title-row">
            <h1 id="kids-title">{t("pickAvatar")}</h1>
            {readAloud ? (
              <Listen t={t} locale={locale} text={`${t("pickAvatar")}. ${t("noName")}`} />
            ) : null}
          </div>
          <div className="kids-avatar-grid" role="group" aria-label={t("pickAvatar")}>
            {KIDS_AVATARS.map((option) => (
              <button
                key={option}
                type="button"
                className="kids-avatar-card"
                aria-label={option}
                aria-pressed={avatar === option}
                onClick={() => onAvatar(option)}
              >
                <KidsSprite slot={emojiSlot(option)} fallback={option} />
              </button>
            ))}
          </div>
          <p className="kids-pill">
            <span aria-hidden="true">🔒</span> {t("noName")}
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="kids-onboard-body">
          <h1 id="kids-title" className="kids-visually-hidden">
            {t("oriOn")}
          </h1>
          <div className="kids-meet">
            <KidsSprite slot="ori" className="kids-ori-badge small">
              <i />
              <i />
            </KidsSprite>
            <KidsSprite slot={emojiSlot(avatar)} className="kids-avatar-mini" />
          </div>
          <div className="kids-bubbles">
            <p className="kids-bubble strong">{t("meetOri")}</p>
            <p className="kids-bubble">{t("meetOri2")}</p>
          </div>
          {readAloud ? (
            <button
              type="button"
              className="kids-pill-button"
              onClick={() => speak(`${t("meetOri")} ${t("meetOri2")}`, locale)}
            >
              <span aria-hidden="true">🔊</span> {t("listen")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="kids-onboard-actions">
        {step > 0 ? (
          <button type="button" className="kids-back" aria-label={t("back")} onClick={onBack}>
            <span aria-hidden="true">←</span>
          </button>
        ) : null}
        <button type="button" className="kids-next" onClick={onNext}>
          {step === 2 ? t("start") : t("next")}
        </button>
      </div>
    </section>
  );
}
