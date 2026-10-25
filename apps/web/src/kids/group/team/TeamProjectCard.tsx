import { useEffect, useRef, useState } from "react";
import type { Locale } from "../../../i18n.js";
import { TEAM_ROLES, type TeamRole } from "@agorix/team-project";
import type { GroupSlot } from "../groupApi.js";
import { groupText, type GroupCopyKey } from "../groupCopy.js";
import { TeamHost, type HostMember, type HostSnapshot } from "./teamHost.js";

interface Props {
  readonly locale: Locale;
  /** The group's roster as the server reports it. Only approved children can join the team. */
  readonly slots: readonly GroupSlot[];
  /**
   * The live host, once started. The same-room transport (F3) feeds team devices through
   * `host.handle(slotId, message)`; until then the card shows the project but nothing arrives.
   */
  readonly onHost?: (host: TeamHost | null) => void;
}

const ROLE_KEY: Record<TeamRole, GroupCopyKey> = {
  characters: "roleCharacters",
  scene: "roleScene",
  rules: "roleRules",
  testing: "roleTesting",
};

const SAFE_IMAGE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * The organizer's view of the team project: who plays which role, whose turn it is, the attributed
 * history, changes waiting for the team, content waiting for approval, rollback and export. The
 * project is held in memory on this device and forgotten when the organizer ends it.
 */
