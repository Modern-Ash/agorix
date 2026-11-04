import { ProviderError } from "./providers.mjs";

/** Only host-derived counts and allowlisted block names cross the model boundary. */
export function hostProposalPrompt(request) {
  if (!request || typeof request!=="object" || Array.isArray(request) ||
      Object.keys(request).sort().join()!=="allowedBlocks,attempts,hintsUsed,intent,learningStage,traceStepCount" ||
      !["move","turn"].includes(request.intent) ||
      !["explore","connect","translate"].includes(request.learningStage) ||
      ![request.attempts,request.hintsUsed,request.traceStepCount].every(n=>Number.isSafeInteger(n) && n>=0 && n<=100) ||
      !Array.isArray(request.allowedBlocks) || request.allowedBlocks.length>100 ||
      request.allowedBlocks.some(x=>typeof x!=="string" || !/^[a-z][A-Za-z0-9]{0,39}$/.test(x)))
    throw new ProviderError("Invalid minimized host evidence");
  return [
    "Sos Ori. Devolvé solo JSON, sin markdown ni texto adicional.",
    "Formato exacto: {\"schemaVersion\":\"ori/proposal/v0\",\"operation\":\"append\",\"requiresLearnerApproval\":true,\"blocks\":[{\"kind\":\"move\",\"steps\":1}] }.",
    "Si la intención es turn, el bloque debe ser {\"kind\":\"turn\",\"direction\":\"left\"} o right.",
    "Solo un bloque permitido, sin herramientas, código, datos del niño ni afirmaciones de éxito.",
    `Intención: ${request.intent}. Bloques permitidos: ${request.allowedBlocks.join(",")}. Intentos: ${request.attempts}. Pistas: ${request.hintsUsed}. Pasos observados: ${request.traceStepCount}.`
  ].join(" ");
}
