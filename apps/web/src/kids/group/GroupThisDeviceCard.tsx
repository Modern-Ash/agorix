import { useCallback, useEffect, useState } from "react";
import type { Locale } from "../../i18n.js";
import { isGroupApiError, type DeviceGroupView, type GroupApi } from "./groupApi.js";
import { groupError, groupText } from "./groupCopy.js";
import { clearGroupDevice, loadGroupDevice, saveGroupDevice } from "./groupDevice.js";

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
  const t = (key: Parameters<typeof groupText>[1], values?: Record<string, string | number>) =>
    groupText(locale, key, values);

  const leave = useCallback(() => {
    clearGroupDevice();
    setToken(null);
    setView(null);
  }, []);

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
