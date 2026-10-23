import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../../i18n.js";
import { AdultAccountCard, type EmailState } from "./AdultAccountCard.js";
import { LinkDeviceCard } from "./LinkDeviceCard.js";
import { LinkedDevicesCard } from "./LinkedDevicesCard.js";
import { ThisDeviceCard } from "./ThisDeviceCard.js";
import { loadLink, type LinkState } from "./kidsLink.js";
import { createLinkApi, type LinkApi } from "./linkApi.js";
import { linkText } from "./linkCopy.js";

interface Props {
  readonly locale: Locale;
  /** Injectable for tests; defaults to the same-origin client. */
  readonly api?: LinkApi;
}

/**
 * The whole optional feature, shown only inside the unlocked Adults panel. If the server does not
 * offer it, nothing renders at all, so local-only Kids looks exactly as before.
 */
export function LinkPanel({ locale, api: provided }: Props) {
  const api = useMemo(() => provided ?? createLinkApi(), [provided]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [session, setSession] = useState<{ alias: string } | null>(null);
  const [email, setEmail] = useState<EmailState | null>(null);
  const [link, setLink] = useState<LinkState | null>(() => loadLink());
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await api.available();
      if (cancelled) return;
      setAvailable(ok);
      if (!ok) return;
      try {
        const me = await api.restore();
        if (cancelled || me === null) return;
        setSession(me);
        setEmail(await api.emailStatus());
      } catch {
        // Not signed in: the sign-in form is shown.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!available) return null;

  return (
    <section className="kids-adult-card kids-link" aria-labelledby="kids-link-title">
      <h2 id="kids-link-title">{linkText(locale, "title")}</h2>
      <p>{linkText(locale, "intro")}</p>
      <details className="kids-link-privacy">
        <summary>{linkText(locale, "privacyTitle")}</summary>
        <p>{linkText(locale, "privacyNote")}</p>
      </details>
      <ThisDeviceCard locale={locale} api={api} link={link} onLink={setLink} />
      <AdultAccountCard
        locale={locale}
        api={api}
        session={session}
        email={email}
        onSession={setSession}
        onEmail={setEmail}
      />
      {session !== null && email?.verified ? (
        <>
          <LinkDeviceCard
            locale={locale}
            api={api}
            onLinked={() => setRefresh((value) => value + 1)}
          />
          <LinkedDevicesCard locale={locale} api={api} refreshKey={refresh} />
        </>
      ) : null}
    </section>
  );
}
