import {
  createDeterministicTutorResponse,
  validateTutorRequest,
  type TutorRequest,
} from "@agorix/tutor-contract";

/**
 * Captures the actual deterministic text-tutor output, not a synthesized hint.
 * TutorResponse contains one message, not an independently generated nextStep.
 * This evidence is not yet eligible for the two-field blind comparison.
 */
export interface OriRealTextBaseline {
  readonly source: "agorix-deterministic-text";
  readonly missionId: string;
  readonly hintLevel: 1 | 2 | 3 | 4 | 5;
  readonly message: string;
  readonly nextStepAvailable: false;
  readonly programUnchanged: boolean;
}
export function captureOriRealTextBaseline(request: TutorRequest): OriRealTextBaseline {
  const validated = validateTutorRequest(request);
  const before = JSON.stringify(validated.program);
  const response = createDeterministicTutorResponse(validated);
  if (JSON.stringify(validated.program) !== before)
    throw new Error("Deterministic tutor modified evaluation program");
  return Object.freeze({
    source: "agorix-deterministic-text",
    missionId: validated.mission.id,
    hintLevel: response.hintLevel,
    message: response.message,
    nextStepAvailable: false,
    programUnchanged: true,
  });
}
