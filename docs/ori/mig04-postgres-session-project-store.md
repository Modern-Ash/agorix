# MIG-04 durable authenticated session-project mapping

The `agorix_ori_session_projects` table maps an authenticated account and session to the active project. It is a server-owned PostgreSQL lookup; request-supplied project and identity headers are not trusted.

`createOriMig04PgSessionProjectInfrastructure` shares the canonical PostgreSQL pool with the project repository and CAS transaction provider. A missing mapping denies project selection, and mappings for other accounts or sessions do not resolve.

The SQL schema is exported for controlled migrations; runtime startup does not create tables. A deployed session lifecycle must create/update/revoke mappings when the user changes project or their session rotates/expires. This integration is not yet connected to the web application's actual session lifecycle or `main.ts`. Do not close #1007 until that integration and authenticated HTTP acceptance are verified.
