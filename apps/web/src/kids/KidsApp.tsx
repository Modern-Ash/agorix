import { useReducer } from "react";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/epilogue/latin-700.css";
import "@fontsource/epilogue/latin-800.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./kids.css";
import type { Locale } from "../i18n.js";
import { initialLocale, saveLocalePreference } from "../localePreference.js";
import {
  KIDS_AVATARS,
  KIDS_NAV_SCREENS,
  KIDS_WORLDS,
  initialKidsState,
  kidsReducer,
  type KidsScreen,
  type KidsState,
} from "./kidsState.js";
import { kidsTable, useKidsText } from "./useKidsText.js";

const NAV: readonly {
  readonly screen: KidsScreen;
  readonly label: "map" | "create" | "projects" | "grownups";
  readonly glyph: string;
}[] = [
  { screen: "map", label: "map", glyph: "🗺️" },
  { screen: "create", label: "create", glyph: "✨" },
  { screen: "projects", label: "projects", glyph: "📁" },
  { screen: "parents", label: "grownups", glyph: "🔒" },
];

export function KidsApp({ initialState }: { readonly initialState?: KidsState } = {}) {
  const [state, dispatch] = useReducer(
    kidsReducer,
    initialState ?? initialKidsState(initialLocale(undefined)),
  );
  const t = useKidsText(state.locale);
  const worlds = kidsTable(state.locale, "worlds");
  const showNav = KIDS_NAV_SCREENS.includes(state.screen);

  function chooseLocale(locale: Locale) {
    saveLocalePreference(locale);
    dispatch({ type: "setLocale", locale });
  }

  return (
    <div
      className="kids-root"
      lang={state.locale}
      data-screen={state.screen}
      data-testid="kids-root"
    >
      <main className="kids-frame">
        {state.screen === "onboard" ? (
          <section className="kids-screen" aria-labelledby="kids-title">
            <h1 id="kids-title">{t("hello")}</h1>
            {state.onboardStep === 0 ? (
              <>
                <p>{t("pickLang")}</p>
                <div className="kids-row" role="group" aria-label={t("pickLang")}>
                  {(["es", "en"] as const).map((locale) => (
                    <button
                      key={locale}
                      type="button"
                      className="kids-button"
                      aria-pressed={state.locale === locale}
                      onClick={() => chooseLocale(locale)}
                    >
                      {locale === "es" ? "Español" : "English"}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {state.onboardStep === 1 ? (
              <>
                <p>{t("pickAvatar")}</p>
                <p className="kids-note">{t("noName")}</p>
                <div className="kids-row" role="group" aria-label={t("pickAvatar")}>
                  {KIDS_AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      type="button"
                      className="kids-button kids-avatar"
                      aria-pressed={state.avatar === avatar}
                      onClick={() => dispatch({ type: "pickAvatar", avatar })}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {state.onboardStep === 2 ? (
              <>
                <p>{t("meetOri")}</p>
                <p className="kids-note">{t("meetOri2")}</p>
              </>
            ) : null}
            <button
              type="button"
              className="kids-button kids-primary"
              onClick={() => dispatch({ type: "onboardNext" })}
            >
              {state.onboardStep === 2 ? t("start") : t("next")}
            </button>
          </section>
        ) : (
          <section className="kids-screen" aria-labelledby="kids-title">
            <h1 id="kids-title">{screenTitle(state.screen, t)}</h1>
            {state.screen === "map" ? (
              <div className="kids-row" role="group" aria-label={t("map")}>
                {KIDS_WORLDS.map((world) => (
                  <button
                    key={world}
                    type="button"
                    className="kids-button"
                    aria-pressed={state.world === world}
                    onClick={() => dispatch({ type: "pickWorld", world })}
                  >
                    {worlds[world]}
                  </button>
                ))}
                <button
                  type="button"
                  className="kids-button kids-primary"
                  onClick={() =>
                    dispatch({ type: "pickMission", missionIndex: state.missionIndex })
                  }
                >
                  {t("play")}
                </button>
              </div>
            ) : null}
            {state.screen === "editor" ? (
              <button
                type="button"
                className="kids-button"
                onClick={() => dispatch({ type: "go", screen: "map" })}
              >
                {t("backMap")}
              </button>
            ) : null}
          </section>
        )}
      </main>
      {showNav ? (
        <nav className="kids-nav" aria-label={t("map")}>
          {NAV.map((item) => (
            <button
              key={item.screen}
              type="button"
              className="kids-nav-button"
              aria-current={state.screen === item.screen ? "page" : undefined}
              onClick={() => dispatch({ type: "go", screen: item.screen })}
            >
              <span aria-hidden="true">{item.glyph}</span>
              <span>{navLabel(item.label, t)}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function screenTitle(screen: KidsScreen, t: ReturnType<typeof useKidsText>): string {
  switch (screen) {
    case "map":
      return t("map");
    case "create":
      return t("create");
    case "projects":
      return t("projects");
    case "parents":
      return t("grownups");
    case "editor":
      return t("mission");
    case "reflect":
      return t("keepPlaying");
    case "onboard":
      return t("hello");
  }
}

function navLabel(
  label: "map" | "create" | "projects" | "grownups",
  t: ReturnType<typeof useKidsText>,
): string {
  return t(label);
}
