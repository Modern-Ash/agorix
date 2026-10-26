# Ori review tickets scoped to canonical projects

Review tickets are bound to a trusted owner **and** project identifier. Reads and decisions require both identifiers to match. This prevents an authorized learner from accessing a ticket belonging to a different project. The registry still checks the current revision, expiry and concurrent decisions; it never applies program changes.

**Security requirement:** both owner and project IDs must be resolved by trusted server-side authentication and project authorization. Do not accept arbitrary browser-supplied IDs as authority. This PR adds the registry-level boundary, not authentication middleware, a public route or canonical program mutation.

Related Ori issues #16 #17 #18 #23 #28. Target: Agorix `integration/ori`.