export function TeamProjectCard({ locale, slots, onHost }: Props) {
  const approved = slots.filter((slot) => slot.status === "approved");
  const [host, setHost] = useState<TeamHost | null>(null);
  const [snapshot, setSnapshot] = useState<HostSnapshot | null>(null);
  const [mode, setMode] = useState<"turns" | "blocks">("turns");
  const [roles, setRoles] = useState<Record<string, TeamRole>>({});
  const [reactionsOn, setReactionsOn] = useState(true);
  const [message, setMessage] = useState("");
  const [viewing, setViewing] = useState<{ itemId: string; text: string } | null>(null);
  const [, redraw] = useState(0);
  const hostRef = useRef<TeamHost | null>(null);
  const t = (key: GroupCopyKey, values?: Record<string, string | number>) =>
    groupText(locale, key, values);

  const roleOf = (slot: GroupSlot, index: number): TeamRole =>
    roles[slot.slotId] ?? TEAM_ROLES[index % TEAM_ROLES.length]!;
  const members: HostMember[] = approved.map((slot, index) => ({
    slotId: slot.slotId,
    alias: slot.alias,
    role: roleOf(slot, index),
  }));
  const hasEditor = members.some((member) => member.role !== "testing");

  // Keep the host in step with the roster: an expelled child leaves the team at once.
  useEffect(() => {
    if (host === null) return;
    const present = new Set(approved.map((slot) => slot.slotId));
    for (const member of host.snapshot().members) {
      if (!present.has(member.slotId)) host.removeMember(member.slotId);
    }
  }, [host, approved]);

  useEffect(() => {
    hostRef.current = host;
    return () => hostRef.current?.close();
  }, [host]);

  function start() {
    const next = new TeamHost({ members, mode });
    next.subscribe(() => {
      setSnapshot(next.snapshot());
      redraw((value) => value + 1);
    });
    next.onBlocked((slotId) => {
      const alias = members.find((member) => member.slotId === slotId)?.alias ?? "";
      setMessage(t("blockedNotice", { alias }));
    });
    setHost(next);
    setSnapshot(next.snapshot());
    setReactionsOn(true);
    onHost?.(next);
  }

  function end() {
    host?.close();
    setHost(null);
    setSnapshot(null);
    setViewing(null);
    onHost?.(null);
  }

  function download() {
    if (host === null) return;
    try {
      const blob = new Blob([host.exportAgorix()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download from validated .agorix serializer, not outbound navigation
      anchor.download = "equipo.agorix";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage(t("exported"));
    } catch {
      setMessage(t("exportFailed"));
    }
  }

  return (
    <section className="kids-link-card" aria-labelledby="kids-team-title">
      <h3 id="kids-team-title">{t("teamTitle")}</h3>
      <p>{t("teamIntro")}</p>
      {host === null || snapshot === null ? (
        approved.length < 2 ? (
          <p>{t("teamNeed")}</p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (hasEditor) start();
            }}
          >
            <fieldset>
              <legend>{t("modeLabel")}</legend>
              {(["turns", "blocks"] as const).map((value) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="team-mode"
                    checked={mode === value}
                    onChange={() => setMode(value)}
                  />{" "}
                  {t(value === "turns" ? "modeTurns" : "modeBlocks")}
                </label>
              ))}
            </fieldset>
            {approved.map((slot, index) => (
              <label key={slot.slotId}>
                {t("roleLabel", { alias: slot.alias })}{" "}
                <select
                  value={roleOf(slot, index)}
                  onChange={(event) => {
                    const next = TEAM_ROLES.find((role) => role === event.target.value);
                    if (next !== undefined) setRoles({ ...roles, [slot.slotId]: next });
                  }}
                >
                  {TEAM_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(ROLE_KEY[role])}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {!hasEditor ? <p role="alert">{t("needEditor")}</p> : null}
            <button type="submit" disabled={!hasEditor}>
              {t("startTeam")}
            </button>
          </form>
        )
      ) : (
        <>
          <p role="status">{t("waitingDevices")}</p>
          <p>
            <strong>
              {snapshot.turn === undefined
                ? t("noTurn")
                : t("turnOf", { alias: aliasOf(snapshot, snapshot.turn) })}
            </strong>
          </p>

          <h4>{t("pendingTitle")}</h4>
          {snapshot.pending.length === 0 ? <p>{t("noPending")}</p> : null}
          <ul>
            {snapshot.pending.map((change) => (
              <li key={change.changeId}>
                {t("pendingLine", {
                  alias: change.alias,
                  role: t(ROLE_KEY[change.role]),
                  count: change.preview.length,
                  status: t(
                    change.status === "pending"
                      ? "statusPending"
                      : change.status === "stale"
                        ? "statusStale"
                        : "statusAwaiting",
                  ),
                })}
              </li>
            ))}
          </ul>

          <h4>{t("historyTitle")}</h4>
          {snapshot.history.length === 0 ? <p>{t("noHistory")}</p> : null}
          <ol className="kids-team-history">
            {snapshot.history.map((entry) => (
              <li key={entry.seq}>
                {entry.kind === "applied"
                  ? t(entry.origin === "ori" ? "historyOri" : "historyApplied", {
                      n: entry.seq,
                      alias: entry.alias,
                      role: t(ROLE_KEY[entry.role]),
                    })
                  : t("historyRolledBack", { n: entry.seq, of: entry.ofSeq })}
              </li>
            ))}
          </ol>

          <div className="kids-link-actions">
            <button
              type="button"
              disabled={!snapshot.history.some((entry) => entry.kind === "applied")}
              onClick={() => host.rollbackLast()}
            >
              {t("rollbackLast")}
            </button>
            <button
              type="button"
              aria-label={t("toggleReactions")}
              onClick={() => {
                host.setReactionsEnabled(!reactionsOn);
                setReactionsOn(!reactionsOn);
              }}
            >
              {t(reactionsOn ? "reactionsOn" : "reactionsOff")}
            </button>
          </div>

          <h4>{t("contentTitle")}</h4>
          {host.contentQueue().length === 0 ? <p>{t("noContent")}</p> : null}
          <ul>
            {host.contentQueue().map((item) => (
              <li key={item.itemId}>
                {t("contentLine", {
                  alias: item.alias,
                  kind: t(item.kind === "image" ? "kindImage" : "kindName"),
                })}{" "}
                <button
                  type="button"
                  onClick={() =>
                    setViewing({ itemId: item.itemId, text: host.inspectContent(item.itemId) })
                  }
                >
                  {t("viewContent")}
                </button>{" "}
                <button
                  type="button"
                  onClick={() => {
                    host.decideContent(item.itemId, "approve");
                    setViewing(null);
                  }}
                >
                  {t("approveContent")}
                </button>{" "}
                <button
                  type="button"
                  onClick={() => {
                    host.decideContent(item.itemId, "reject");
                    setViewing(null);
                  }}
                >
                  {t("rejectContent")}
                </button>
                {viewing?.itemId === item.itemId ? (
                  SAFE_IMAGE.test(viewing.text) ? (
                    <img src={viewing.text} alt="" width={96} height={96} />
                  ) : (
                    <output>{viewing.text}</output>
                  )
                ) : null}
              </li>
            ))}
          </ul>

          <div className="kids-link-actions">
            <button type="button" onClick={download}>
              {t("exportTeam")}
            </button>
            <button type="button" onClick={end}>
              {t("endTeam")}
            </button>
          </div>
        </>
      )}
      {message !== "" ? <p role="status">{message}</p> : null}
    </section>
  );
}

function aliasOf(snapshot: HostSnapshot, slotId: string): string {
  return snapshot.members.find((member) => member.slotId === slotId)?.alias ?? "";
}
