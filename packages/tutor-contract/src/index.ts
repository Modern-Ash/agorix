/** Provider-neutral tutor/AI-proposal contract shared by tutor-api and the learner UI. */
export const PACKAGE_NAME = "@agorix/tutor-contract";

export type {
  AppendStatementsProposal,
  ProposalDecision,
  ProposalRecord,
  TutorProposal,
} from "./proposal.js";
export { applyProposal, proposeCompletion } from "./proposal.js";
