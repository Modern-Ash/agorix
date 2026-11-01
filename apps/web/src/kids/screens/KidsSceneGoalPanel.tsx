import { useEffect, useState } from "react";
import { acceptProposal, rejectProposal } from "@agorix/proposals";
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
import {
  goalBlockCandidates,
  oriGoalStatement,
  proposeOriGoalBlock,
  reviewOriGoalBlock,
} from "../kidsOriGoalBlock.js";
import { proposeSceneGoal } from "../kidsSceneGoalProposal.js";
import { requestSceneGoal } from "../kidsSceneGoalsRemote.js";

interface Props {
  readonly locale: Locale;
  readonly actors: readonly { readonly id: string; readonly name: string }[];
  readonly goal: ProjectSceneGoal | null;
  readonly run: MultiActorRunResult | null;
  readonly program: ProjectProgram;
  readonly oriSuggestions: boolean;
  readonly onChange: (goal: ProjectSceneGoal | null) => void;
  readonly fixed?: boolean;
  /** The child accepted an Ori block: the new canonical program, recorded as one undoable step. */
  readonly onApplyProgram: (program: ProjectProgram, label: string) => void;
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
  fixed = false,
  onApplyProgram,
}: Props) {
  // null: Ori has not been asked; otherwise which of its ideas is on show.
  const [attempt, setAttempt] = useState<number | null>(null);
  // null: no block idea on show; otherwise which of the goal's candidate blocks is.
  // The goal a remote Ori ranked first; local ranking covers it until (or unless) it arrives.
  const [remoteGoal, setRemoteGoal] = useState<ProjectSceneGoal | null>(null);
  const [blockIdea, setBlockIdea] = useState<number | null>(null);
  const es = locale === "es";
  const nameOf = (actorId: string) => actors.find((item) => item.id === actorId)?.name ?? "?";
  const choices = sceneGoalChoices(actors.map((item) => item.id));
  const proposal =
    attempt === null || goal !== null
      ? null
      : proposeSceneGoal(actors, program, locale, attempt, remoteGoal);
  const candidates = (() => {
    if (goal === null) return [];
    try {
      return goalBlockCandidates(program, goal);
    } catch {
      return [];
    }
  })();
  const ideaKind =
    blockIdea === null || candidates.length === 0
      ? null
      : candidates[blockIdea % candidates.length]!;
  const ideaReview = (() => {
    if (goal === null || ideaKind === null) return null;
    try {
      return reviewOriGoalBlock(
        program,
        goal,
        proposeOriGoalBlock(program, goal, ideaKind, nameOf, locale),
      );
    } catch {
      return null;
    }
  })();
  const actorKey = actors.map((item) => item.id).join();
  useEffect(() => {
    // Prefetched while the goal picker shows, so the idea never changes under the child.
    if (!oriSuggestions || goal !== null) return;
    const controller = new AbortController();
    void requestSceneGoal(
      locale,
      sceneGoalChoices(actorKey.split(",").filter(Boolean)),
      fetch,
      controller.signal,
    ).then((remote) => {
      if (!controller.signal.aborted) setRemoteGoal(remote);
    });
    return () => controller.abort();
  }, [oriSuggestions, goal, locale, actorKey]);
  const met = goal !== null && run !== null ? sceneGoalMet(goal, run) : null;
  return (
    <section
      className="kids-studio-goal"
      aria-label={
        fixed
          ? es
            ? "Meta de la misión"
            : "Mission goal"
          : es
            ? "Meta de la escena"
            : "Scene goal"
      }
    >
      <h3>
        {fixed
          ? es
            ? "Meta de la misión"
            : "Mission goal"
          : es
            ? "Meta de la escena"
            : "Scene goal"}
      </h3>
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
          {!fixed ? (
            <button type="button" className="kids-button" onClick={() => onChange(null)}>
              {es ? "Quitar meta" : "Remove goal"}
            </button>
          ) : null}
          {oriSuggestions && candidates.length > 0 ? (
            <aside className="kids-ori-chat" aria-label={es ? "Bloques de Ori" : "Ori blocks"}>
              <div className="kids-ori-chat-heading">
                <strong>✦ Ori</strong>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() => setBlockIdea(blockIdea === null ? 0 : null)}
                >
                  {blockIdea === null
                    ? es
                      ? "¿Qué bloque me ayuda?"
                      : "Which block helps?"
                    : es
                      ? "Ocultar idea"
                      : "Hide idea"}
                </button>
              </div>
              {ideaReview && ideaKind ? (
                <div className="kids-ori-proposal" data-testid="ori-goal-block">
                  <p>{ideaReview.proposal.rationale}</p>
                  <p className="kids-note">
                    {es
                      ? "Idea de Ori: todavía no está en tu programa. Revisá el bloque antes de decidir."
                      : "Ori's idea is not in your program yet. Review the block before deciding."}
                  </p>
                  <strong data-testid="ori-goal-block-diff">
                    + {blockLabel(oriGoalStatement(ideaKind, goal!), nameOf, es)}
                  </strong>
                  <div className="kids-ori-actions">
                    <button
                      type="button"
                      className="kids-button kids-primary"
                      onClick={() => {
                        onApplyProgram(
                          acceptProposal(program, ideaReview).program,
                          "Ori goal block",
                        );
                        setBlockIdea(null);
                      }}
                    >
                      {es ? "Usar este bloque" : "Use this block"}
                    </button>
                    {candidates.length > 1 ? (
                      <button
                        type="button"
                        className="kids-button"
                        onClick={() => setBlockIdea((blockIdea ?? 0) + 1)}
                      >
                        {es ? "Otro bloque" : "Another block"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="kids-button"
                      onClick={() => {
                        rejectProposal(program, ideaReview);
                        setBlockIdea(null);
                      }}
                    >
                      {es ? "Ahora no" : "Not now"}
                    </button>
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
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

function blockLabel(
  statement: ReturnType<typeof oriGoalStatement>,
  nameOf: (actorId: string) => string,
  es: boolean,
): string {
  if (statement.type === "move") return es ? "Mover" : "Move";
  if (statement.type === "pointTowards")
    return `${es ? "Mirar hacia" : "Point towards"} ${nameOf(statement.actorId)}`;
  if (statement.type === "repeat") return es ? "Repetir 5 veces → Mover" : "Repeat 5 times → Move";
  return statement.type;
}
