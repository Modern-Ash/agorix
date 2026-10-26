# Ori v2 server composition vertical slice

This experimental composition wires the canonical ProjectRepository, bounded runProgram execution, privacy-minimized trace resolver, independent Ori host-evidence CLI and server-owned review tickets.

Trusted dependencies: a real authenticated owner, an authorized project repository, an initial world derived from the canonical project/mission and a learningContext provider backed by actual learner attempts/hints. No arbitrary browser-supplied grants, traces, revision hashes or program data are accepted.

The workflow rechecks project access and uses semantic hash plus numeric repository revision for ticket freshness. It remains server-only: no public endpoint, UI mount or program mutation. The next integration must supply production authentication, project world and learning evidence; then exercise a real persisted project through the Ori process in E2E tests.

Related Ori issues #16 #17 #18 #20 #23 #28. Agorix base branch integration/ori.
