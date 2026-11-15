# MIG-04 trusted session lifecycle integration

The shared PostgreSQL AuthService production host now exposes `sessionActions` for trusted server-side handlers. It resolves the account and session through AuthService, selects only owned projects, revokes the real authentication token before cleaning up the active-project mapping, and uses the verified-password account deletion callback to clear account-wide mappings. A session that rotates during these operations is denied until the caller coordinates cookie delivery; no stale identity is silently accepted.

These actions are not public HTTP routes. The deployed web handlers still need to call them with a verified session token, and `main.ts` must explicitly select the integrated host while preserving legacy behavior. The pilot remains disabled. The next consolidated acceptance must exercise authorized propose/decision/apply and cross-owner denial.
