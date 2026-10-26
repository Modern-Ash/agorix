# Ori review pipeline deadline integration

The guarded internal Ori review pipeline now uses `readOriReviewBodyWithDeadline` instead of the unbounded-wait body reader. Default body deadline: 1000 ms. The deadline is enforced only **after** feature, trusted-host, origin, session, CSRF and rate-limit checks.

## End-to-end test cases

- Complete request returns the validated synthetic plan before deadline.
- A partially sent body that stalls is interrupted; Ori is never invoked.
- Disabled mode returns unavailable without consuming the body.

The deadline helper destroys stalled request streams. Depending on Node and network state, clients may see a closed connection rather than an HTTP error. This is deliberate in the experimental stage and must be addressed with an explicit transport policy before exposing a production route.

No route is registered in the main tutor server; no Kids behavior changes. This remains isolated to `integration/ori` and requires all six CI jobs.
