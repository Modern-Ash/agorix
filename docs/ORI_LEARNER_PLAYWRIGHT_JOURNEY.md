# Ori learner review browser E2E

Run from `apps/web`: `pnpm test:e2e:ori`.

This isolated Playwright configuration starts the Vite development server with `VITE_ORI_LEARNER_REVIEW=1`. The browser tests mock only the Tutor API issuance and decision HTTP boundaries, and verify minimal request payloads, rejection without writes, malformed/auto-applied proposal refusal and stale review feedback. The default Playwright suite excludes this feature-flagged directory.

These are **browser contract tests**, not authenticated production E2E. They must be run against the actual app and verified before becoming a required CI gate. Production rollout remains blocked on real authenticated identity resolution, canonical project persistence and trusted pedagogical context. Never enable the experimental review route publicly with a fake identity resolver.

Related Ori #18 #20 #23 #28 #29. Agorix target integration/ori.
