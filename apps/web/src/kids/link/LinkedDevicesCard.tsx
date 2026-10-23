import { useCallback, useEffect, useState } from "react";
import type { Locale } from "../../i18n.js";
import {
  isLinkApiError,
  type DeviceSummaryView,
  type LinkApi,
  type LinkedDevice,
} from "./linkApi.js";
import { linkError, linkText } from "./linkCopy.js";

interface Props {
  readonly locale: Locale;
  readonly api: LinkApi;
  /** Bump to reload (e.g. right after a device was linked). */
  readonly refreshKey: number;
}

/** What the adult sees about linked devices: the same aggregates the Adults panel shows. */
export function LinkedDevicesCard({ locale, api, refreshKey }: Props) {
  const [devices, setDevices] = useState<readonly LinkedDevice[] | null>(null);
  const [summaries, setSummaries] = useState<readonly DeviceSummaryView[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const t = (key: Parameters<typeof linkText>[1], values?: Record<string, string | number>) =>
    linkText(locale, key, values);

  const load = useCallback(async () => {
    try {
      const [list, sums] = await Promise.all([api.listDevices(), api.summaries()]);
      setDevices(list);
      setSummaries(sums);
    } catch (error) {
      setMessage(linkError(locale, isLinkApiError(error) ? error.kind : "transient"));
      setDevices((current) => current ?? []);
    }
  }, [api, locale]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function act(work: () => Promise<void>) {
    setMessage("");
    try {
      await work();
      await load();
    } catch (error) {
      setMessage(linkError(locale, isLinkApiError(error) ? error.kind : "transient"));
    }
  }

  return (
    <section className="kids-link-card" aria-labelledby="kids-link-devices-title">
      <h3 id="kids-link-devices-title">{t("devicesTitle")}</h3>
      {devices !== null && devices.length === 0 ? <p>{t("noDevices")}</p> : null}
      <ul className="kids-link-devices">
        {(devices ?? []).map((device, index) => {
          const summary = summaries.find((item) => item.linkId === device.linkId)?.summary;
          const unlinked = device.unlinkedAt !== undefined;
          return (
            <li key={device.linkId}>
              <h4>
                {index + 1} · {t("lastSeen", { day: device.lastSeenDay })}
              </h4>
              {unlinked ? (
                <p>{t("unlinkedOn", { day: (device.summaryDeletesAt ?? "").slice(0, 10) })}</p>
              ) : (
                <button
                  type="button"
                  className="kids-adult-switch"
                  role="switch"
                  aria-checked={device.syncEnabled}
                  aria-label={`${t("syncOn")} ${index + 1}`}
                  onClick={() => void act(() => api.setSync(device.linkId, !device.syncEnabled))}
                >
                  <span>
                    <strong>{t("syncOn")}</strong>
                    <small>{t("syncOnNote")}</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              )}
              <div className="kids-link-summary" aria-label={`${t("summaryTitle")} ${index + 1}`}>
                {summary === undefined ? (
                  <p>{t("noSummary")}</p>
                ) : (
                  <>
                    <p>{t("missions", { n: summary.completedMissions })}</p>
                    <p>
                      {t("concepts", {
                        a: summary.practicedConcepts[0],
                        b: summary.practicedConcepts[1],
                        c: summary.practicedConcepts[2],
                      })}
                    </p>
                    <p>
                      {t("oriDecisions", {
                        used: summary.decisions.used,
                        changed: summary.decisions.changed,
                        rejected: summary.decisions.rejected,
                      })}
                    </p>
                    {summary.minutesByDay.slice(-7).map((entry) => (
                      <p key={entry.day}>
                        {t("minutesLine", { day: entry.day, n: entry.minutes })}
                      </p>
                    ))}
                  </>
                )}
              </div>
              {unlinked ? null : confirming === device.linkId ? (
                <div role="alertdialog" aria-label={t("unlinkConfirm")} className="kids-link-row">
                  <strong>{t("unlinkConfirm")}</strong>
                  <button
                    type="button"
                    className="kids-button"
                    autoFocus
                    onClick={() => setConfirming(null)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="kids-button"
                    onClick={() => {
                      setConfirming(null);
                      void act(() => api.unlink(device.linkId));
                    }}
                  >
                    {t("unlinkYes")}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="kids-button"
                  aria-label={`${t("unlink")} ${index + 1}`}
                  onClick={() => setConfirming(device.linkId)}
                >
                  {t("unlink")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="kids-note">{t("retentionNote")}</p>
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
