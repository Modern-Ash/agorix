import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
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
  type KidsWorld,
} from "./kidsState.js";
import { MapScreen } from "./screens/MapScreen.js";
import { OnboardScreen } from "./screens/OnboardScreen.js";
import { CreateScreen } from "./screens/CreateScreen.js";
import { ProjectsScreen } from "./screens/ProjectsScreen.js";
import { routeHash, stateFromHash, type KidsRouteLookup } from "./kidsRoute.js";
import {
  addActiveSeconds,
  loadAdultSettings,
  localDay,
  saveAdultSettings,
  type AdultSettings,
} from "./kidsAdults.js";
import { ParentsScreen } from "./screens/ParentsScreen.js";
import type { AdultTab } from "./kidsAdultTabs.js";
import { AdvancedSceneScreen } from "./screens/AdvancedSceneScreen.js";
import { AdvancedReactScreen } from "./screens/AdvancedReactScreen.js";
import { AdvancedScoreScreen } from "./screens/AdvancedScoreScreen.js";
import { AdvancedControlScreen } from "./screens/AdvancedControlScreen.js";
import {
  advancedEntryUnlocked,
  advancedStageUnlocked,
  ensureAdvancedProject,
} from "./kidsAdvancedProgress.js";
import { ProjectStore } from "@agorix/persistence";
import { useKidsCatalogState } from "./kidsCatalog.js";
import { useKidsFlag } from "./kidsFlags.js";
import { VerifyLanding } from "./link/VerifyLanding.js";
import { useLinkSync } from "./link/useLinkSync.js";
import { bandProfile, type AgeBand } from "./kidsAgeBand.js";
import { useKidsText, type KidsText } from "./useKidsText.js";
import { stopSpeaking } from "./speak.js";
import { KidsOriGuide } from "./screens/KidsOriGuide.js";
import { KidsStudioScreen } from "./screens/KidsStudioScreen.js";
import { ensureMissionStudio, missionOfStudio } from "./kidsMissionStudio.js";
import {
  addStudioArt,
  createStudioProject,
  deleteStudioProject,
  listStudioProjects,
} from "./kidsStudioProjects.js";

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
  const adultLinkEnabled = useKidsFlag("adultLink");
  const ageBandsEnabled = useKidsFlag("ageBands");
  const [progress, setProgress] = useState<KidsProgress>(
    () => initialProgress ?? loadKidsProgress(),
  );
  const [state, dispatch] = useReducer(
    kidsReducer,
    undefined,
    () => initialState ?? stateFromLocation(startingState(progress), progress),
  );
  const [adultSettings, setAdultSettings] = useState<AdultSettings>(() => loadAdultSettings());
  // The age-band notice can be put away for this visit; nothing is stored, so it returns next time.
  const [bandAskClosed, setBandAskClosed] = useState(false);

  // Which grown-ups tab opens after the gate: a shortcut lands on the tab it is about (#1109).
  const [adultTab, setAdultTab] = useState<AdultTab>("summary");
  // Crear can open the scene straight on the drawing canvas (own character or backdrop).
  const [studioDraw, setStudioDraw] = useState<"costume" | "backdrop" | undefined>(undefined);
  const openAdults = (tab: AdultTab) => {
    setAdultTab(tab);
    dispatch({ type: "go", screen: "parents" });
  };
  const [projectStore] = useState(() => new ProjectStore());
  const t = useKidsText(state.locale);
  const showNav = KIDS_NAV_SCREENS.includes(state.screen);

  // The address follows the screen and the screen follows Back, Forward and reloads (issue #596).
  const routed = useRef(false);
  useEffect(() => {
    const hash = routeHash(state);
    if (hash === null || window.location.hash === hash) {
      routed.current = true;
      return;
    }
    if (routed.current) window.history.pushState(null, "", hash);
    else window.history.replaceState(null, "", hash);
    routed.current = true;
  }, [state]);
  useEffect(() => {
    const follow = () => {
      if (!progress.onboarded) return;
      if (window.location.pathname === "/" && !window.location.hash) {
        dispatch({ type: "restore", state: { ...state, screen: "onboard", onboardStep: 0 } });
        return;
      }
      const next = stateFromHash(window.location.hash, state, routeLookup());
      if (next) dispatch({ type: "restore", state: next });
      else dispatch({ type: "go", screen: "map" });
    };
    window.addEventListener("popstate", follow);
    return () => window.removeEventListener("popstate", follow);
  }, [state, progress.onboarded]);

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

  // Text size follows the band for the whole Kids area; the browser's own size comes back on leaving.
  const fontScale = ageBandsEnabled ? bandProfile(adultSettings.ageBand).fontScale : 1;
  useEffect(() => {
    const root = document.documentElement;
    const before = root.style.fontSize;
    root.style.fontSize = fontScale === 1 ? before : `${fontScale * 100}%`;
    return () => {
      root.style.fontSize = before;
    };
  }, [fontScale]);

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
      style={
        ageBandsEnabled
          ? ({
              "--kids-min-target": `${bandProfile(adultSettings.ageBand).minTarget}px`,
            } as CSSProperties)
          : undefined
      }
    >
      {ageBandsEnabled &&
      progress.onboarded &&
      !adultSettings.bandChosen &&
      !bandAskClosed &&
      state.screen === "map" ? (
        <aside className="kids-band-ask" role="note">
          <p>
            {state.locale === "es"
              ? "Una persona adulta tiene que elegir la franja de edad para ajustar la herramienta. No pedimos fecha de nacimiento."
              : "A grown-up needs to pick the age band to fit the tool. We never ask for a birth date."}
          </p>
          <button type="button" className="kids-button" onClick={() => openAdults("settings")}>
            {state.locale === "es" ? "Elegir la franja de edad" : "Pick the age band"}
          </button>
          <button
            type="button"
            className="kids-round"
            aria-label={state.locale === "es" ? "Cerrar aviso" : "Close notice"}
            onClick={() => setBandAskClosed(true)}
          >
            <span aria-hidden="true">×</span>
          </button>
        </aside>
      ) : null}
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
            {...(progress.onboarded
              ? { onContinue: () => dispatch({ type: "go", screen: "map" }) }
              : {})}
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
            onCreate={() => dispatch({ type: "go", screen: "create" })}
            onMission={(missionIndex) => dispatch({ type: "pickMission", missionIndex })}
            advancedUnlocked={advancedEntryUnlocked(projectStore)}
            advancedReactUnlocked={advancedStageUnlocked("react", projectStore)}
            advancedScoreUnlocked={advancedStageUnlocked("score", projectStore)}
            advancedControlUnlocked={advancedStageUnlocked("control", projectStore)}
            advancedMessageUnlocked={advancedStageUnlocked("message", projectStore)}
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
            onAdvancedControl={() => {
              if (ensureAdvancedProject("control", state.locale, projectStore))
                dispatch({ type: "openAdvancedControl" });
            }}
            onAdvancedMessage={() => {
              if (ensureAdvancedProject("message", state.locale, projectStore))
                dispatch({ type: "openAdvancedMessage" });
            }}
          />
        ) : state.screen === "editor" ? (
          <MissionStudioEntry
            key={`${state.world}:${state.missionIndex}:${state.avatar}`}
            world={state.world}
            missionIndex={state.missionIndex}
            avatar={state.avatar}
            locale={state.locale}
            oriSuggestions={adultSettings.oriSuggestions}
            readAloud={adultSettings.readAloud}
            ageBand={ageBandsEnabled ? adultSettings.ageBand : undefined}
            onBack={() => dispatch({ type: "go", screen: "map" })}
            onComplete={() => update(markMissionDone(progress, state.world, state.missionIndex))}
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
        ) : state.screen === "advancedControl" || state.screen === "advancedMessage" ? (
          <AdvancedControlScreen
            stage={state.screen === "advancedControl" ? "control" : "message"}
            locale={state.locale}
            readAloud={adultSettings.readAloud}
            onBack={() => dispatch({ type: "go", screen: "map" })}
          />
        ) : state.screen === "studio" && state.studioProjectId ? (
          <KidsStudioScreen
            key={state.studioProjectId}
            id={state.studioProjectId}
            locale={state.locale}
            oriSuggestions={adultSettings.oriSuggestions}
            ageBand={ageBandsEnabled ? adultSettings.ageBand : undefined}
            initialDraw={studioDraw}
            onBack={() => dispatch({ type: "go", screen: "create" })}
          />
        ) : state.screen === "create" ? (
          <CreateScreen
            t={t}
            locale={state.locale}
            avatar={state.avatar}
            world={state.world}
            readAloud={adultSettings.readAloud}
            onStudio={(characterId, backdropId, draw, upload) => {
              let project: ReturnType<typeof createStudioProject> | undefined;
              try {
                project = createStudioProject(characterId, backdropId, state.locale, projectStore);
                if (upload)
                  addStudioArt(
                    project.id,
                    upload.kind,
                    `actor:studio-1-${characterId}`,
                    upload.dataUrl,
                    state.locale,
                    projectStore,
                  );
              } catch {
                if (project) deleteStudioProject(project.id, projectStore);
                return false;
              }
              setStudioDraw(draw);
              dispatch({ type: "openStudio", projectId: project.id });
              return true;
            }}
          />
        ) : state.screen === "projects" ? (
          <ProjectsScreen
            t={t}
            locale={state.locale}
            readAloud={adultSettings.readAloud}
            onCreate={() => dispatch({ type: "go", screen: "create" })}
            onStudio={(projectId) => {
              const mission = missionOfStudio(projectId);
              if (mission)
                dispatch({
                  type: "openSavedMission",
                  world: mission.world,
                  missionIndex: mission.index,
                });
              else dispatch({ type: "openStudio", projectId });
            }}
          />
        ) : state.screen === "parents" ? (
          <ParentsScreen
            t={t}
            locale={state.locale}
            progress={progress}
            settings={adultSettings}
            onSettings={updateAdultSettings}
            initialTab={adultTab}
          />
        ) : (
          <section className="kids-screen" aria-labelledby="kids-title">
            <h1 id="kids-title">{screenTitle(state.screen, t)}</h1>
          </section>
        )}
      </main>
      {adultSettings.oriSuggestions && state.screen !== "editor" && state.screen !== "studio" ? (
        <KidsOriGuide screen={state.screen} locale={state.locale} aboveNav={showNav} />
      ) : null}
      {showNav ? (
        <nav className="kids-nav" aria-label={t("map")}>
          {NAV.map((item) => (
            <button
              key={item.screen}
              type="button"
              className="kids-nav-button"
              aria-current={state.screen === item.screen ? "page" : undefined}
              onClick={() =>
                item.screen === "parents"
                  ? openAdults("summary")
                  : dispatch({ type: "go", screen: item.screen })
              }
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

function MissionStudioEntry({
  world,
  missionIndex,
  avatar,
  locale,
  oriSuggestions,
  readAloud,
  ageBand,
  onBack,
  onComplete,
}: {
  readonly world: KidsWorld;
  readonly missionIndex: 0 | 1 | 2;
  readonly avatar: KidsAvatar;
  readonly locale: Locale;
  readonly oriSuggestions: boolean;
  readonly readAloud: boolean;
  readonly ageBand?: AgeBand | undefined;
  readonly onBack: () => void;
  readonly onComplete: () => void;
}) {
  // The published missions set the start and goal, so the scene waits for them (or for the built-in).
  const { catalog, ready } = useKidsCatalogState();
  const sceneId = useMemo(
    () =>
      ready
        ? ensureMissionStudio(world, missionIndex, avatar, locale, undefined, undefined, catalog)
        : null,
    [ready, catalog, world, missionIndex, avatar, locale],
  );
  if (!ready) return null;
  return sceneId ? (
    <KidsStudioScreen
      id={sceneId}
      locale={locale}
      oriSuggestions={oriSuggestions}
      readAloud={readAloud}
      ageBand={ageBand}
      mission={{ world, index: missionIndex, catalog, onComplete }}
      onBack={onBack}
    />
  ) : (
    <section className="kids-screen" role="alert">
      <p>
        {locale === "es"
          ? "No se pudo abrir la misión. Probá de nuevo desde el mapa."
          : "The mission could not open. Try again from the map."}
      </p>
      <button type="button" className="kids-button" onClick={onBack}>
        {locale === "es" ? "Volver al mapa" : "Back to map"}
      </button>
    </section>
  );
}

function routeLookup(): KidsRouteLookup {
  return {
    studioProject: (id) => listStudioProjects().some((item) => item.id === id),
    missionOfStudio,
  };
}

/** A reload on a deep link opens that screen once the child is onboarded. */
function stateFromLocation(start: KidsState, progress: KidsProgress): KidsState {
  if (!progress.onboarded || typeof window === "undefined") return start;
  return stateFromHash(window.location.hash, start, routeLookup()) ?? start;
}

function startingState(progress: KidsProgress): KidsState {
  const base = { ...initialKidsState(initialLocale(undefined)), avatar: progress.avatar };
  const returningAtEntry =
    typeof window !== "undefined" && window.location.pathname === "/" && !window.location.hash;
  return progress.onboarded && !returningAtEntry ? { ...base, screen: "map" } : base;
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
    case "studio":
      return t("mission");
    case "advanced":
    case "advancedReact":
    case "advancedScore":
    case "advancedControl":
    case "advancedMessage":
      return t("mission");
    case "reflect":
      return t("keepPlaying");
    case "onboard":
      return t("hello");
  }
}
