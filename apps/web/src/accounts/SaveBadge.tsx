import type { Locale } from "../i18n.js";
import { ta, type AccountMessageKey } from "./accountI18n.js";
import type { SaveState } from "./workspace.js";

export function saveStateKey(state: SaveState, deviceDraftOk: boolean): AccountMessageKey {
  switch (state) {
    case "local":
      return "saveLocal";
    case "saved":
      return "saveSaved";
    case "saving":
      return "saveSaving";
    case "offline":
      return deviceDraftOk ? "saveOffline" : "saveOfflineUnsafe";
    case "conflict":
      return "saveConflict";
    case "session-expired":
      return "saveSessionExpired";
  }
}

export interface SaveBadgeProps {
  readonly locale: Locale;
  readonly state: SaveState;
  readonly deviceDraftOk: boolean;
  readonly onResolveConflict?: () => void;
  readonly onSignIn?: () => void;
}

export function SaveBadge(props: SaveBadgeProps) {
  const { locale, state } = props;
  return (
    <span className="agx-save-row">
      <strong
        className={`agx-save-badge agx-save-${state}`}
        role="status"
        aria-live="polite"
        aria-label={ta(locale, "saveStateLabel")}
        data-testid="save-state"
        data-save-state={state}
      >
        {ta(locale, saveStateKey(state, props.deviceDraftOk))}
      </strong>
      {state === "conflict" && props.onResolveConflict !== undefined ? (
        <button type="button" onClick={props.onResolveConflict}>
          {ta(locale, "conflictResolve")}
        </button>
      ) : null}
      {state === "session-expired" && props.onSignIn !== undefined ? (
        <button type="button" onClick={props.onSignIn}>
          {ta(locale, "signIn")}
        </button>
      ) : null}
    </span>
  );
}
