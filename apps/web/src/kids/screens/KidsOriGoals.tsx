import { useEffect, useRef, useState } from "react";
import { runOriGoalAgent } from "@agorix/ori-agent";
import { requestKidsGoal, type KidsGoalProposal } from "../kidsGoalsRemote.js";

interface Props {
  readonly locale: "es" | "en";
  readonly onAccept: (proposal: KidsGoalProposal) => void;
}

export function KidsOriGoals({ locale, onAccept }: Props) {
  const [proposal, setProposal] = useState<KidsGoalProposal | null>(null);
  const [pending, setPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function ask() {
    if (pending) return;
    const controller = new AbortController();
    request.current = controller;
    setProposal(null);
    setPending(true);
    const remote = await requestKidsGoal(locale, controller.signal);
    const result = remote ?? (await runOriGoalAgent(locale));
    if (request.current === controller && !controller.signal.aborted) {
      setProposal(result);
      setPending(false);
      request.current = null;
    }
  }

  return (
    <aside className="kids-ori-chat" aria-label={locale === "es" ? "Metas de Ori" : "Ori goals"}>
      <div className="kids-ori-chat-heading">
        <strong>✦ Ori</strong>
        <button type="button" className="kids-button" disabled={pending} onClick={() => void ask()}>
          {locale === "es" ? "Inventá una meta" : "Invent a goal"}
        </button>
      </div>
      {pending ? <p role="status">{locale === "es" ? "Ori piensa…" : "Ori is thinking…"}</p> : null}
      {proposal ? (
        <div className="kids-ori-proposal">
          <p>{proposal.message}</p>
          <p className="kids-note">
            {locale === "es"
              ? "Ori propone. Vos decidís y el programa lo prueba."
              : "Ori proposes. You decide and the program proves it."}
          </p>
          <div className="kids-ori-actions">
            <button
              type="button"
              className="kids-button kids-primary"
              onClick={() => {
                onAccept(proposal);
                setProposal(null);
              }}
            >
              {locale === "es" ? "Elegir esta meta" : "Choose this goal"}
            </button>
            <button type="button" className="kids-button" onClick={() => setProposal(null)}>
              {locale === "es" ? "Otra vez" : "Not now"}
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
