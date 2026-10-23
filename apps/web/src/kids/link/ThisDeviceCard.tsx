import { useState } from "react";
import type { Locale } from "../../i18n.js";
import { isLinkApiError, type LinkApi } from "./linkApi.js";
import { announceLinkChange, clearLink, loadLink, saveLink, type LinkState } from "./kidsLink.js";
import { linkError, linkText } from "./linkCopy.js";
import { clearUsageDays } from "./kidsUsageDays.js";

interface Props {
  readonly locale: Locale;
  readonly api: LinkApi;
  readonly link: LinkState | null;
  readonly onLink: (link: LinkState | null) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "✓"] as const;

/** The child device's side: enter the adult's code, then pause or stop sharing. */
export function ThisDeviceCard({ locale, api, link, onLink }: Props) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const t = (key: Parameters<typeof linkText>[1], values?: Record<string, string | number>) =>
    linkText(locale, key, values);

  function press(key: (typeof KEYS)[number]) {
    setMessage("");
    if (key === "⌫") setDigits((value) => value.slice(0, -1));
    else if (key === "✓") void redeem();
    else setDigits((value) => (value.length < 6 ? value + key : value));
  }

  async function redeem() {
    if (digits.length !== 6 || busy) return;
    setBusy(true);
    try {
      const { deviceToken } = await api.redeem(digits);
      const next: LinkState = { token: deviceToken, sharing: true };
      if (!saveLink(next)) {
        // Cannot keep it: release the link now so the adult does not see a ghost device.
        await api.unlinkSelf(deviceToken).catch(() => undefined);
        setMessage(t("storageBlocked"));
        return;
      }
      setDigits("");
      onLink(next);
      announceLinkChange();
    } catch (error) {
      setDigits("");
      // Wrong, expired or throttled all read the same to the child: ask the adult for a new code.
      setMessage(linkError(locale, isLinkApiError(error) ? error.kind : "transient"));
    } finally {
      setBusy(false);
    }
  }

  async function unlinkThis() {
    const current = loadLink();
    setBusy(true);
    setMessage("");
    try {
      if (current !== null) await api.unlinkSelf(current.token);
    } catch (error) {
      if (!isLinkApiError(error, "unauthenticated")) {
        setMessage(linkError(locale, isLinkApiError(error) ? error.kind : "transient"));
        setBusy(false);
        return;
      }
    }
    clearLink();
    clearUsageDays();
    onLink(null);
    announceLinkChange();
    setBusy(false);
  }

  function setSharing(sharing: boolean) {
    if (link === null) return;
    const next = { ...link, sharing };
    saveLink(next);
    onLink(next);
    announceLinkChange();
  }

  if (link !== null) {
    return (
      <section className="kids-link-card" aria-labelledby="kids-link-this-title">
        <h3 id="kids-link-this-title">{t("thisDeviceTitle")}</h3>
        <p>✓ {t("deviceLinked")}</p>
        <button
          type="button"
          className="kids-adult-switch"
          role="switch"
          aria-checked={link.sharing}
          onClick={() => setSharing(!link.sharing)}
        >
          <span>
            <strong>{t("shareProgress")}</strong>
            <small>{t("shareNote")}</small>
          </span>
          <i aria-hidden="true" />
        </button>
        <button
          type="button"
          className="kids-button"
          disabled={busy}
          onClick={() => void unlinkThis()}
        >
          {t("unlinkThis")}
        </button>
        <p role="status" className="kids-note">
          {message}
        </p>
      </section>
    );
  }

  return (
    <section className="kids-link-card" aria-labelledby="kids-link-this-title">
      <h3 id="kids-link-this-title">{t("thisDeviceTitle")}</h3>
      <p>{t("thisDeviceIntro")}</p>
      <output className="kids-gate-display" aria-label={t("enterCode")}>
        {digits.padEnd(6, "_").split("").join(" ")}
      </output>
      <div className="kids-gate-pad" role="group" aria-label={t("enterCode")}>
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={busy}
            aria-label={key === "✓" ? t("link") : key === "⌫" ? t("del") : key}
            onClick={() => press(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
