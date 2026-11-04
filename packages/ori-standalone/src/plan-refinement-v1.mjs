import { validateV1Envelope, V1ContractError } from "./contracts-v1.mjs";
import { createEducationalPlan } from "./planner-v1.mjs";

const ALLOWED_INTENTS = new Set(["help","repeat","turn","move","debug","unknown"]);

/**
 * Pure evidence-driven plan refinement. Never treats host trace text as
 * instructions, never invokes tools, and never proposes an automatic edit.
 */
export function refineEducationalPlan(context, initialPlan, {
  intent="unknown", programAvailable=false, traceAvailable=false, traceStepCount=0
}={}) {
  const checkedContext=validateV1Envelope("context",context);
  const checkedPlan=validateV1Envelope("plan",initialPlan);
  if (!ALLOWED_INTENTS.has(intent)) throw new V1ContractError("Unknown intent");
  if (typeof programAvailable!=="boolean" || typeof traceAvailable!=="boolean") throw new V1ContractError("Invalid evidence flags");
  if (!Number.isSafeInteger(traceStepCount) || traceStepCount<0 || traceStepCount>100 ||
      (!traceAvailable && traceStepCount!==0)) throw new V1ContractError("Invalid trace count");
  if (traceAvailable && (checkedContext.attempts??0)===0) throw new V1ContractError("Trace without prior attempt");
  let next=checkedPlan;
  let reason="unchanged";
  if (intent==="debug" && traceAvailable) {
    next=validateV1Envelope("plan",{
      schemaVersion:"ori/plan/v1",
      steps:[
        {id:"step-1",goal:traceStepCount>0
          ? `Revisar el paso ${traceStepCount} de la traza verificada por el host`
          : "Comparar la predicción con la traza verificada por el host"},
        {id:"step-2",goal:"Preguntarse si ese paso produjo lo que esperabas"},
        {id:"step-3",goal:"Formular una hipótesis y probar un cambio pequeño"}
      ]
    });
    reason="host-trace-available";
  } else if (intent==="debug" && !programAvailable && !traceAvailable) {
    next=createEducationalPlan(checkedContext,{intent:"help"});
    reason="insufficient-evidence";
  }
  return Object.freeze({
    plan:deepFreeze(next),
    reason,
    changed:reason!=="unchanged",
    appliedChanges:false,
    requiresLearnerApproval:true
  });
}
function deepFreeze(value) {
  if (value && typeof value==="object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
