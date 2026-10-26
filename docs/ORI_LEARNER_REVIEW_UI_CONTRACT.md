# Ori learner proposal review UI contract

The experimental OriLearnerProposalReview component now requires an opaque ticket ID and a server-owned asynchronous decision callback. It disables repeated clicks while pending, handles stale proposals, and displays success only after validating a response with an explicit status and appliedChanges=false. It does not mutate project data.

The response parser fails closed for malformed responses, unsupported statuses or auto-apply claims. The UI's local revision comparison is only advisory: the server remains responsible for authenticating the learner, authorizing the project, validating the current revision and recording the decision.

**Not yet wired:** authenticated HTTP endpoint, production project/session identity, and mounting the component in the main Agorix UI. Do not pass a callback that merely echoes browser-provided decisions; it must call the trusted review workflow. Follow-up requires authenticated E2E and Playwright tests.

Related Ori issues #18 #20 #23 #28 #29. Target branch: integration/ori.
