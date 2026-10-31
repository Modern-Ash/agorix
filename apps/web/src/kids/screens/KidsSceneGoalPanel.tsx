import { useState } from "react";
import type { ProjectSceneGoal } from "@agorix/persistence";
import type { ProjectProgram } from "@agorix/program-model";
import type { MultiActorRunResult } from "@agorix/runtime";
import type { Locale } from "../../i18n.js";
import {
  describeSceneGoal,
  sceneGoalChoices,
  sceneGoalKey,
  sceneGoalMet,
} from "../kidsSceneGoal.js";
import { proposeSceneGoal } from "../kidsSceneGoalProposal.js";

interface Props {
  readonly locale: Locale;
  readonly actors: readonly { readonly id: string; readonly name: string }[];
  readonly goal: ProjectSceneGoal | null;
  readonly run: MultiActorRunResult | null;
  readonly program: ProjectProgram;
  readonly oriSuggestions: boolean;
  readonly onChange: (goal: ProjectSceneGoal | null) => void;
}

/** A goal for the whole scene, checked against what a run does (issue #1121). */
export function KidsSceneGoalPanel({
  locale,
  actors,
  goal,
  run,
  program,
  oriSuggestions,
  onChange,
}: Props) {
  // null: Ori has not been asked; otherwise which of its ideas is on show.
  const [attempt, setAttempt] = useState<number | null>(null);
  const es = locale === "es";
  const nameOf = (actorId: string) => actors.find((item) => item.id === actorId)?.name ?? "?";
  const choices = sceneGoalChoices(actors.map((item) => item.id));
  const proposal =
    attempt === null || goal !== null ? null : proposeSceneGoal(actors, program, locale, attempt);
  const met = goal !== null && run !== null ? sceneGoalMet(goal, run) : null;
  return (
    <section className="kids-studio-goal" aria-label={es ? "Meta de la escena" : "Scene goal"}>
      <h3>{es ? "Meta de la escena" : "Scene goal"}</h3>
      {goal === null ? (
        <>
          <p className="kids-note">
            {es
              ? "Si querés, poné una meta y mirá si tu programa la logra."
              : "If you like, set a goal and see whether your program reaches it."}
          </p>
          <select
            aria-label={es ? "Elegir una meta" : "Choose a goal"}
            value=""
            onChange={(event) => {
              const picked = choices.find((item) => sceneGoalKey(item) === event.target.value);
              if (picked) onChange(picked);
            }}
          >
            <option value="">{es ? "Sin meta" : "No goal"}</option>
            {choices.map((item) => (
              <option key={sceneGoalKey(item)} value={sceneGoalKey(item)}>
                {describeSceneGoal(item, nameOf, locale)}
              </option>
            ))}
          </select>
          {oriSuggestions ? (
            <aside className="kids-ori-chat" aria-label={es ? "Metas de Ori" : "Ori goals"}>
              <div className="kids-ori-chat-heading">
                <strong>✦ Ori</strong>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() => setAttempt((current) => (current === null ? 0 : current + 1))}
                >
                  {proposal
                    ? es
                      ? "Otra idea"
                      : "Another idea"
                    : es
                      ? "Inventá una meta"
                      : "Invent a goal"}
                </button>
              </div>
              {proposal ? (
                <div className="kids-ori-proposal" data-testid="ori-scene-goal">
                  <p>{proposal.message}</p>
                  <p className="kids-note">
                    {es
                      ? "Ori propone. Vos decidís y el programa lo prueba."
                      : "Ori proposes. You decide and the program proves it."}
                  </p>
                  <div className="kids-ori-actions">
                    <button
                      type="button"
                      className="kids-button kids-primary"
                      onClick={() => {
                        onChange(proposal.goal);
                        setAttempt(null);
                      }}
                    >
                      {es ? "Elegir esta meta" : "Choose this goal"}
                    </button>
                    <button type="button" className="kids-button" onClick={() => setAttempt(null)}>
                      {es ? "Ahora no" : "Not now"}
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
        </>
      ) : (
        <>
          <p data-testid="scene-goal">{describeSceneGoal(goal, nameOf, locale)}</p>
          <button type="button" className="kids-button" onClick={() => onChange(null)}>
            {es ? "Quitar meta" : "Remove goal"}
          </button>
          {met === null ? null : (
            <p className="kids-note" role="status" data-testid="scene-goal-result">
              {met
                ? es
                  ? "¡Lograste la meta!"
                  : "You reached the goal!"
                : es
                  ? "Todavía no la logra. Cambiá los bloques y probá otra vez."
                  : "Not yet. Change the blocks and try again."}
            </p>
          )}
        </>
      )}
    </section>
  );
}
