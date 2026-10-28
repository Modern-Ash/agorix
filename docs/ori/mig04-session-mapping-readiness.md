# MIG-04 durable session mapping readiness

The canonical authenticated runtime now checks the `agorix_ori_session_projects` table before opening its HTTP listener. Missing or incomplete schema fails startup without performing automatic migrations. This complements the canonical project and durable rollout policy gates.

Deployment migrations must apply the session-project schema before startup. This gate does not prove the web application's AuthService session repository is shared with tutor-api; that cross-process integration remains a release blocker for #1007. No pilot is enabled.
