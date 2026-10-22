import { useEffect, useReducer, useState } from "react";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource/epilogue/latin-700.css";
import "@fontsource/epilogue/latin-800.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./kids.css";
import type { Locale } from "../i18n.js";
import { initialLocale, saveLocalePreference } from "../localePreference.js";
import { loadKidsProgress, saveKidsProgress, type KidsProgress } from "./kidsProgress.js";
import {
  KIDS_NAV_SCREENS,
  initialKidsState,
  type KidsAvatar,
  kidsReducer,
  type KidsScreen,
  type KidsState,
} from "./kidsState.js";
import { MapScreen } from "./screens/MapScreen.js";
import { OnboardScreen } from "./screens/OnboardScreen.js";
import { useKidsText, type KidsText } from "./useKidsText.js";

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

export function KidsApp({
  initialState,
  initialProgress,
}: { readonly initialState?: KidsState; readonly initialProgress?: KidsProgress } = {}) {
  const [progress, setProgress] = useState<KidsProgress>(
    () => initialProgress ?? loadKidsProgress(),
  );
  const [state, dispatch] = useReducer(
    kidsReducer,
    undefined,
    () => initialState ?? startingState(progress),
  );
  const t = useKidsText(state.locale);
  const showNav = KIDS_NAV_SCREENS.includes(state.screen);

  // The page language drives screen readers and speech; keep <html lang> in step with the choice.
  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  function chooseLocale(locale: Locale) {
    saveLocalePreference(locale);
    dispatch({ type: "setLocale", locale });
  }

  function chooseAvatar(avatar: KidsAvatar) {
    dispatch({ type: "pickAvatar", avatar });
    update({ ...progress, avatar });
  }

  function update(next: KidsProgress) {
    setProgress(next);
    saveKidsProgress(next);
  }

  function onboardNext() {
    if (state.onboardStep === 2) update({ ...progress, onboarded: true, avatar: state.avatar });
    dispatch({ type: "onboardNext" });
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
          <OnboardScreen
            t={t}
            locale={state.locale}
            step={state.onboardStep}
            avatar={state.avatar}
            onLocale={chooseLocale}
            onAvatar={chooseAvatar}
            onNext={onboardNext}
            onBack={() => dispatch({ type: "onboardBack" })}
          />
        ) : state.screen === "map" ? (
          <MapScreen
            t={t}
            locale={state.locale}
            avatar={state.avatar}
            world={state.world}
            progress={progress}
            onWorld={(world) => dispatch({ type: "pickWorld", world })}
            onMission={(missionIndex) => dispatch({ type: "pickMission", missionIndex })}
          />
        ) : (
          <section className="kids-screen" aria-labelledby="kids-title">
            <h1 id="kids-title">{screenTitle(state.screen, t)}</h1>
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
              <span>{t(item.label)}</span>
            </button>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function startingState(progress: KidsProgress): KidsState {
  const base = { ...initialKidsState(initialLocale(undefined)), avatar: progress.avatar };
  return progress.onboarded ? { ...base, screen: "map" } : base;
}

function screenTitle(screen: KidsScreen, t: KidsText): string {
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
