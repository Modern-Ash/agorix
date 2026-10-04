import type { Locale } from "./i18n.js";
import { t } from "./i18n.js";
import { ProvenanceLabel } from "./ProvenanceLabel.js";

/** Inline preview of blocks a proposal would add. Not draggable, not focusable, never a drop target. */
export function GhostAddedBlocks({
  texts,
  locale,
}: {
  readonly texts: readonly string[];
  readonly locale: Locale;
}) {
  if (texts.length === 0) return null;
  return (
    <div className="ghost-added-list" data-testid="ghost-added">
      {texts.map((text, index) => (
        <div
          key={`${index}-${text}`}
          className="block-node block-card ghost-added"
          role="group"
          aria-label={t(locale, "ghostSuggested", { text })}
        >
          <ProvenanceLabel kind="suggestion" locale={locale} />
          <code>{text}</code>
        </div>
      ))}
    </div>
  );
}
