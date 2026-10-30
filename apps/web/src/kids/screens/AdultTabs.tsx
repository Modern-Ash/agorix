import type { KeyboardEvent, ReactNode } from "react";
import type { Locale } from "../../i18n.js";
import {
  ADULT_TABS,
  ADULT_TAB_COPY,
  adultPanelId,
  adultTabForKey,
  adultTabId,
  type AdultTab,
} from "../kidsAdultTabs.js";

interface Props {
  readonly locale: Locale;
  readonly current: AdultTab;
  readonly onSelect: (tab: AdultTab) => void;
}

/** The four grown-ups tabs. Only the current tab is in the Tab order; arrows move between them. */
export function AdultTabList({ locale, current, onSelect }: Props) {
  const copy = ADULT_TAB_COPY[locale];
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const next = adultTabForKey(current, event.key);
    if (!next) return;
    event.preventDefault();
    onSelect(next);
    document.getElementById(adultTabId(next))?.focus();
  }
  return (
    <div
      className="kids-adult-tabs"
      role="tablist"
      aria-label={locale === "es" ? "Secciones de Adultos" : "Grown-ups sections"}
      onKeyDown={onKeyDown}
    >
      {ADULT_TABS.map((tab) => {
        const selected = tab === current;
        const { label, short } = copy[tab];
        return (
          <button
            key={tab}
            id={adultTabId(tab)}
            type="button"
            role="tab"
            aria-selected={selected}
            // Only the shown panel exists, so only its tab points at it.
            aria-controls={selected ? adultPanelId(tab) : undefined}
            aria-label={label}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab)}
          >
            <span className="kids-adult-tab-long" aria-hidden="true">
              {label}
            </span>
            <span className="kids-adult-tab-short" aria-hidden="true">
              {short}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** One tab's panel. Hidden panels are not rendered, so they fetch and announce nothing. */
export function AdultTabPanel({
  tab,
  children,
}: {
  readonly tab: AdultTab;
  readonly children: ReactNode;
}) {
  return (
    <div
      className="kids-adult-panel"
      id={adultPanelId(tab)}
      role="tabpanel"
      aria-labelledby={adultTabId(tab)}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
