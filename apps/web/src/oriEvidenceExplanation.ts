import type { OriTraceEnvelope } from "./oriCanonicalTrace.js";

const QUESTIONS: Record<string,string>={
  move:"¿Cuánto avanzó el personaje y qué esperabas que ocurriera?",
  turn:"¿Hacia dónde estaba mirando antes de girar?",
  repeat:"¿Cuántas veces se ejecutó la repetición?",
  if:"¿Qué condición hizo que se ejecutara ese camino?",
  wait:"¿Qué cambió después de esperar?",
  say:"¿Qué mensaje mostró el personaje?",
  forever:"¿Qué detendría el comportamiento repetido?",
  other:"¿Qué instrucción tuvo el efecto que observaste?"
};
export interface OriEvidenceExplanation {
  readonly status:"ready"|"unavailable";
  readonly stepCount?:number;
  readonly operationCounts?:Readonly<Record<string,number>>;
  readonly question?:string;
  readonly appliedChanges:false;
}
const unavailable:OriEvidenceExplanation=Object.freeze({status:"unavailable",appliedChanges:false});
/**
 * Explain only observed canonical operation categories, without an LLM or
 * raw trace transmission. Questions are deliberately non-solution-giving.
 */
export function explainOriEvidence(envelope:OriTraceEnvelope):OriEvidenceExplanation {
  if(envelope.status!=="ready" || !envelope.evidence ||
    !envelope.expectedSteps || !envelope.operationCounts)return unavailable;
  const entries=Object.entries(envelope.operationCounts);
  if(entries.length===0 || entries.some(([kind,count])=>
    !Object.hasOwn(QUESTIONS,kind) || !Number.isSafeInteger(count) || count<1))return unavailable;
  const total=entries.reduce((sum,[,count])=>sum+count,0);
  if(total!==envelope.expectedSteps || total>100)return unavailable;
  const [dominant]=entries.sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0]))[0]!;
  return Object.freeze({
    status:"ready",stepCount:total,
    operationCounts:Object.freeze(Object.fromEntries(entries)),
    question:QUESTIONS[dominant],appliedChanges:false
  });
}
