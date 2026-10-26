# Ori adult-review policy gate

This module introduces an explicit **host-owned policy predicate** for future Ori plan diagnostics, without adding any HTTP endpoint or changing Kids.

## Allowed

Only the host roles `educator` and `administrator`, with the feature explicitly enabled and the requested mission index present in the host-authorized list, may invoke the internal review function.

## Denied

Learner/anonymous roles, disabled feature flags, unauthorized missions and unexpected errors return `unavailable` without invoking Ori.

## Critical limitation

The role and mission allowlist are inputs supplied by a trusted host. This module **does not authenticate sessions or authorize arbitrary incoming HTTP requests**. Never populate the policy from untrusted client JSON. A future adult-only endpoint must enforce authenticated server-side identity, session binding, CSRF controls, rate limiting, auditing and privacy review before using this predicate.

No project edits, child-facing responses or deployment are introduced. All changes remain isolated to `integration/ori`.
