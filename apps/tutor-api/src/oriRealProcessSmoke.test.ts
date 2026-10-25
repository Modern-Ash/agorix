import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOriShadowTransport } from "./oriExternalShadowTransport.js";
import { createOriPlanConsumer } from "./oriPlanConsumer.js";
import { createOriLearnerHintPreview } from "./oriLearnerHintPreview.js";
import { captureOriLiveComparison } from "./oriLiveComparisonCapture.js";
import { exportOriBlindReviewJson } from "./oriBlindReviewJsonExport.js";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";
import { createWorldState, runProgram } from "@agorix/runtime";
import { createTutorRequest } from "@agorix/tutor-contract";

/**
 * Optional cross-repository smoke. Requires ORI_REPO_PATH pointing to a local
 * checkout of Modern-Ash/ori with examples/shadow-api/serve.mjs.
 * CI without this checkout skips it, preserving independent repository builds.
 */
const oriPath = process.env["ORI_REPO_PATH"];
const runnable = !!oriPath;
if (runnable && !existsSync(resolve(oriPath, "examples/shadow-api/serve.mjs"))) {
  throw new Error("ORI_REPO_PATH is set but Ori reference server is missing");
}

describe.skipIf(!runnable)("real Ori process to Agorix consumer contract", () => {
  it("sends synthetic metadata to a separately running Ori process", async () => {
    const port = 18000 + Math.floor(Math.random() * 20000);
    const child: ChildProcess = spawn(process.execPath, ["examples/shadow-api/serve.mjs"], {
      cwd: oriPath,
      env: { ...process.env, ORI_SHADOW_PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    try {
      const url = `http://127.0.0.1:${port}/v1/plan`;
      let ready = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (child.exitCode !== null) throw new Error("Ori process terminated");
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ missionIndex: 1, hintLevel: 2, scriptCount: 1 }),
          });
          if (response.ok) {
            const data: unknown = await response.json();
            const { validateOriShadowPlan } = await import("./oriShadowPlanValidation.js");
            if (validateOriShadowPlan(data) === null) {
              throw new Error("Ori returned incompatible shadow-plan contract");
            }
            ready = true;
            break;
          }
        } catch (error) {
          if (error instanceof Error && error.message.includes("incompatible shadow-plan"))
            throw error;
          await new Promise((resolveWait) => setTimeout(resolveWait, 50));
        }
      }
      expect(ready).toBe(true);
      let actualRequests = 0;
      let validatedResponses = 0;
      const observedFetch: typeof fetch = async (input, init) => {
        actualRequests++;
        const response = await fetch(input, init);
        if (response.ok) {
          const payload: unknown = await response.clone().json();
          const { validateOriShadowPlan } = await import("./oriShadowPlanValidation.js");
          if (validateOriShadowPlan(payload) === null) {
            throw new Error("Ori transport returned incompatible shadow-plan contract");
          }
          validatedResponses++;
        }
        return response;
      };
      const transport = createOriShadowTransport(url, observedFetch);
      expect(await transport({ missionIndex: 1, hintLevel: 2, scriptCount: 1 })).toBeUndefined();
      expect(actualRequests).toBe(1);
      expect(validatedResponses).toBe(1);
      // Exercise the actual read-only consumer against the real Ori process.
      const consumer = createOriPlanConsumer(url);
      const accepted = await consumer.evaluate({
        missionIndex: 1,
        hintLevel: 2,
        scriptCount: 1,
      });
      expect(accepted?.schema).toBe("ori/shadow-plan/v1");
      expect(accepted?.stage).toBe(2);
      expect(accepted?.context.missionStage).toBe(1);
      expect(accepted?.steps).toHaveLength(3);
      expect(accepted?.appliedChanges).toBe(false);
      expect(Object.isFrozen(accepted)).toBe(true);
      expect(Object.isFrozen(accepted?.steps)).toBe(true);
      expect(Object.isFrozen(accepted?.context)).toBe(true);
      // Ori generates the plan for the requested stage; verify another stage independently.
      const stageThree = await consumer.evaluate({
        missionIndex: 1,
        hintLevel: 3,
        scriptCount: 1,
      });
      expect(stageThree?.stage).toBe(3);
      // Exercise the learner-first preview against the real Ori reference process.
      const learnerInput = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
      const disabledPreview = createOriLearnerHintPreview(consumer);
      expect(await disabledPreview(learnerInput)).toEqual({
        status: "unavailable",
        requiresLearnerApproval: true,
        appliedChanges: false,
      });
      const learnerPreview = createOriLearnerHintPreview(consumer, true);
      const hint = await learnerPreview(learnerInput);
      expect(hint.status).toBe("ready");
      expect(hint.hint).toBe(accepted?.hint);
      expect(hint.nextStep).toBe(accepted?.steps[0]);
      expect(hint.requiresLearnerApproval).toBe(true);
      expect(hint.appliedChanges).toBe(false);
      expect(Object.keys(hint).sort()).toEqual([
        "appliedChanges",
        "hint",
        "nextStep",
        "requiresLearnerApproval",
        "status",
      ]);

      // Actual dual-producer capture: canonical synthetic Kids program and real Ori HTTP process.
      const mission = getKidsMission(KIDS_MISSION_IDS[1]!, "es");
      const program = mission.starterProject;
      const runtime = runProgram(program, createWorldState(mission.starterStage), {
        collectObservations: true,
      });
      const tutorRequest = createTutorRequest({
        mission: { id: mission.id, version: mission.version, concepts: mission.concepts },
        program,
        runtime: {
          outcome: runtime.outcome,
          stepsUsed: runtime.stepsUsed,
          finalWorld: runtime.world,
          observations: runtime.observations,
        },
        hintHistory: [{ level: 1 }],
        reading: { locale: "es-AR", readingLevel: "middle-grade" },
      });
      const dualInput = {
        missionIndex: 1,
        hintLevel: 2 as const,
        scriptCount: program.scripts.length,
      };
      const dual = await captureOriLiveComparison(tutorRequest, dualInput, consumer, true);
      expect(dual).not.toBeNull();
      expect(dual?.educator.A).toBe(accepted?.hint);
      expect(dual?.educator.B.length).toBeGreaterThan(8);
      expect(dual?.coordinator.oriCandidate).toBe("A");
      expect(dual?.educator.equalInputContextProven).toBe(false);
      expect(dual?.educator.eligibleForEfficacyClaim).toBe(false);
      expect(JSON.stringify(dual?.educator)).not.toContain("oriCandidate");
      // Export real-process A/B results without exposing the coordinator source key.
      const exported = dual ? exportOriBlindReviewJson(dual) : null;
      expect(exported).not.toBeNull();
      const educatorDocument = JSON.parse(exported!.educatorJson) as Record<string, unknown>;
      const coordinatorDocument = JSON.parse(exported!.coordinatorJson) as Record<string, unknown>;
      expect(educatorDocument["A"]).toBe(accepted?.hint);
      expect(educatorDocument["equalInputContextProven"]).toBe(false);
      expect(educatorDocument["eligibleForEfficacyClaim"]).toBe(false);
      expect(coordinatorDocument["oriCandidate"]).toBe("A");
      expect(exported!.educatorJson).not.toContain("oriCandidate");
      expect(exported!.educatorJson).not.toContain("deterministicCandidate");
      expect(exported!.educatorJson).not.toContain("coordinator");

      expect(JSON.stringify(program)).toBe(JSON.stringify(mission.starterProject));

      // The consumer is not connected to the child-facing tutor response.
    } finally {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await Promise.race([
          new Promise<void>((resolveExit) => child.once("exit", () => resolveExit())),
          new Promise<void>((resolveWait) => setTimeout(resolveWait, 1000)),
        ]);
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    }
  }, 10_000);
});
