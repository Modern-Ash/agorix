# Ori multi-project authenticated selection

The server-side `createOriSessionProjectSelector` allows an authenticated learner to select one of several projects. The selection is persisted through an injected `OriActiveProjectStore` keyed by accountId and sessionId. Both selection and later resolution revalidate ownership with the canonical ProjectRepository. Revoked access clears the stored selection.

This is an opt-in composition building block, not a public project-selection endpoint. The store must be durable/shared in production and cleared on sign-out or session expiration. If AuthService rotation changes the sessionId, the session selection must migrate atomically or use a stable authenticated session key. The browser may request a project choice only through an authenticated, CSRF-protected endpoint that verifies ownership; no such route is enabled here.

Related Ori #18 #20 #23 #28 #29. Base integration/ori. Production auth/persistence and unmocked E2E remain pending.
