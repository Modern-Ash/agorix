import { useEffect, useMemo, useRef } from "react";
import type { AdultSettings } from "../kidsAdults.js";
import { readKidsEvidenceEvents } from "../kidsEvidence.js";
import type { KidsProgress } from "../kidsProgress.js";
import { KIDS_LINK_CHANGED_EVENT } from "./kidsLink.js";
import { createSyncScheduler, buildLinkSummary, syncOnce } from "./kidsSync.js";
import { readUsageDays } from "./kidsUsageDays.js";
import { createLinkApi } from "./linkApi.js";

/**
 * Quietly keeps a linked device's summary up to date. With no link it does nothing and makes no
 * network request, so a local-only child device never touches the link endpoints.
 */
export function useLinkSync(
  enabled: boolean,
  progress: KidsProgress,
  settings: AdultSettings,
): void {
  const latest = useRef({ progress, settings });
  latest.current = { progress, settings };

  const scheduler = useMemo(() => {
    if (!enabled) return null;
    const api = createLinkApi();
    return createSyncScheduler({
      run: () =>
        syncOnce({
          api,
          summary: () =>
            buildLinkSummary({
              progress: latest.current.progress,
              events: readKidsEvidenceEvents(),
              settings: latest.current.settings,
              usageDays: readUsageDays(),
            }),
        }),
    });
  }, [enabled]);

  useEffect(() => {
    scheduler?.request();
    return () => scheduler?.dispose();
  }, [scheduler]);

  const done = Object.keys(progress.done).length;
  useEffect(() => {
    scheduler?.request();
  }, [scheduler, done, settings.ageBand, settings.dailyLimitMinutes]);

  useEffect(() => {
    if (scheduler === null) return;
    const onChange = () => scheduler.request({ force: true });
    window.addEventListener(KIDS_LINK_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(KIDS_LINK_CHANGED_EVENT, onChange);
  }, [scheduler]);
}
