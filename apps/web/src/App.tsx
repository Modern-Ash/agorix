import { useEffect, useRef, useState } from "react";
import { projectProgram } from "@agorix/code-generator";
import { FIRST_MISSION_STARTING_PROGRAM, FIRST_MISSION_WORLD } from "@agorix/curriculum";
import type { ProjectProgram } from "@agorix/program-model";
import { describeRunResult, runProgram, type RunResult, type StepObservation } from "@agorix/runtime";
import { applyProposal, proposeCompletion, type TutorProposal } from "@agorix/tutor-contract";
import { CodePanel } from "./CodePanel.js";
import { World } from "./World.js";

type RunPhase = "idle" | "running" | "ran";

const STEP_DELAY_MS = 60;

/**
 * First Mission end-to-end learner loop (issue #91).
 *
 * Layout is World + Code dominant, with no permanent Scratch-style toolbox
 * (AC-010/AC-011) — this supersedes the older toolbox-left-rail decision in
 * docs/product/LEARNER_JOURNEY.md D4, which predates the AI-native pivot
 * (#63-#73).
 */
export function App() {
  const [program, setProgram] = useState<ProjectProgram>(FIRST_MISSION_STARTING_PROGRAM);
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [observations, setObservations] = useState<readonly StepObservation[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);
  const [proposal, setProposal] = useState<TutorProposal | null>(null);
  const [proposalStatus, setProposalStatus] = useState<"none" | "pending" | "rejected">("none");
  const [reflection, setReflection] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { code, mapping } = projectProgram(program);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function handleRun(): void {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
    }
    const result = runProgram(program, FIRST_MISSION_WORLD);
    setLastResult(result);
    setObservations(result.observations);
    setProposal(null);
    setProposalStatus("none");
    setStepIndex(0);
    setPhase("running");

    if (result.observations.length === 0) {
      setPhase("ran");
      return;
    }

    let index = 0;
    timerRef.current = setInterval(() => {
      index += 1;
      setStepIndex(index);
      if (index >= result.observations.length) {
        if (timerRef.current !== null) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setPhase("ran");
      }
    }, STEP_DELAY_MS);
  }

  function handleAskForHelp(): void {
    if (lastResult === null) {
      return;
    }
    const next = proposeCompletion(program, lastResult, FIRST_MISSION_WORLD);
    setProposal(next);
    setProposalStatus(next !== null ? "pending" : "none");
  }

  function handleAcceptProposal(): void {
    if (proposal === null) {
      return;
    }
    setProgram((current) => applyProposal(current, proposal));
    setProposal(null);
    setProposalStatus("none");
    setPhase("idle");
    setLastResult(null);
    setObservations([]);
    setStepIndex(0);
  }

  function handleRejectProposal(): void {
    setProposal(null);
    setProposalStatus("rejected");
  }

  const currentObservation = observations[Math.min(stepIndex, observations.length - 1)];
  const spritePosition = currentObservation?.position ?? FIRST_MISSION_WORLD.start;
  const spriteHeading = currentObservation?.heading ?? FIRST_MISSION_WORLD.startHeading;
  const highlightedNodeId = phase === "running" ? currentObservation?.nodeId ?? null : null;
  const missionComplete = phase === "ran" && lastResult?.reachedGoal === true;
  const showHelpOffer = phase === "ran" && lastResult !== null && !lastResult.reachedGoal && proposalStatus === "none";

  return (
    <main className="app-shell" data-orientation-aware="true">
      <h1>Agorix — First Mission</h1>

      <div className="surfaces">
        <section aria-label="World" className="surface world-surface">
          <World
            spritePosition={spritePosition}
            spriteHeading={spriteHeading}
            goal={FIRST_MISSION_WORLD.goal}
            goalRadius={FIRST_MISSION_WORLD.goalRadius}
          />
        </section>

        <section aria-label="Code" className="surface code-surface">
          <CodePanel code={code} mapping={mapping} highlightedNodeId={highlightedNodeId} />
        </section>
      </div>

      <div className="controls">
        <button type="button" data-testid="run-button" onClick={handleRun} disabled={phase === "running"}>
          Run
        </button>

        {missionComplete ? (
          <p data-testid="mission-complete" role="status">
            Mission complete — you reached the goal!
          </p>
        ) : null}

        {phase === "ran" && lastResult !== null && !lastResult.reachedGoal ? (
          <p data-testid="debugger-message" role="status">
            {describeRunResult(lastResult, FIRST_MISSION_WORLD)}
          </p>
        ) : null}

        {showHelpOffer ? (
          <button type="button" data-testid="ask-ai-button" onClick={handleAskForHelp}>
            Ask AI for a hint
          </button>
        ) : null}

        {proposal !== null && proposalStatus === "pending" ? (
          <div data-testid="ai-proposal" className="proposal-card">
            <p data-testid="proposal-rationale">{proposal.rationale}</p>
            <button type="button" data-testid="accept-proposal-button" onClick={handleAcceptProposal}>
              Accept
            </button>
            <button type="button" data-testid="reject-proposal-button" onClick={handleRejectProposal}>
              Reject
            </button>
          </div>
        ) : null}

        {proposalStatus === "rejected" ? (
          <p data-testid="proposal-rejected" role="status">
            Proposal rejected — your program was not changed.
          </p>
        ) : null}
      </div>

      <section aria-label="Reflection" className="reflection-panel">
        <label htmlFor="reflection-input">What did you change, and why did it work?</label>
        <textarea
          id="reflection-input"
          data-testid="reflection-input"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
        />
      </section>
    </main>
  );
}
