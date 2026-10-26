# Ori authenticated project review composition

This increment connects the existing canonical Ori workflow to the Tutor API review options through a server-side identity resolver. A trusted session provider resolves accountId and sessionId; a server-owned active-project selector resolves the project; ProjectRepository.get verifies that the project still belongs to the account. Browser-provided owner, project, grants and revisions are never used as authority.

`createOriAuthorizedReviewOptions` returns the full proposal/decision callbacks and identity resolver for `createTutorServer`. It requires the canonical repository, Ori checkout, trusted world, verified learning context and authenticated session provider. It is deliberately **not wired into main.ts** because production session middleware and active-project selection must be identified and connected first. Do not replace them with fixed IDs or development-only headers.

The workflow remains review-only: decisions do not write programs. Before production activation, verify cookie/CSRF handling, session rotation, project changes, multi-instance ticket storage and unmocked E2E. Related Ori #18 #20 #23 #28 #29. Target Agorix integration/ori.
