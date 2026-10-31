import type { ProjectSceneGoal } from "@agorix/persistence";
import type { MultiActorRunResult } from "@agorix/runtime";
import type { Locale } from "../../i18n.js";
import {
  describeSceneGoal,
  sceneGoalChoices,
  sceneGoalKey,
  sceneGoalMet,
} from "../kidsSceneGoal.js";

interface Props {
  readonly locale: Locale;
  readonly actors: readonly { readonly id: string; readonly name: string }[];
  readonly goal: ProjectSceneGoal | null;
  readonly run: MultiActorRunResult | null;
  readonly onChange: (goal: ProjectSceneGoal | null) => void;
}

/** A goal for the whole scene, checked against what a run does (issue #1121). */
export function KidsSceneGoalPanel({ locale, actors, goal, run, onChange }: Props) {
  const es = locale === "es";
  const nameOf = (actorId: string) => actors.find((item) => item.id === actorId)?.name ?? "?";
  const choices = sceneGoalChoices(actors.map((item) => item.id));
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
