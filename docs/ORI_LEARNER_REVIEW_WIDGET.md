# Ori learner review widget (experimental)

The Agorix Web application now mounts the Ori learner proposal widget behind `VITE_ORI_LEARNER_REVIEW=1`. The widget requests an opaque server-issued ticket, displays the bounded proposal and delegates accept/edit/reject decisions to the authenticated Tutor API endpoint.

The Web flag **does not enable the server route**. Without a trusted identity resolver, canonical project repository, real learning history, Ori process and explicit server-side activation, proposal issuance fails closed. The widget never edits a project.

The issuance response does not yet contain an authenticated canonical revision. The component currently receives a matching opaque display marker, which must not be interpreted as a revision or used for authorization; only the server validates revision freshness. Before child-facing rollout, add an authoritative revision status to the API and remove the temporary marker, complete production identity wiring and run Playwright E2E.

Related Ori #18 #20 #23 #28 #29. Target integration/ori.
