import { useState } from "react";
import {
  decideWebLearningRouteWithLaya,
  type WebLearningDecisionDiagnostics,
} from "./learningDecision.js";
import { createLearningCompanionRequest } from "@agorix/tutor-contract";

export function DecisionPlaneTestHost() {
  const [result, setResult] = useState<WebLearningDecisionDiagnostics & {
    readonly source: "laya-system1";
    readonly accepted: readonly string[];
    readonly abstained: readonly string[];
  }>();

  async function run() {
    const request = createLearningCompanionRequest({
      capability: "explainer",
      mission: {
        id: "first",
        version: 1,
        concepts: ["movement"],
        learningObjective: "Understand why the sprite moved",
      },
      program: {
        schema: "agorix/program/v1",
        scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 24 }] }],
      },
      selectedNodeIds: ["scripts[0]/statements[0]"],
      runtimeFacts: [],
      scaffoldHistory: [],
    });

    const decision = await decideWebLearningRouteWithLaya(request, {
      async decideMany({ questions }) {
        return questions.map((question) => {
          const values: Record<string, string | number> = {
            generativeNeeded: "yes",
            clarificationNeeded: "no",
            assistanceLevel: 1,
            learningCapability: "explainer",
            solutionAllowance: "none",
            runtimeEvidenceNeeded: "no",
            contextNeed: "program",
            reasoningTier: "local",
          };
          return { id: question.id, value: values[question.id]!, confidence: 0.99 };
        });
      },
    });
    setResult(decision.diagnostics);
  }

  return (
    <section data-testid="decision-plane-host">
      <button type="button" onClick={run}>Run Laya integration</button>
      {result === undefined ? null : (
        <output
          data-source={result.source}
          data-capability={result.capability}
          data-generative-needed={result.generativeNeeded}
          data-reasoning-tier={result.reasoningTier}
          data-provider-bypassed={result.providerSelectionBypassed}
          data-accepted={result.accepted.join(",")}
          data-abstained={result.abstained.join(",")}
        >
          decision complete
        </output>
      )}
    </section>
  );
}
