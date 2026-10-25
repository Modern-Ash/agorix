import { useCallback, useEffect, useState } from "react";
import type { Locale } from "../../i18n.js";
import {
  GROUP_TEAMS,
  isGroupApiError,
  type GroupApi,
  type GroupCode,
  type GroupSlot,
  type GroupTeam,
  type OrganizerView,
} from "./groupApi.js";
import { groupError, groupText } from "./groupCopy.js";

interface Props {
  readonly locale: Locale;
  readonly api: GroupApi;
  readonly pollMs?: number;
  /** Lets the panel show things that depend on the roster, such as the team project. */
  readonly onView?: (view: OrganizerView) => void;
}

type Phase = "loading" | "signin" | "not-organizer" | "ready";

/**
 * The organizer's side: create the group, hand out one-use codes, approve each child (with the
 * responsible adult's consent in a household group), set teams, lock, remove and close. Codes are
 * held in memory only. Nothing here reads or writes text that a child typed, because there is none.
 */
export function GroupOrganizerCard({ locale, api, pollMs = 4000, onView }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<OrganizerView>({ group: null, slots: [] });
  const [message, setMessage] = useState("");
  const [code, setCode] = useState<GroupCode | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const t = (key: Parameters<typeof groupText>[1], values?: Record<string, string | number>) =>
    groupText(locale, key, values);

  const fail = useCallback(
    (error: unknown) => {
      if (isGroupApiError(error, "unauthenticated")) setPhase("signin");
      else if (isGroupApiError(error, "not-organizer")) setPhase("not-organizer");
      else setMessage(isGroupApiError(error) ? groupError(locale, error.kind) : "");
    },
    [locale],
  );

  const load = useCallback(async () => {
    try {
      const next = await api.current();
      setView(next);
      onView?.(next);
      setPhase("ready");
    } catch (error) {
      fail(error);
    }
  }, [api, fail, onView]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasGroup = phase === "ready" && view.group !== null;
  useEffect(() => {
    if (!hasGroup) return;
    const id = window.setInterval(() => void load(), pollMs);
    return () => window.clearInterval(id);
  }, [hasGroup, load, pollMs]);

  async function act(work: () => Promise<void>) {
    setMessage("");
    try {
      await work();
      await load();
    } catch (error) {
      fail(error);
    }
  }

  const group = view.group;

  return (
    <section className="kids-link-card" aria-labelledby="kids-group-organizer-title">
      <h3 id="kids-group-organizer-title">{t("creating")}</h3>
      {phase === "loading" ? <p role="status">…</p> : null}
      {phase === "signin" ? <p>{t("needSignIn")}</p> : null}
      {phase === "not-organizer" ? (
        <>
          <p>{t("needVerified")}</p>
          <button
            type="button"
            onClick={() =>
              void act(async () => {
                await api.enableOrganizer();
              })
            }
          >
            {t("enable")}
          </button>
        </>
      ) : null}
      {phase === "ready" && group === null ? (
        <CreateForm
          locale={locale}
          onCreate={(authority) =>
            void act(async () => {
              await api.create(authority);
            })
          }
        />
      ) : null}
      {phase === "ready" && group !== null ? (
        <>
          <p>
            <strong>{t("groupOpen")}</strong> · {t("expiresAt", { time: clock(group.expiresAt) })}
          </p>
          {group.locked ? <p>{t("locked")}</p> : null}
          <div className="kids-link-actions">
            <button
              type="button"
              onClick={() =>
                void act(async () => {
                  setCode(await api.createCode(group.groupId));
                })
              }
              disabled={group.locked}
            >
              {t("makeCode")}
            </button>
            <button
              type="button"
              onClick={() => void act(() => api.setLocked(group.groupId, !group.locked))}
            >
              {group.locked ? t("unlock") : t("lock")}
            </button>
          </div>
          {code !== null ? <CodeBox locale={locale} code={code} /> : null}
          <h4>{t("rosterTitle")}</h4>
          {view.slots.length === 0 ? <p>{t("emptyRoster")}</p> : null}
          <ul className="kids-group-roster">
            {view.slots.map((slot) => (
              <SlotRow
                key={slot.slotId}
                locale={locale}
                slot={slot}
                household={group.authorityKind === "household"}
                onApprove={(consent) =>
                  void act(() => api.approve(group.groupId, slot.slotId, consent))
                }
                onTeam={(team) => void act(() => api.assignTeam(group.groupId, slot.slotId, team))}
                onRemove={() => void act(() => api.remove(group.groupId, slot.slotId))}
                onReconnect={() =>
                  void act(async () => {
                    setCode(await api.reconnectCode(group.groupId, slot.slotId));
                  })
                }
              />
            ))}
          </ul>
          {confirmClose ? (
            <p role="alertdialog" aria-label={t("closeGroup")}>
              {t("confirmClose")}{" "}
              <button
                type="button"
                onClick={() =>
                  void act(async () => {
                    await api.close(group.groupId);
                    setCode(null);
                    setConfirmClose(false);
                  })
                }
              >
                {t("yes")}
              </button>{" "}
              <button type="button" onClick={() => setConfirmClose(false)}>
                {t("no")}
              </button>
            </p>
          ) : (
            <button type="button" onClick={() => setConfirmClose(true)}>
              {t("closeGroup")}
            </button>
          )}
        </>
      ) : null}
      {message !== "" ? <p role="alert">{message}</p> : null}
    </section>
  );
}

function CreateForm({
  locale,
  onCreate,
}: {
  readonly locale: Locale;
  readonly onCreate: (authority: import("./groupApi.js").GroupAuthorityInput) => void;
}) {
  const [kind, setKind] = useState<"household" | "classroom">("household");
  const [ref, setRef] = useState("");
  const t = (key: Parameters<typeof groupText>[1]) => groupText(locale, key);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onCreate(
          kind === "household"
            ? { kind: "household" }
            : { kind: "classroom", authorizationRef: ref.trim() },
        );
      }}
    >
      <label>
        <input
          type="radio"
          name="group-kind"
          checked={kind === "household"}
          onChange={() => setKind("household")}
        />{" "}
        {t("householdLabel")}
      </label>
      <label>
        <input
          type="radio"
          name="group-kind"
          checked={kind === "classroom"}
          onChange={() => setKind("classroom")}
        />{" "}
        {t("classroomLabel")}
      </label>
      {kind === "classroom" ? (
        <label>
          {t("refLabel")}
          <input
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
          />
          <small>{t("refNote")}</small>
        </label>
      ) : null}
      <button type="submit">{t("createGroup")}</button>
    </form>
  );
}

