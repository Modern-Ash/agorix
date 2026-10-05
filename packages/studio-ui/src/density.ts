import type { Density } from "@agorix/studio-protocol";
import type { StudioUiCopy } from "./i18n.js";

/**
 * What a density change should tell the learner. Only a change the learner did not ask for
 * ("auto") is announced, and only when it actually changes the layout.
 */
export function densityAnnouncement(
  previous: Density,
  message: { readonly value: Density; readonly reason: "auto" | "setting" },
  copy: StudioUiCopy,
): string | undefined {
  if (message.reason !== "auto" || message.value === previous) return undefined;
  return message.value === "compact" ? copy.densityCompactNote : undefined;
}
