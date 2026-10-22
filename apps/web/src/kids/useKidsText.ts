import { useMemo } from "react";
import type { Locale } from "../i18n.js";
import { kidsFormat } from "./format.js";
import { kidsStringsEn, kidsStringsEs, type KidsStringKey } from "./strings.js";

type Values = Readonly<Record<string, string | number>>;

/** Returns a `t(key, values)` for plain-string entries; nested tables use `kidsTable`. */
export function kidsText(locale: Locale) {
  const table = locale === "en" ? kidsStringsEn : kidsStringsEs;
  return (key: KidsStringKey, values?: Values): string => {
    const value = table[key];
    return typeof value === "string" ? kidsFormat(value, values) : key;
  };
}

export function kidsTable(
  locale: Locale,
  key: "worlds" | "chips",
): Readonly<Record<string, string>> {
  const table = locale === "en" ? kidsStringsEn : kidsStringsEs;
  return table[key] as Readonly<Record<string, string>>;
}

export type KidsText = ReturnType<typeof kidsText>;

export function useKidsText(locale: Locale) {
  return useMemo(() => kidsText(locale), [locale]);
}
