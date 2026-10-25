import { useEffect, useMemo, useState } from "react";
import type { Locale } from "../../i18n.js";
import { GroupOrganizerCard } from "./GroupOrganizerCard.js";
import { GroupThisDeviceCard } from "./GroupThisDeviceCard.js";
import { createGroupApi, type GroupApi } from "./groupApi.js";
import { groupText } from "./groupCopy.js";

interface Props {
  readonly locale: Locale;
  /** Injectable for tests; defaults to the same-origin client. */
  readonly api?: GroupApi;
}

/**
 * The whole optional feature, shown only inside the unlocked Adults panel and only behind the
 * `groupMode` flag. If the server does not offer it, nothing renders, so local-only Kids looks
 * exactly as before.
 */
export function GroupPanel({ locale, api: provided }: Props) {
  const api = useMemo(() => provided ?? createGroupApi(), [provided]);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.available().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (!available) return null;

  return (
    <section className="kids-adult-card kids-link" aria-labelledby="kids-group-title">
      <h2 id="kids-group-title">{groupText(locale, "title")}</h2>
      <p>{groupText(locale, "intro")}</p>
      <details className="kids-link-privacy">
        <summary>{groupText(locale, "privacyTitle")}</summary>
        <p>{groupText(locale, "privacyNote")}</p>
      </details>
      <GroupOrganizerCard locale={locale} api={api} />
      <GroupThisDeviceCard locale={locale} api={api} />
    </section>
  );
}
