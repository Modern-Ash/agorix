import type { Locale } from "../i18n.js";

/**
 * Navigation and onboarding state for Agorix Kids (issue #373). It holds **no program state**:
 * the program lives in the canonical program (`program-model`) and project data in `persistence`.
 */
export type KidsScreen =
  | "onboard"
  | "map"
  | "create"
  | "editor"
  | "advanced"
  | "advancedReact"
  | "advancedScore"
  | "reflect"
  | "projects"
  | "parents";
export type KidsWorld = "space" | "ocean" | "robots" | "city";

export const KIDS_AVATARS = ["🦊", "🐼", "🐸", "🦁", "🐨", "🦄"] as const;
export type KidsAvatar = (typeof KIDS_AVATARS)[number];

export const KIDS_WORLDS: readonly KidsWorld[] = ["space", "ocean", "robots", "city"];

/** Screens that show the bottom navigation (Map / Create / Projects / Grown-ups). */
export const KIDS_NAV_SCREENS: readonly KidsScreen[] = ["map", "create", "projects", "parents"];

export interface KidsState {
  readonly screen: KidsScreen;
  /** 0 language, 1 avatar, 2 meet Ori. */
  readonly onboardStep: 0 | 1 | 2;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  /** 0 to 2 are the missions; 3 is the free world. */
  readonly missionIndex: 0 | 1 | 2 | 3;
  /** ID of a free-world stored project; absent for curriculum missions. */
  readonly freeProjectId?: string | undefined;
}

export type KidsAction =
  | { readonly type: "go"; readonly screen: KidsScreen }
  | { readonly type: "onboardNext" }
  | { readonly type: "onboardBack" }
  | { readonly type: "setLocale"; readonly locale: Locale }
  | { readonly type: "pickAvatar"; readonly avatar: KidsAvatar }
  | { readonly type: "pickWorld"; readonly world: KidsWorld }
  | { readonly type: "pickMission"; readonly missionIndex: 0 | 1 | 2 | 3 }
  | { readonly type: "openAdvancedScene" }
  | { readonly type: "openAdvancedReact" }
  | { readonly type: "openAdvancedScore" }
  | {
      readonly type: "openSavedMission";
      readonly world: KidsWorld;
      readonly missionIndex: 0 | 1 | 2;
    }
  | {
      readonly type: "openFreeProject";
      readonly projectId: string;
      readonly world: KidsWorld;
      readonly avatar: KidsAvatar;
    };

export function initialKidsState(locale: Locale): KidsState {
  return {
    screen: "onboard",
    onboardStep: 0,
    locale,
    avatar: "🦊",
    world: "space",
    missionIndex: 0,
  };
}

export function kidsReducer(state: KidsState, action: KidsAction): KidsState {
  switch (action.type) {
    case "go":
      return { ...state, screen: action.screen };
    case "onboardNext":
      return state.onboardStep === 2
        ? { ...state, screen: "map", onboardStep: 0 }
        : { ...state, onboardStep: (state.onboardStep + 1) as 1 | 2 };
    case "onboardBack":
      return state.onboardStep === 0
        ? state
        : { ...state, onboardStep: (state.onboardStep - 1) as 0 | 1 };
    case "setLocale":
      return { ...state, locale: action.locale };
    case "pickAvatar":
      return { ...state, avatar: action.avatar };
    case "pickWorld":
      return { ...state, world: action.world };
    case "pickMission":
      return {
        ...state,
        missionIndex: action.missionIndex,
        freeProjectId: undefined,
        screen: "editor",
      };
    case "openAdvancedScene":
      return { ...state, screen: "advanced" };
    case "openAdvancedReact":
      return { ...state, screen: "advancedReact" };
    case "openAdvancedScore":
      return { ...state, screen: "advancedScore" };
    case "openSavedMission":
      return {
        ...state,
        world: action.world,
        missionIndex: action.missionIndex,
        freeProjectId: undefined,
        screen: "editor",
      };
    case "openFreeProject":
      return {
        ...state,
        world: action.world,
        avatar: action.avatar,
        missionIndex: 3,
        freeProjectId: action.projectId,
        screen: "editor",
      };
  }
}