function CodeBox({ locale, code }: { readonly locale: Locale; readonly code: GroupCode }) {
  return (
    <div className="kids-link-code">
      <p>{groupText(locale, "codeLabel")}</p>
      <output aria-live="polite" className="kids-link-code-value">
        {code.code}
      </output>
      <small>{groupText(locale, "codeNote")}</small>
    </div>
  );
}

function SlotRow(props: {
  readonly locale: Locale;
  readonly slot: GroupSlot;
  readonly household: boolean;
  readonly onApprove: (consent: boolean) => void;
  readonly onTeam: (team: GroupTeam) => void;
  readonly onRemove: () => void;
  readonly onReconnect: () => void;
}) {
  const { locale, slot } = props;
  const [consent, setConsent] = useState(false);
  const t = (key: Parameters<typeof groupText>[1], values?: Record<string, string | number>) =>
    groupText(locale, key, values);
  return (
    <li>
      <strong>{slot.alias}</strong> · {slot.status === "approved" ? t("approved") : t("pending")}
      {slot.reconnects > 0 ? <small> · {t("reconnects", { n: slot.reconnects })}</small> : null}
      {slot.status === "pending" ? (
        <>
          {props.household ? (
            <label>
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />{" "}
              {t("consent")}
            </label>
          ) : null}
          <button
            type="button"
            disabled={props.household && !consent}
            onClick={() => props.onApprove(props.household ? consent : false)}
          >
            {t("approve")}
          </button>
        </>
      ) : (
        <>
          <label>
            {t("team")}{" "}
            <select
              value={slot.team ?? ""}
              onChange={(event) => {
                const next = GROUP_TEAMS.find((team) => team === event.target.value);
                if (next !== undefined) props.onTeam(next);
              }}
            >
              <option value="" disabled>
                {t("noTeam")}
              </option>
              {GROUP_TEAMS.map((team, index) => (
                <option key={team} value={team}>
                  {t("teamName", { n: index + 1 })}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={props.onReconnect}>
            {t("reconnect")}
          </button>
        </>
      )}{" "}
      <button type="button" onClick={props.onRemove}>
        {t("remove")}
      </button>
    </li>
  );
}

function clock(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
