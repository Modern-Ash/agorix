# Agorix integration/ori — Ori runtime cross-repository verification

This opt-in command verifies two independently checked-out repositories in one invocation, without deploying Ori or altering Agorix's stable branches.

```bash
# From Agorix checkout on integration/ori, with Ori checked out separately:
ORI_REPO_PATH=/absolute/path/to/ori pnpm test:ori:runtime
```

The gate runs Ori's local-agent runtime tests and loopback HTTP synthetic integration, then Agorix's existing real-process Ori consumer smoke test. It fails if Ori is absent or lacks the required runtime files. It is not a real OpenCode server test, browser Playwright E2E or evidence of child safety.

## Follow-up vertical milestone
- Expose the new Ori runtime through a host-owned, versioned transport contract, without raw child data leakage.
- Wire an opt-in Agorix feature flag and review-only UI with learner approval.
- Add Playwright happy paths and adversarial cases across Web, tutor API, canonical runtime and Ori.
- Keep all PR targets on `integration/ori` and do not promote to Agorix `develop` or `main`.

## Expanded process-level acceptance

The gate now launches Ori's `examples/local-agent-runtime.mjs` from Agorix's Vitest process for five educational intents and one rejected intent. It asserts versioned plans, deterministic hints, zero applied changes and no synthetic session identifier in stdout. Model execution is forcibly disabled for this cross-process test.

The pre-existing shadow HTTP contract remains covered independently. Together, these validate **two real Ori processes** but not a unified browser-to-runtime feature: no Agorix UI or child-facing tutor endpoint is switched to Ori. The next vertical increment should implement a host-owned runtime transport behind an explicit experimental flag, with Playwright acceptance tests and no automatic edits.
