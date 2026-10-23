import { useEffect, useId, useState, type FormEvent } from "react";
import type { Locale } from "../../i18n.js";
import { isLinkApiError, type LinkApi } from "./linkApi.js";
import { linkError, linkText } from "./linkCopy.js";

export interface EmailState {
  readonly present: boolean;
  readonly verified: boolean;
}

interface Props {
  readonly locale: Locale;
  readonly api: LinkApi;
  readonly session: { readonly alias: string } | null;
  readonly email: EmailState | null;
  readonly onSession: (session: { alias: string } | null) => void;
  readonly onEmail: (email: EmailState | null) => void;
}

const RESEND_COOLDOWN_S = 60;

/** Adult sign-up and sign-in with an email. Lives only inside the Adults panel (behind the gate). */
export function AdultAccountCard({ locale, api, session, email, onSession, onEmail }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const t = (key: Parameters<typeof linkText>[1], values?: Record<string, string | number>) =>
    linkText(locale, key, values);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      setMessage(linkError(locale, isLinkApiError(error) ? error.kind : "transient"));
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const me =
        mode === "create"
          ? await api.register(alias.trim(), password, address.trim())
          : await api.signIn(alias.trim(), password);
      onSession(me);
      setPassword("");
      setAddress("");
      onEmail(await api.emailStatus());
      if (mode === "create") setCooldown(RESEND_COOLDOWN_S);
    });
  }

  if (session === null) {
    return (
      <section className="kids-link-card" aria-labelledby="kids-link-account-title">
        <h3 id="kids-link-account-title">{t("adultTitle")}</h3>
        <div role="group" aria-label={t("adultTitle")} className="kids-link-tabs">
          {(["signin", "create"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className="kids-button"
              aria-pressed={mode === item}
              onClick={() => {
                setMode(item);
                setMessage("");
              }}
            >
              {item === "signin" ? t("signIn") : t("createAccount")}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="kids-link-form">
          <label>
            {t("alias")}
            <input
              value={alias}
              onChange={(event) => setAlias(event.target.value)}
              autoComplete="username"
              required
              maxLength={64}
            />
          </label>
          <div className="kids-link-field">
            <label htmlFor={`${uid}-password`}>{t("password")}</label>
            <span className="kids-link-password">
              <input
                id={`${uid}-password`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={reveal ? "text" : "password"}
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                required
                maxLength={256}
              />
              <button
                type="button"
                className="kids-button"
                aria-pressed={reveal}
                aria-label={reveal ? t("hidePassword") : t("showPassword")}
                onClick={() => setReveal(!reveal)}
              >
                {reveal ? "🙈" : "👁"}
              </button>
            </span>
          </div>
          {mode === "create" ? (
            <label>
              {t("email")}
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
              <small>{t("emailNote")}</small>
            </label>
          ) : null}
          <button type="submit" className="kids-button kids-primary" disabled={busy}>
            {mode === "create" ? t("submitCreate") : t("submitSignIn")}
          </button>
        </form>
        <p role="status" className="kids-note">
          {message}
        </p>
      </section>
    );
  }

  return (
    <section className="kids-link-card" aria-labelledby="kids-link-account-title">
      <h3 id="kids-link-account-title">{t("adultTitle")}</h3>
      <p>{t("signedInAs", { alias: session.alias })}</p>
      {email?.verified ? (
        <p>✓ {t("emailVerified")}</p>
      ) : (
        <>
          <p>{t("emailPending")}</p>
          <div className="kids-link-row">
            <button
              type="button"
              className="kids-button"
              disabled={busy || cooldown > 0}
              onClick={() =>
                void run(async () => {
                  await api.resendEmail();
                  setCooldown(RESEND_COOLDOWN_S);
                  setMessage(t("resent"));
                })
              }
            >
              {cooldown > 0 ? t("resendWait", { n: cooldown }) : t("resend")}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const status = await api.emailStatus();
                  onEmail(status);
                  if (!status.verified) setMessage(t("notYet"));
                })
              }
            >
              {t("checkAgain")}
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        className="kids-button"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await api.signOut();
            setMode("signin");
            onSession(null);
            onEmail(null);
          })
        }
      >
        {t("signOut")}
      </button>
      <p role="status" className="kids-note">
        {message}
      </p>
    </section>
  );
}
