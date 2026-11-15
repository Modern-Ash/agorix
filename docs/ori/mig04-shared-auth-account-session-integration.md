# MIG-04 shared account and session persistence

The PostgreSQL AuthService integration now has both required durable repositories: accounts and sessions. `createOriMig04PgSharedAuthInfrastructure` composes a real `AuthService` from these adapters. Both the web login process and tutor-api must use the same PostgreSQL database and migrations; separate in-memory or SQLite account stores are not compatible.

The account repository implements lookup by normalized username and account ID, creation, credential updates and deletion. The session repository implements hashed-token lookup, creation, rotation, revocation and account-wide cleanup. Real PostgreSQL tests exercise independent clients.

## Remaining deployment integration

This PR does not claim the deployed web process already uses this provider. The web login still needs an explicit composition change and cookie compatibility verification. `main.ts` must receive the trusted AuthService and project lifecycle, while retaining legacy TutorServer behavior. Run authenticated end-to-end login, project selection, rotation, logout, propose, decision and apply, including cross-owner denial, before enabling a pilot. Keep #1007 open.
