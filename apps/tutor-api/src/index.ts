import { PACKAGE_NAME as TUTOR_CONTRACT_NAME } from "@agorix/tutor-contract";

/**
 * Placeholder shell for the only surface allowed to call an external LLM
 * provider (SYSTEM_DESIGN.md "tutor-api"). No real provider call in issue #11;
 * the provider-neutral contract and real adapter land in issues #25-#27.
 */
export function describeTutorApi(): string {
  return `tutor-api placeholder — wired to ${TUTOR_CONTRACT_NAME}, no provider call yet`;
}
