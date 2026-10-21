import type { Locale } from "./i18n.js";

/** Product default locale (issue #351). `DEFAULT_LOCALE` stays the missing-key fallback. */
export const APP_DEFAULT_LOCALE: Locale = "es";
export const LOCALE_PREFERENCE_KEY = "agorix.locale";

function defaultStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function isLocale(value: unknown): value is Locale {
  return value === "es" || value === "en";
}

export function loadLocalePreference(
  storage: Storage | undefined = defaultStorage(),
): Locale | undefined {
  try {
    const value = storage?.getItem(LOCALE_PREFERENCE_KEY);
    return isLocale(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export function saveLocalePreference(
  locale: Locale,
  storage: Storage | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(LOCALE_PREFERENCE_KEY, locale);
  } catch {
    // Storage can be blocked; the preference is a convenience only.
  }
}

/** Project locale, then the remembered choice, then Spanish. */
export function initialLocale(
  projectLocale: string | undefined,
  storage: Storage | undefined = defaultStorage(),
  fallback: Locale = APP_DEFAULT_LOCALE,
): Locale {
  if (isLocale(projectLocale)) return projectLocale;
  return loadLocalePreference(storage) ?? fallback;
}
