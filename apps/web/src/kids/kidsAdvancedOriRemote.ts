import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import {
  runOriAdvancedStage,
  validateOriAdvancedStageProposal,
  type OriAdvancedStageContext,
  type OriAdvancedDecision,
} from "@agorix/ori-agent";
import type { ProgramProposal } from "@agorix/proposals";
import { ProjectStore } from "@agorix/persistence";
import { ORI_BROWSER_TIMEOUT_MS } from "./oriRequestBudget.js";
import { KIDS_WORLDS } from "./kidsState.js";

/** The in-memory host session is reopened from locally authored mission proofs as needed. */
export async function requestAdvancedOri(
  context: OriAdvancedStageContext,
  store: ProjectStore,
  fetchImpl: typeof fetch = fetch,
): Promise<OriAdvancedDecision> {
  const fallback = async (): Promise<OriAdvancedDecision> => {
    try {
      return await runOriAdvancedStage(context);
    } catch {
      return {
        source: "fallback",
        message:
          context.locale === "es"
            ? "Seguí creando tu escena y probá otra vez más tarde."
            : "Keep creating your scene and try again later.",
      };
    }
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORI_BROWSER_TIMEOUT_MS);
  try {
    const programs = KIDS_MISSION_IDS.map((missionId) => {
      for (const world of KIDS_WORLDS) {
        const id = `kids.${world}.${missionId}`;
        if (store.has(id)) {
          const saved = store.load(id);
          if (saved.metadata.missionProgress === 1) return saved.program;
        }
      }
      throw new Error("missing mission proof");
    });
    let sceneProgram;
    if (context.stage === "react") {
      const saved = store.load("kids.advanced.scene");
      if (saved.metadata.missionProgress !== 1) throw new Error("scene is incomplete");
      sceneProgram = saved.program;
    }
    const session = await fetchImpl("/api/tutor/advanced/session", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        context.stage === "scene" ? { programs } : { programs, sceneProgram, stage: "react" },
      ),
    });
    if (!session.ok) return fallback();
    const sessionText = await session.text();
    if (sessionText.length > 256) return fallback();
    const parsed = JSON.parse(sessionText) as { token?: unknown; stage?: unknown };
    if (typeof parsed.token !== "string" || parsed.stage !== context.stage) return fallback();
    const response = await fetchImpl("/api/tutor/advanced/ori", {
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: parsed.token,
        actorId: context.actorId,
        locale: context.locale,
        program: context.program,
      }),
    });
    if (!response.ok) return fallback();
    const text = await response.text();
    if (text.length > 16 * 1024) return fallback();
    const decision = JSON.parse(text) as { message?: unknown; proposal?: unknown };
    if (typeof decision.message !== "string" || decision.message.length > 200) return fallback();
    if (!decision.proposal) return fallback();
    validateOriAdvancedStageProposal(context, decision.proposal);
    return {
      source: "model",
      message: decision.message,
      proposal: decision.proposal as ProgramProposal,
    };
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
