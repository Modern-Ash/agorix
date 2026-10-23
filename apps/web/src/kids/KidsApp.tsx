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
import {
  loadKidsProgress,
  markMissionDone,
  saveKidsProgress,
  type KidsProgress,
} from "./kidsProgress.js";
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
import { EditorScreen } from "./screens/EditorScreen.js";
import { CreateScreen } from "./screens/CreateScreen.js";
import { ProjectsScreen } from "./screens/ProjectsScreen.js";
import { ReflectScreen } from "./screens/ReflectScreen.js";
import { createFreeProjectRef } from "./kidsProjects.js";
import {
  addActiveSeconds,
  loadAdultSettings,
  localDay,
  saveAdultSettings,
  type AdultSettings,
} from "./kidsAdults.js";
import { ParentsScreen } from "./screens/ParentsScreen.js";
import { AdvancedSceneScreen } from "./screens/AdvancedSceneScreen.js";
import { AdvancedReactScreen } from "./screens/AdvancedReactScreen.js";
import { AdvancedScoreScreen } from "./screens/AdvancedScoreScreen.js";
import {
  advancedEntryUnlocked,
  advancedStageUnlocked,
  ensureAdvancedProject,
} from "./kidsAdvancedProgress.js";
import { ProjectStore } from "@agorix/persistence";
import { useKidsFlag } from "./kidsFlags.js";
import { tutorialVisible } from "./kidsTutorial.js";
import { VerifyLanding } from "./link/VerifyLanding.js";
import { useLinkSync } from "./link/useLinkSync.js";
import { bandProfile } from "./kidsAgeBand.js";
import { useKidsText, type KidsText } from "./useKidsText.js";
import { stopSpeaking } from "./speak.js";

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
  const scratchBlocks = useKidsFlag("puzzleShape");
  const tutorialEnabled = useKidsFlag("tutorial");
  const adultLinkEnabled = useKidsFlag("adultLink");
  const ageBandsEnabled = useKidsFlag("ageBands");
  const [progress, setProgress] = useState<KidsProgress>(
    () => initialProgress ?? loadKidsProgress(),
  );
  const [state, dispatch] = useReducer(
    kidsReducer,
    undefined,
    () => initialState ?? startingState(progress),
  );
  const [reflection, setReflection] = useState<{
    readonly prediction: "yes" | "no" | "dunno";
    readonly outcome: "success" | "wall" | "passed" | "short";
  } | null>(null);
  const [adultSettings, setAdultSettings] = useState<AdultSettings>(() => loadAdultSettings());
  const [projectStore] = useState(() => new ProjectStore());
  const t = useKidsText(state.locale);
  const showNav = KIDS_NAV_SCREENS.includes(state.screen);

  // The page language drives screen readers and speech; keep <html lang> in step with the choice.
  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);

  useEffect(() => {
    stopSpeaking();
    return stopSpeaking;
  }, [
    state.screen,
    state.onboardStep,
    state.locale,
    state.world,
    state.missionIndex,
    state.freeProjectId,
    adultSettings.readAloud,
  ]);

  useEffect(() => {
    let activeSince =
      document.visibilityState === "visible" && state.screen !== "parents" ? Date.now() : null;
    const checkpoint = () => {
      if (activeSince === null) return;
      const now = Date.now();
      addActiveSeconds((now - activeSince) / 1000, localDay(new Date(now)));
      activeSince =
        document.visibilityState === "visible" && state.screen !== "parents" ? now : null;
    };
    const onVisibility = () => {
      checkpoint();
      if (document.visibilityState === "visible" && state.screen !== "parents")
        activeSince = Date.now();
    };
    const interval = window.setInterval(checkpoint, 15_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", checkpoint);
    return () => {
      checkpoint();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", checkpoint);
    };
  }, [state.screen]);

  function chooseLocale(locale: Locale) {
    saveLocalePreference(locale);
    dispatch({ type: "setLocale", locale });
  }

  function chooseAvatar(avatar: KidsAvatar) {
    dispatch({ type: "pickAvatar", avatar });
    update({ ...progress, avatar });
  }

  useLinkSync(adultLinkEnabled, progress, adultSettings);

  function update(next: KidsProgress) {
    setProgress(next);
    saveKidsProgress(next);
  }

  function updateAdultSettings(next: AdultSettings) {
    setAdultSettings(next);
    saveAdultSettings(next);
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
      data-block-palette={scratchBlocks ? "scratch" : "default"}
      data-age-palette={ageBandsEnabled ? bandProfile(adultSettings.ageBand).palette : "warm"}
      data-age-band={ageBandsEnabled ? adultSettings.ageBand : undefined}
    >
      {ageBandsEnabled ? (
        <header className="kids-age-header">
          <span className="kids-band-chip">
            {adultSettings.ageBand === "6-8"
              ? "6–8"
              : adultSettings.ageBand === "9-12"
                ? "9–12"
                : "13+"}
          </span>
        </header>
      ) : null}
      {adultLinkEnabled ? <VerifyLanding locale={state.locale} /> : null}
      <main className="kids-frame">
        {state.screen === "onboard" ? (
          <OnboardScreen
            t={t}
            locale={state.locale}
            step={state.onboardStep}
            avatar={state.avatar}
            readAloud={adultSettings.readAloud}
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
            readAloud={adultSettings.readAloud}
            onWorld={(world) => dispatch({ type: "pickWorld", world })}
            onMission={(missionIndex) => dispatch({ type: "pickMission", missionIndex })}
            advancedUnlocked={advancedEntryUnlocked(projectStore)}
            advancedReactUnlocked={advancedStageUnlocked("react", projectStore)}
            advancedScoreUnlocked={advancedStageUnlocked("score", projectStore)}
            onAdvanced={() => {
              if (ensureAdvancedProject("scene", state.locale, projectStore))
                dispatch({ type: "openAdvancedScene" });
            }}
            onAdvancedReact={() => {
              if (ensureAdvancedProject("react", state.locale, projectStore))
                dispatch({ type: "openAdvancedReact" });
            }}
            onAdvancedScore={() => {
              if (ensureAdvancedProject("score", state.locale, projectStore))
                dispatch({ type: "openAdvancedScore" });
            }}
          />
        ) : state.screen === "editor" ? (
          <EditorScreen
            key={state.freeProjectId ?? `${state.world}:${state.missionIndex}`}
            t={t}
            locale={state.locale}
            world={state.world}
            avatar={state.avatar}
            missionIndex={state.missionIndex}
            freeProjectId={state.freeProjectId}
            oriSuggestions={adultSettings.oriSuggestions}
            readAloud={adultSettings.readAloud}
            ageBand={ageBandsEnabled ? adultSettings.ageBand : undefined}
            tutorial={
              tutorialVisible({
                enabled: tutorialEnabled,
                done: progress.tutorialDone === true,
                missionIndex: state.missionIndex,
                freeProject: state.freeProjectId !== undefined,
              })
                ? { onDone: () => update({ ...progress, tutorialDone: true }) }
                : undefined
            }
            onBack={() => dispatch({ type: "go", screen: "map" })}
            onComplete={() => {
              if (!state.freeProjectId)
                update(markMissionDone(progress, state.world, state.missionIndex));
            }}
            onReflect={(prediction, outcome) => {
              setReflection({ prediction, outcome });
              dispatch({ type: "go", screen: "reflect" });
            }}
          />
        ) : state.screen === "advanced" ? (
          <AdvancedSceneScreen
            locale={state.locale}
            readAloud={adultSettings.readAloud}
            onBack={() => dispatch({ type: "go", screen: "map" })}
          />
        ) : state.screen === "advancedReact" ? (
          <AdvancedReactScreen
            locale={state.locale}
            readAloud={adultSettings.readAloud}
            onBack={() => dispatch({ type: "go", screen: "map" })}
          />
        ) : state.screen === "advancedScore" ? (
          <AdvancedScoreScreen
            locale={state.locale}
            readAloud={adultSettings.readAloud}
            onBack={() => dispatch({ type: "go", screen: "map" })}
          />
        ) : state.screen === "create" ? (
          <CreateScreen
            t={t}
            locale={state.locale}
            avatar={state.avatar}
            world={state.world}
            readAloud={adultSettings.readAloud}
            onAvatar={chooseAvatar}
            onWorld={(world) => dispatch({ type: "pickWorld", world })}
            onStart={(world, avatar) => {
              const project = createFreeProjectRef(world, avatar);
              dispatch({
                type: "openFreeProject",
                projectId: project.id,
                world: world.kind === "builtin" ? world.value : "space",
                avatar: avatar.kind === "emoji" ? avatar.value : "🦊",
              });
            }}
          />
        ) : state.screen === "projects" ? (
          <ProjectsScreen
            t={t}
            locale={state.locale}
            avatar={state.avatar}
            world={state.world}
            readAloud={adultSettings.readAloud}
            onCreate={() => dispatch({ type: "go", screen: "create" })}
            onMission={(world, missionIndex) =>
              dispatch({ type: "openSavedMission", world, missionIndex })
            }
            onFree={(projectId, world, avatar) =>
              dispatch({ type: "openFreeProject", projectId, world, avatar })
            }
          />
        ) : state.screen === "reflect" && reflection ? (
          <ReflectScreen
            t={t}
            avatar={state.avatar}
            world={state.world}
            freeProjectId={state.freeProjectId}
            prediction={reflection.prediction}
            outcome={reflection.outcome}
            locale={state.locale}
            readAloud={adultSettings.readAloud}
            onKeepPlaying={() => dispatch({ type: "go", screen: "editor" })}
            onNext={() => dispatch({ type: "go", screen: "map" })}
          />
        ) : state.screen === "parents" ? (
          <ParentsScreen
            t={t}
            locale={state.locale}
            progress={progress}
            settings={adultSettings}
            onSettings={updateAdultSettings}
          />
        ) : (
          <section className="kids-screen" aria-labelledby="kids-title">
            <h1 id="kids-title">{screenTitle(state.screen, t)}</h1>
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
    case "advanced":
    case "advancedReact":
    case "advancedScore":
      return t("mission");
    case "reflect":
      return t("keepPlaying");
    case "onboard":
      return t("hello");
  }
}
