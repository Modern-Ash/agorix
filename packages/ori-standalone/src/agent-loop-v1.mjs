import { buildEducationalContext } from "./context-builder.mjs";
import { createEducationalPlan } from "./planner-v1.mjs";
import { refineEducationalPlan } from "./plan-refinement-v1.mjs";
import { createToolRegistry } from "./tools.mjs";
import { validateSnapshot, validateTrace } from "./contracts.mjs";
import { V1ContractError } from "./contracts-v1.mjs";

const INTENTS = new Set(["help","repeat","turn","move","debug","unknown"]);
const TOOL_ORDER = Object.freeze(["inspectProgram","inspectTrace"]);

export class AgentLoopError extends Error {
  constructor(message) { super(message); this.name = "AgentLoopError"; }
}
function assertActive(signal) {
  if (signal.aborted) throw new AgentLoopError("Agent cancelled or deadline exceeded");
}
async function boundedRead(read, signal, deadlineMs) {
  assertActive(signal);
  let timer;
  let onAbort;
  const interrupted = new Promise((_,reject) => {
    onAbort = () => reject(new AgentLoopError("Agent cancelled or deadline exceeded"));
    signal.addEventListener("abort",onAbort,{once:true});
    if (signal.aborted) onAbort();
    timer = setTimeout(onAbort,deadlineMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(read),interrupted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort",onAbort);
  }
}
/**
 * Read-only synthetic agent loop with bounded host tool waits.
 * Tools must respect AbortSignal for cooperative cancellation; late results
 * are ignored, never applied. No writes, LLM calls or child-facing transport.
 */
export async function runEducationalAgent({hostContext,intent="unknown",tools={},signal,maxSteps=4,deadlineMs=2000}={}) {
  if (!INTENTS.has(intent)) throw new AgentLoopError("Invalid intent");
  if (!Number.isSafeInteger(maxSteps) || maxSteps<1 || maxSteps>4) throw new AgentLoopError("Invalid step budget");
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs<1 || deadlineMs>10000) throw new AgentLoopError("Invalid deadline");
  if (!tools || typeof tools!=="object" || Array.isArray(tools)) throw new AgentLoopError("Invalid tools");
  const context=buildEducationalContext(hostContext);
  const plan=createEducationalPlan(context,{intent});
  const registry=createToolRegistry(tools,context.grants,Math.min(2,context.grants.length));
  const controller=new AbortController();
  const onExternalAbort=()=>controller.abort();
  if (signal) signal.addEventListener("abort",onExternalAbort,{once:true});
  if (signal?.aborted) controller.abort();
  const timeout=setTimeout(()=>controller.abort(),deadlineMs);
  const events=[];
  const evidence={};
  try {
    assertActive(controller.signal);
    events.push("observe");
    assertActive(controller.signal);
    events.push("plan");
    for (const name of TOOL_ORDER) {
      if (!context.grants.includes(name)) continue;
      if (name==="inspectTrace" && (context.attempts??0)===0) continue;
      if (events.length+1>maxSteps) break;
      assertActive(controller.signal);
      const raw=await boundedRead(()=>registry.call(name),controller.signal,deadlineMs);
      assertActive(controller.signal);
      if (raw!=null) {
        try {
          evidence[name]=name==="inspectProgram"?validateSnapshot(raw):validateTrace(raw);
        } catch {
          throw new V1ContractError("Invalid host tool evidence");
        }
      }
      events.push("tool:"+name);
    }
    assertActive(controller.signal);
    if (events.length<maxSteps) events.push("verify");
    const refinement=refineEducationalPlan(context,plan,{intent,programAvailable:!!evidence.inspectProgram,
      traceAvailable:!!evidence.inspectTrace,traceStepCount:evidence.inspectTrace?.steps.length??0});
    return Object.freeze({
      kind:"educational-plan",plan:refinement.plan,
      refinementReason:refinement.reason,
      toolsUsed:events.filter(e=>e.startsWith("tool:")).map(e=>e.slice(5)),
      evidenceAvailable:{program:!!evidence.inspectProgram,trace:!!evidence.inspectTrace},
      appliedChanges:false,requiresLearnerApproval:true,
      diagnostics:{steps:events.length,events:Object.freeze([...events])}
    });
  } finally {
    clearTimeout(timeout);
    if (signal) signal.removeEventListener("abort",onExternalAbort);
    controller.abort();
  }
}
