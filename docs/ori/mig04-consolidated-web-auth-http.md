# MIG-04 consolidated web authentication HTTP integration

The integrated PostgreSQL production host now injects an opt-in dispatcher into the existing TutorServer. It provides same-origin JSON POST endpoints under `/api/tutor/ori/auth/`: `register`, `login`, `logout`, and `project`. The dispatcher uses the real shared PostgreSQL AuthService, sets a Secure/HttpOnly host-only session cookie on login, revokes the actual token on logout, and selects the active project through the verified session ownership boundary. Legacy TutorServer routes are left unchanged.

## Security and deployment constraints

- HTTPS Origin must match the Host header exactly; the deployment proxy must preserve both, and the web frontend must be same-origin.
- These endpoints are available only when the explicit shared-auth production host is started. The legacy `main.ts` entrypoint is unchanged and the pilot is disabled.
- No owner or session ID is accepted from the request body. Authentication and project selection are server-owned.
- A rotating AuthService session is denied by session actions until cookie delivery and project mapping rotation are coordinated. This is fail-closed, not a complete browser lifecycle.
- A deployment using a separate login process must point it at the same PostgreSQL account/session tables and compatible cookie contract.
- Before closing #1007, wire the production entrypoint, verify real browser login/logout/project selection and run successful authorized Ori propose/decision/apply with cross-owner and CAS conflict coverage.
