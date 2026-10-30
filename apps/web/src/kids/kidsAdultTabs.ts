import type { Locale } from "../i18n.js";

/** The grown-ups panel, split into four tabs instead of one long page (issue #1109). */
export const ADULT_TABS = ["summary", "settings", "customize", "account"] as const;
export type AdultTab = (typeof ADULT_TABS)[number];

interface TabCopy {
  /** Full name, always the accessible name of the tab. */
  readonly label: string;
  /** Shown instead of the full name on narrow phones; it starts the full name. */
  readonly short: string;
}

export const ADULT_TAB_COPY: Readonly<Record<Locale, Readonly<Record<AdultTab, TabCopy>>>> = {
  es: {
    summary: { label: "Resumen", short: "Resumen" },
    settings: { label: "Ajustes", short: "Ajustes" },
    customize: { label: "Personalizar", short: "Personalizar" },
    account: { label: "Cuenta y privacidad", short: "Cuenta" },
  },
  en: {
    summary: { label: "Summary", short: "Summary" },
    settings: { label: "Settings", short: "Settings" },
    customize: { label: "Customize", short: "Customize" },
    account: { label: "Account & privacy", short: "Account" },
  },
};

export const adultTabId = (tab: AdultTab) => `kids-adult-tab-${tab}`;
export const adultPanelId = (tab: AdultTab) => `kids-adult-panel-${tab}`;

/**
 * The tab a key moves to, following the WAI-ARIA tabs pattern: arrows wrap around, Home and End go
 * to the ends. Any other key keeps the current tab and returns null.
 */
export function adultTabForKey(current: AdultTab, key: string): AdultTab | null {
  const index = ADULT_TABS.indexOf(current);
  const last = ADULT_TABS.length - 1;
  switch (key) {
    case "ArrowRight":
      return ADULT_TABS[index === last ? 0 : index + 1]!;
    case "ArrowLeft":
      return ADULT_TABS[index === 0 ? last : index - 1]!;
    case "Home":
      return ADULT_TABS[0];
    case "End":
      return ADULT_TABS[last]!;
    default:
      return null;
  }
}
