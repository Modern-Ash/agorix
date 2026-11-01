import { useEffect, useReducer, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
import { EditorScreen } from "./screens/EditorScreen.js";
import { CreateScreen } from "./screens/CreateScreen.js";
import { ProjectsScreen } from "./screens/ProjectsScreen.js";
import { ReflectScreen } from "./screens/ReflectScreen.js";
import { convertFreeProject } from "./kidsFreeToScene.js";
import { createFreeProjectRef, listFreeProjectRefs } from "./kidsProjects.js";
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
import { kidsFlagNow, useKidsFlag } from "./kidsFlags.js";
import { tutorialVisible } from "./kidsTutorial.js";
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
  const tutorialEnabled = useKidsFlag("tutorial");
  const freeToScene = useKidsFlag("freeToScene");
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
  const [reflection, setReflection] = useState<{
    readonly prediction: "yes" | "no" | "dunno";
    readonly outcome: "success" | "wall" | "passed" | "short";
  } | null>(null);
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
      const next = stateFromHash(window.location.hash, state, routeLookup(state.locale));
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
            key={`${state.world}:${state.missionIndex}:${state.avatar}:${state.freeProjectId ?? "mission"}`}
            world={state.world}
            missionIndex={state.missionIndex}
            avatar={state.avatar}
            locale={state.locale}
            freeProjectId={state.freeProjectId}
            oriSuggestions={adultSettings.oriSuggestions}
            readAloud={adultSettings.readAloud}
            ageBand={ageBandsEnabled ? adultSettings.ageBand : undefined}
            onBack={() => dispatch({ type: "go", screen: "map" })}
            onComplete={() => {
              if (!state.freeProjectId)
                update(markMissionDone(progress, state.world, state.missionIndex));
            }}
          >
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
              onOpenAdults={() => openAdults("account")}
              onComplete={() => {
                if (!state.freeProjectId)
                  update(markMissionDone(progress, state.world, state.missionIndex));
              }}
              onReflect={(prediction, outcome) => {
                setReflection({ prediction, outcome });
                dispatch({ type: "go", screen: "reflect" });
              }}
            />
          </MissionStudioEntry>
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
            onAvatar={chooseAvatar}
            onWorld={(world) => dispatch({ type: "pickWorld", world })}
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
            onFree={(projectId, world, avatar) => {
              // An old single-explorer project opens as a scene when it converts without loss (#1134).
              const converted = freeToScene
                ? convertFreeProject(projectId, state.locale, projectStore)
                : null;
              if (converted?.kind === "scene")
                dispatch({ type: "openStudio", projectId: converted.studioId });
              else dispatch({ type: "openFreeProject", projectId, world, avatar });
            }}
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
  freeProjectId,
  oriSuggestions,
  readAloud,
  ageBand,
  onBack,
  onComplete,
  children,
}: {
  readonly world: KidsWorld;
  readonly missionIndex: 0 | 1 | 2 | 3;
  readonly avatar: KidsAvatar;
  readonly locale: Locale;
  readonly freeProjectId?: string | undefined;
  readonly oriSuggestions: boolean;
  readonly readAloud: boolean;
  readonly ageBand?: AgeBand | undefined;
  readonly onBack: () => void;
  readonly onComplete: () => void;
  readonly children: ReactNode;
}) {
  const [sceneId] = useState(() =>
    freeProjectId || missionIndex === 3 || !kidsFlagNow("fullMissionStudio")
      ? null
      : ensureMissionStudio(world, missionIndex as 0 | 1 | 2, avatar, locale),
  );
  return sceneId ? (
    <KidsStudioScreen
      id={sceneId}
      locale={locale}
      oriSuggestions={oriSuggestions}
      readAloud={readAloud}
      ageBand={ageBand}
      mission={{ world, index: missionIndex as 0 | 1 | 2, onComplete }}
      onBack={onBack}
    />
  ) : (
    children
  );
}

function routeLookup(locale: Locale): KidsRouteLookup {
  return {
    freeProject: (id) => {
      const found = listFreeProjectRefs().find((item) => item.id === id);
      if (!found) return null;
      return {
        world: found.world.kind === "builtin" ? found.world.value : "space",
        avatar: found.avatar.kind === "emoji" ? found.avatar.value : "🦊",
      };
    },
    studioProject: (id) => listStudioProjects().some((item) => item.id === id),
    missionOfStudio,
    sceneOfFree: (id) => {
      if (!kidsFlagNow("freeToScene")) return null;
      const result = convertFreeProject(id, locale);
      return result.kind === "scene" ? result.studioId : null;
    },
  };
}

/** A reload on a deep link opens that screen once the child is onboarded. */
function stateFromLocation(start: KidsState, progress: KidsProgress): KidsState {
  if (!progress.onboarded || typeof window === "undefined") return start;
  return stateFromHash(window.location.hash, start, routeLookup(start.locale)) ?? start;
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
