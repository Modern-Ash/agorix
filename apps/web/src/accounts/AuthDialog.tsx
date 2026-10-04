import { useId, useState, type FormEvent } from "react";
import type { Locale } from "../i18n.js";
import { ta, type AccountMessageKey } from "./accountI18n.js";
import { isClientError } from "./clients.js";
import { Dialog } from "./Dialog.js";

export type AuthMode = "sign-in" | "register";

export interface AuthDialogProps {
  readonly locale: Locale;
  readonly initialMode?: AuthMode;
  /** Re-authentication after expiry: alias is prefilled and the copy explains why. */
  readonly sessionExpired?: boolean;
  readonly prefillAlias?: string | undefined;
  readonly onSubmit: (mode: AuthMode, alias: string, password: string) => Promise<void>;
  readonly onClose: () => void;
}

export function authErrorKey(error: unknown): AccountMessageKey {
  if (isClientError(error, "invalid-credentials")) return "errInvalidCredentials";
  if (isClientError(error, "username-taken")) return "errUsernameTaken";
  if (isClientError(error, "rate-limited")) return "errRateLimited";
  if (isClientError(error, "transient")) return "errTransient";
  if (isClientError(error, "validation")) {
    return error.reason === "INVALID_ALIAS" ? "errAlias" : "errPassword";
  }
  return "errGeneric";
}

export function AuthDialog(props: AuthDialogProps) {
  const { locale } = props;
  const [mode, setMode] = useState<AuthMode>(props.initialMode ?? "sign-in");
  const [alias, setAlias] = useState(props.prefillAlias ?? "");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AccountMessageKey | undefined>();
  const register = mode === "register";
  const aliasId = useId();
  const passwordId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await props.onSubmit(mode, alias, password);
      setPassword("");
    } catch (caught) {
      setError(authErrorKey(caught));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      title={
        props.sessionExpired === true
          ? ta(locale, "sessionExpiredTitle")
          : ta(locale, register ? "authDialogTitleRegister" : "authDialogTitleSignIn")
      }
      onClose={props.onClose}
      testId="auth-dialog"
    >
      <p className="agx-dialog-copy">
        {props.sessionExpired === true ? ta(locale, "sessionExpiredBody") : ta(locale, "authIntro")}
      </p>
      <form className="agx-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="agx-field">
          <label htmlFor={aliasId}>{ta(locale, "aliasLabel")}</label>
          <input
            id={aliasId}
            name="username"
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={alias}
            onChange={(event) => setAlias(event.currentTarget.value)}
            aria-describedby="agx-alias-hint"
            data-autofocus={props.sessionExpired === true ? undefined : ""}
          />
        </div>
        {register ? (
          <p id="agx-alias-hint" className="agx-hint">
            {ta(locale, "aliasHint")}
          </p>
        ) : (
          <span id="agx-alias-hint" hidden />
        )}
        <div className="agx-field">
          <label htmlFor={passwordId}>{ta(locale, "passwordLabel")}</label>
          <span className="agx-password-row">
            <input
              id={passwordId}
              name="password"
              type={reveal ? "text" : "password"}
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 12 : undefined}
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
              aria-describedby={register ? "agx-password-hint" : undefined}
              data-autofocus={props.sessionExpired === true ? "" : undefined}
            />
            <button
              type="button"
              className="agx-icon-button"
              aria-pressed={reveal}
              aria-label={ta(locale, "showPassword")}
              onClick={() => setReveal((value) => !value)}
            >
              {ta(locale, "showPassword")}
            </button>
          </span>
        </div>
        {register ? (
          <p id="agx-password-hint" className="agx-hint">
            {ta(locale, "passwordHintRegister")}
          </p>
        ) : null}
        <div role="alert" className="agx-error" data-testid="auth-error">
          {error === undefined ? null : ta(locale, error)}
        </div>
        <div className="agx-actions">
          <button type="submit" className="agx-primary" disabled={busy}>
            {busy
              ? ta(locale, "working")
              : ta(locale, register ? "submitRegister" : "submitSignIn")}
          </button>
          <button type="button" onClick={props.onClose}>
            {ta(locale, "cancel")}
          </button>
        </div>
        {props.sessionExpired === true ? null : (
          <button
            type="button"
            className="agx-link"
            onClick={() => {
              setMode(register ? "sign-in" : "register");
              setError(undefined);
            }}
          >
            {ta(locale, register ? "switchToSignIn" : "switchToRegister")}
          </button>
        )}
      </form>
    </Dialog>
  );
}
