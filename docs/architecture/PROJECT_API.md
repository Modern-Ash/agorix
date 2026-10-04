# Private Project API

`@agorix/project-api` (`apps/project-api`) is a transport-neutral HTTP handler,
`createProjectApi({ auth, projects, ... }).handle(request) -> response`, over the
`@agorix/auth-service` session boundary and the `@agorix/project-repository`
durable boundary. It adds no UI and no client code; a Node/edge host adapts its
HTTP server to `ApiRequest`/`ApiResponse`. Contract version: `agorix/project-api/v1`.

## Authorization model

- The account is resolved server-side from the `agorix_session` cookie via
  `AuthService.resolveSession`. The owner id passed to the repository is always
  `session account id`. No request field can carry an owner id; unknown body fields
  (`ownerId`, `accountId`, ...) are rejected with `VALIDATION/UNKNOWN_FIELD`.
- The repository is owner-scoped, so knowing a project id grants nothing. A project that
  does not exist, belongs to another account, or has a malformed id returns the identical
  `404 NOT_FOUND` response (non-enumerating; there is no 403 for projects).
- Responses never contain the owner id or account id.

## Session and CSRF

- Cookie only: `HttpOnly; SameSite=Strict; Path=/; Max-Age; Secure` (when `secureCookies`).
  Tokens are never read from query/body and never stored in `localStorage`.
- When the auth policy rotates sessions (default) the new token is returned in `Set-Cookie`;
  clients must send requests serially or retry on `SESSION_EXPIRED`.
- Every non-GET request must send `X-Agorix-Request: 1` (a non-simple header cross-site forms
  cannot set), `Content-Type: application/json` when a body is present, and, if an `Origin`
  header is present, it must be in `allowedOrigins`. Otherwise `403 CSRF_REJECTED`.
- Responses carry `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

## Endpoints

| Operation               | Request                                                              | Success                                              |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------- |
| Session/account summary | `GET /v1/session`                                                    | 200 `{ account: { alias }, session: { expiresAt } }` |
| List my projects        | `GET /v1/projects?cursor=`                                           | 200 `{ items: Summary[], nextCursor? }`              |
| Create / import         | `POST /v1/projects` `{ title, storedProject }`                       | 201 `Project`                                        |
| Get                     | `GET /v1/projects/:id`                                               | 200 `Project`                                        |
| Update (autosave)       | `PUT /v1/projects/:id` `{ expectedRevision, storedProject, title? }` | 200 `Project & { unchanged }`                        |
| Rename                  | `PATCH /v1/projects/:id` `{ expectedRevision, title }`               | 200 `Project & { unchanged }`                        |
| Duplicate               | `POST /v1/projects/:id/duplicate` `{ title? }`                       | 201 `Project` (new id, same semantic hash)           |
| Delete                  | `DELETE /v1/projects/:id?expectedRevision=`                          | 204                                                  |

`Summary = { projectId, title, revision, createdAt, updatedAt, semanticHash }`;
`Project = Summary & { storedProject }`.

## Errors

Body: `{ error: { code, message, retryable, reason?, recovery? } }`. Messages are fixed strings
and never echo client content, ids, SQL or stack traces.

| Code                | HTTP            | Meaning / client action                                                                                                                                                                             |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UNAUTHENTICATED`   | 401             | No session cookie: show sign-in                                                                                                                                                                     |
| `SESSION_EXPIRED`   | 401             | Cookie present but expired/revoked/invalid: re-authenticate, keep draft                                                                                                                             |
| `NOT_FOUND`         | 404             | Missing, not yours, or malformed id (indistinguishable); unknown routes                                                                                                                             |
| `VALIDATION`        | 400/413/415/422 | Bad schema/title/revision/body; `reason` is a stable code (e.g. `INVALID_STORED_PROJECT`, `INVALID_TITLE`, `UNKNOWN_FIELD`, `HISTORY_NOT_PERSISTED`, `PAYLOAD_TOO_LARGE`, `IDEMPOTENCY_KEY_REUSED`) |
| `REVISION_CONFLICT` | 409             | `recovery: { currentRevision, currentUpdatedAt, currentSemanticHash }` of the caller's own project only. Reload via `GET`, then merge/retry                                                         |
| `CSRF_REJECTED`     | 403             | Missing marker header or foreign Origin                                                                                                                                                             |
| `TRANSIENT`         | 503             | `retryable: true`; retry with backoff                                                                                                                                                               |

## Autosave contract

- The client debounces and PUTs the current canonical `StoredProject` with the last known
  `expectedRevision`; the response revision becomes the next expected revision.
- Idempotent: if the submitted state has the same semantic hash as the stored state (a retry
  after a lost response, or a no-op save), the server returns the stored record with
  `unchanged: true` and does not bump the revision. Rename behaves the same.
- `POST` create/duplicate accept an optional `Idempotency-Key` (8-128 chars `[A-Za-z0-9_-]`).
  Replays with the same key and body return the original response; the same key with a different
  body is `422 VALIDATION/IDEMPOTENCY_KEY_REUSED`. The cache is in-process and bounded; durable
  deduplication is out of scope.
- Undo/Redo and any history are never persisted: top-level, `storedProject` and `metadata`
  keys are allow-listed, and keys matching `undo|redo|history` are rejected
  (`HISTORY_NOT_PERSISTED`).
- The API only accepts canonical state. AI proposals, previews and rejections have no
  endpoint, so they cannot create a save; a client must call update only after the learner
  accepts a proposal (the accepted result is then an ordinary canonical save).

## Limits and normalization

Titles are trimmed, whitespace-collapsed and bounded (1-120) by the repository. `StoredProject`
passes `validateStoredProject` (schema version, program validity, cross-surface compatibility,
no identity/ownership keys, payload <= `AGORIX_PROJECT_MAX_BYTES`). Raw request bodies are capped
before parsing (`maxBodyBytes`, default project max plus 16 KiB).

## Logging

The optional `log` hook receives only `{ route, status, errorCode? }`. Cookies, tokens, titles,
project ids and payloads are never passed to it.

## Web client (issue #190)

`apps/web/src/accounts` is the Web UX over this API: an injected `AccountClient`/`ProjectApiClient`
(typed errors: unauthenticated, session-expired, not-found, validation, revision-conflict,
transient), a framework-free `WorkspaceController` (session, My Projects, autosave states, conflict
recovery, explicit local import) and the dialogs. Notes for a real server:

- Account routes are not part of `agorix/project-api/v1`. The client calls
  `POST /__dev/auth/{register,login,logout}` (`{ username, password }`); a real deployment must
  provide its own routes behind the same `AccountClient` seam. If `GET /v1/session` is not answered by
  an Agorix API the UI hides all account entry points and stays anonymous/local.
- `apps/web/src/dev/devBackend.ts` hosts `createProjectApi` + `AuthService` + in-memory repositories
  inside the Vite dev/preview server (`AGORIX_DEV_BACKEND=1`, set by Playwright). It is for dev and
  e2e only, is not part of the build output, loses state on restart and makes no production security
  claim. A concrete HTTP server with real account routes remains to be built.
- Requests are serialized client-side because sessions rotate on every authenticated call.
- The service worker never caches `/v1/*` or `/__dev/*`, so account data is not replayed offline or
  across accounts. Unsynced edits are kept in one account-scoped device draft (`agorix:account-draft`),
  cleared on sign-out or when a different account signs in. `agorix:default-project` is never written
  while an account project is open.
