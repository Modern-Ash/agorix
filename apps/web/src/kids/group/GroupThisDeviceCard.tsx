import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryEntry } from "@agorix/team-project";
import type { Locale } from "../../i18n.js";
import { isGroupApiError, type DeviceGroupView, type GroupApi } from "./groupApi.js";
import { groupError, groupText } from "./groupCopy.js";
import { clearGroupDevice, loadGroupDevice, saveGroupDevice } from "./groupDevice.js";
import type { HostReply } from "./team/teamHost.js";
import { GuestTeamLink } from "./team/teamLink.js";
import { GuestTeamPlay } from "./team/GroupPlayCard.js";

interface Props {
  readonly locale: Locale;
  readonly api: GroupApi;
  readonly pollMs?: number;
}

/**
 * The child device's side, operated by the organizing adult inside the unlocked Adults panel.
 * The child sees an alias and a team, never a roster, an account or any adult data.
 */
export function GroupThisDeviceCard({ locale, api, pollMs = 4000 }: Props) {
  const [token, setToken] = useState<string | null>(() => loadGroupDevice());
  const [view, setView] = useState<DeviceGroupView | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [offer, setOffer] = useState("");
  const [answer, setAnswer] = useState("");
  const [linkReady, setLinkReady] = useState(false);
  const [linked, setLinked] = useState(false);
  const [gallery, setGallery] = useState<readonly GalleryEntry[]>([]);
  const [opened, setOpened] = useState<number | null>(null);
  const [linkGeneration, setLinkGeneration] = useState(0);
  const guestRef = useRef<GuestTeamLink | null>(null);
  const t = (key: Parameters<typeof groupText>[1], values?: Record<string, string | number>) =>
    groupText(locale, key, values);

  const leave = useCallback(() => {
    guestRef.current?.close();
    guestRef.current = null;
    clearGroupDevice();
    setToken(null);
    setView(null);
    setOffer("");
    setAnswer("");
    setLinkReady(false);
    setLinked(false);
    setGallery([]);
    setOpened(null);
  }, []);

  useEffect(
    () => () => {
      guestRef.current?.close();
      guestRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (token === null) return;
    let cancelled = false;
    const refresh = () =>
      api
        .deviceView(token)
        .then((next) => {
          if (!cancelled) setView(next);
        })
        .catch((error: unknown) => {
          // The group closed, expired or removed this device: forget the key.
          if (!cancelled && isGroupApiError(error, "unauthenticated")) leave();
        });
    void refresh();
    const id = window.setInterval(() => void refresh(), pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [api, token, pollMs, leave]);

  async function join() {
    setMessage("");
    try {
      const joined = await api.join(code.trim());
      if (!saveGroupDevice(joined.deviceToken)) {
        setMessage(groupError(locale, "unavailable"));
        return;
      }
      setCode("");
      setToken(joined.deviceToken);
    } catch (error) {
      setMessage(isGroupApiError(error) ? groupError(locale, error.kind) : "");
    }
  }

  async function joinTeam() {
    setMessage("");
    const guest = new GuestTeamLink();
    guestRef.current?.close();
    guestRef.current = guest;
    try {
      setAnswer(await guest.join(offer.trim()));
      setLinkReady(true);
      setLinked(false);
      setGallery([]);
      setOpened(null);
      setLinkGeneration((value) => value + 1);
    } catch {
      setMessage(t("teamLinkError"));
      guest.close();
      guestRef.current = null;
    }
  }

  async function refreshGallery() {
    const guest = guestRef.current;
    if (guest === null) return;
    setMessage("");
    try {
      const reply = (await guest.request({ type: "gallery" })) as HostReply;
      if (reply.ok && reply.gallery !== undefined) {
        setGallery(reply.gallery);
        setLinked(true);
      } else setMessage(t("teamLinkError"));
    } catch {
      setMessage(t("teamLinkError"));
    }
  }

  async function openEntry(entryId: string) {
    const guest = guestRef.current;
    if (guest === null) return;
    setMessage("");
    try {
      const reply = (await guest.request({ type: "gallery-open", entryId })) as HostReply;
      if (reply.ok && reply.program !== undefined) setOpened(reply.program.scripts.length);
      else setMessage(t("teamLinkError"));
    } catch {
      setMessage(t("teamLinkError"));
    }
  }

  return (
    <section className="kids-link-card" aria-labelledby="kids-group-device-title">
      <h3 id="kids-group-device-title">{t("deviceTitle")}</h3>
      {token === null ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void join();
          }}
        >
          <p>{t("deviceIntro")}</p>
          <label>
            {t("joinCode")}
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              maxLength={6}
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <button type="submit" disabled={code.trim().length !== 6}>
            {t("join")}
          </button>
        </form>
      ) : (
        <>
          <p>{t("joined")}</p>
          {view !== null ? (
            <>
              <p>
                <strong>{t("yourAlias", { alias: view.alias })}</strong>
                {view.team !== undefined
                  ? ` · ${t("teamName", { n: Number(view.team.slice(-1)) })}`
                  : ""}
              </p>
              <p role="status">{view.status === "approved" ? t("ready") : t("waiting")}</p>
            </>
          ) : null}
          {view?.status === "approved" ? (
            <details className="kids-link-privacy">
              <summary>{t("teamJoinTitle")}</summary>
              <p>{t("teamJoinNote")}</p>
              {!linkReady ? (
                <>
                  <label>
                    {t("teamOfferLabel")}
                    <textarea
                      rows={3}
                      value={offer}
                      onChange={(event) => setOffer(event.target.value)}
                      spellCheck={false}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={offer.trim() === ""}
                    onClick={() => void joinTeam()}
                  >
                    {t("teamJoin")}
                  </button>
                </>
              ) : (
                <>
                  <p role="status">{t(linked ? "teamJoined" : "teamReplyReady")}</p>
                  <label>
                    {t("teamAnswerLabel")}
                    <textarea readOnly rows={3} value={answer} spellCheck={false} />
                  </label>
                  <button type="button" onClick={() => void refreshGallery()}>
                    {t("teamGallery")}
                  </button>
                  {gallery.length === 0 ? (
                    <p>{t("teamGalleryEmpty")}</p>
                  ) : (
                    <ul>
                      {gallery.map((entry) => (
                        <li key={entry.entryId}>
                          {t("teamGalleryEntry", {
                            v: entry.version,
                            who: entry.contributors.join(", "),
                          })}{" "}
                          <button type="button" onClick={() => void openEntry(entry.entryId)}>
                            {t("teamGalleryOpen")}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {opened !== null ? (
                    <output>{t("teamGalleryOpened", { n: opened })}</output>
                  ) : null}
                </>
              )}
            </details>
          ) : null}
          {linkReady && guestRef.current !== null ? (
            <GuestTeamPlay key={linkGeneration} locale={locale} link={guestRef.current} />
          ) : null}
          <button type="button" onClick={leave}>
            {t("leave")}
          </button>
          <small>{t("leaveNote")}</small>
        </>
      )}
      {message !== "" ? <p role="alert">{message}</p> : null}
    </section>
  );
}
