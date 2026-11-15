# MIG-04 authenticated HTTP session rotation

The real AuthService rotates session tokens on resolution. Previously the project-selection and logout actions rejected rotated identities, so the new web routes could not complete their lifecycle after a normal login. This change coordinates the replacement token with project selection: it clears the old session-project mapping, issues the replacement Secure/HttpOnly cookie, and then selects the project for the verified new session. Logout revokes the replacement credential and clears the relevant mappings. Account deletion continues to use password verification.

This fixes the server-side route lifecycle, not the production `main.ts` switch or successful Ori propose/decision/apply acceptance. The pilot remains disabled and #1007 stays open.
