# Ori adult review: bounded admission control

The earlier rate-limit PR #668 was merged into its stacked branch, but the rate-limit module was not present in `integration/ori`. This increment adds an independent, bounded implementation directly against the integration branch.

The internal limiter defaults to six requests per minute and a maximum of 256 active principals per process. It rejects malformed principal keys, capacity overflow, clock rollback and invalid configuration. Expired buckets are evicted when a new window is evaluated.

## Security limitations

This module is not connected to an HTTP route. The server must derive a non-secret principal key from an authenticated session, after Origin, trusted-host and CSRF checks. The module is process-local; multiple replicas require shared admission control. It must not be treated as production-ready distributed rate limiting.

All six Ori CI checks and human review are required before merging to `integration/ori`. No Kids functionality or stable branch is changed.
