# Ori review runtime composition

`openOriReviewRuntime` now assembles the existing canonical AuthService session adapter, ProjectRepository authorization, SQLite active-project selection and real Ori process workflow into the options accepted by Tutor API. The caller must supply the **same** AuthService and ProjectRepository instances used by the account/project host, plus a real pedagogical learning-context source and trusted world.

The returned resource exposes Tutor API review options, chooseProject, signedOut, rotated and close. It does not instantiate fake users or a disconnected in-memory repository. A unit test verifies fail-closed behavior without authentication or learning evidence.

**Not yet activated:** main.ts still does not instantiate this runtime because the actual production account/project host, shared storage and cookie contract have not been identified and connected. Do not enable the endpoints with new standalone in-memory AuthService or ProjectRepository instances. Production also requires session/logout event wiring and unmocked browser-to-Ori E2E.

Target integration/ori.
