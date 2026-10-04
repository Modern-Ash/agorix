import type { Locale } from "./i18n.js";
import { t } from "./i18n.js";

export type CompanionMood = "resting" | "offering" | "reviewing";

export function companionMood(input: {
  readonly enabled: boolean;
  readonly hasOffer: boolean;
  readonly reviewing: boolean;
}): CompanionMood {
  if (!input.enabled) return "resting";
  if (input.reviewing) return "reviewing";
  return input.hasOffer ? "offering" : "resting";
}

/**
 * The Agorix Agent as a visible companion. Silence first: it rests by default and only shows
 * a bubble while an existing System-0 offer or a proposal review is active.
 */
export function AgentCompanion({
  locale,
  mood,
  message,
  enabled,
  onToggle,
}: {
  readonly locale: Locale;
  readonly mood: CompanionMood;
  readonly message?: string | undefined;
  readonly enabled: boolean;
  readonly onToggle: (next: boolean) => void;
}) {
  const bubble = !enabled
    ? t(locale, "agentOffNote")
    : mood !== "resting" && message !== undefined && message !== ""
      ? message
      : undefined;
  return (
    <figure className="agent-companion" data-mood={mood} data-agent-enabled={enabled}>
      <img className="agorix-agent-active" src="/brand/agorix-agent-active.svg" alt="" />
      <figcaption>{t(locale, "agentName")}</figcaption>
      <label className="agent-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
        />{" "}
        {t(locale, "agentHelps")}
      </label>
      <p role="status" aria-live="polite" className="agent-bubble">
        {bubble ?? ""}
      </p>
    </figure>
  );
}
