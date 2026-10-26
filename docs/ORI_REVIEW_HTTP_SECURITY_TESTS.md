# Ori review HTTP security regression gate

Adds real loopback HTTP tests for the disabled-by-default review decision route: authenticated owner/project resolution, explicit non-applying decision response, disabled and guest modes, forged owner/grants, and cross-origin requests. The scenarios are included in the cross-repository Ori integration CI gate.

These tests use a synthetic trusted identity resolver and synthetic decision callback. They verify the route's security contract, **not** production authentication, persistence, CSRF deployment settings, or child-facing UI readiness. The route must remain disabled until the actual authenticated session middleware and canonical project review workflow are connected.

Related Ori #18 #23 #28 #29. Agorix target branch integration/ori.
