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
