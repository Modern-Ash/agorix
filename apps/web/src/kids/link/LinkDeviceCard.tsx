import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../i18n.js";
import { isLinkApiError, type CreatedCode, type LinkApi } from "./linkApi.js";
import { formatCountdown, linkError, linkText } from "./linkCopy.js";

interface Props {
  readonly locale: Locale;
  readonly api: LinkApi;
  /** Called when a child device redeemed the code, so the device list can refresh. */
  readonly onLinked: () => void;
  readonly pollMs?: number;
}

/**
 * The adult's side of linking: a 6-digit code with a countdown. The code is held in memory only:
 * never in a URL, in storage or in the console.
 */
export function LinkDeviceCard({ locale, api, onLinked, pollMs = 3000 }: Props) {
  const [created, setCreated] = useState<CreatedCode | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const baseline = useRef(0);
  const t = (key: Parameters<typeof linkText>[1], values?: Record<string, string | number>) =>
    linkText(locale, key, values);

  const remaining = created === null ? 0 : Date.parse(created.expiresAt) - now;
  const live = created !== null && remaining > 0;
  const expired = created !== null && remaining <= 0 && !done;

  useEffect(() => {
    if (!live) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [live]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void api
        .listDevices()
        .then((devices) => {
          if (cancelled) return;
          const active = devices.filter((device) => device.unlinkedAt === undefined).length;
          if (active > baseline.current) {
            setDone(true);
            setCreated(null);
            onLinked();
          }
        })
        .catch(() => undefined);
    }, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [live, api, pollMs, onLinked]);

  async function make() {
    setBusy(true);
    setMessage("");
    setDone(false);
    try {
      const devices = await api.listDevices();
      baseline.current = devices.filter((device) => device.unlinkedAt === undefined).length;
      setCreated(await api.createCode());
      setNow(Date.now());
    } catch (error) {
      setMessage(linkError(locale, isLinkApiError(error) ? error.kind : "transient"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setCreated(null);
    try {
      await api.revokeCodes();
    } catch {
      // The code expires on its own in at most 10 minutes.
    }
  }

  return (
    <section className="kids-link-card" aria-labelledby="kids-link-device-title">
      <h3 id="kids-link-device-title">{t("linkTitle")}</h3>
      <p>{t("linkIntro")}</p>
      {live && created !== null ? (
        <>
          <output className="kids-link-code" aria-label={t("codeLabel")}>
            {created.code.split("").join(" ")}
          </output>
          <p className="kids-note" aria-live="off">
            {t("expiresIn", { time: formatCountdown(remaining) })}
          </p>
          <div className="kids-link-row">
            <button
              type="button"
              className="kids-button"
              disabled={busy}
              onClick={() => void make()}
            >
              {t("newCode")}
            </button>
            <button type="button" className="kids-button" onClick={() => void cancel()}>
              {t("cancelCode")}
            </button>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="kids-button kids-primary"
          disabled={busy}
          onClick={() => void make()}
        >
          {t("makeCode")}
        </button>
      )}
      <p role="status" className="kids-note">
        {done ? `✓ ${t("linked")}` : expired ? t("codeExpired") : message}
      </p>
    </section>
  );
}
