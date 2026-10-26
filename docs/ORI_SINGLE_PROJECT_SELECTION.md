# Ori single-project server selector

This opt-in adapter selects a project only when the authenticated account has exactly one project in the canonical ProjectRepository. It refuses zero projects, multiple projects, paginated results, foreign ownership and repository errors. The browser does not provide a project identifier as authority.

This is a narrow bridge for single-project learner accounts, not a general active-project selection system. For learners with multiple projects, the server must persist an authenticated selection and verify ownership on every request. This adapter can be supplied as the `activeProject` dependency of `createOriAuthorizedReviewOptions` but does not enable the review endpoints in main.ts.

Remaining release gates include shared production session/project storage, the actual account cookie contract, real pedagogical evidence and unmocked E2E. Target integration/ori.
