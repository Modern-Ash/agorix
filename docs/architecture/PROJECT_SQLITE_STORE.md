# Durable project and account storage (#347)

`apps/server` can run with `AGORIX_PROJECT_STORAGE=sqlite` and an absolute
`AGORIX_PROJECT_DB_PATH`. It uses Node 22.23.2's built-in SQLite driver, one serialized
connection, WAL, a 5-second busy timeout and foreign keys. The existing SQL
account, session and project repositories share that connection. Session token
rotation runs in a transaction; project revisions use a guarded SQL update.
The `node:sqlite` API is still marked experimental in this pinned Node release;
test it before changing the runtime version.

On startup, the server applies the versioned migrations exported by
`@agorix/auth-service` and `@agorix/project-repository`. Each migration and its
SHA-256 digest is recorded in `agorix_schema_migrations`. Startup rejects unknown
or changed migration entries. Schema edits therefore need a **new** migration id;
never edit one that has shipped. PostgreSQL remains possible through the existing
executor interfaces, but this deployment uses SQLite.

The Web Compose file has a `projects` service behind the explicit `accounts`
profile. Its database lives in the named `agorix-project-data` volume; a separate
`agorix-project-backups` volume holds snapshots. The Web service has no dependency
on `projects`, and its `/v1/*` fallback remains JSON 404 while the service is off.
Building or deploying Web does not activate accounts. Activation requires a
separate product-owner decision.

## Activate after approval

From a clean, merged `main` on the host, after the Web image with the socket
proxy is deployed:

```bash
export AGORIX_PROJECT_ORIGIN=https://agorix.modern-ash.com
source scripts/web-deploy-lib.sh
compose --profile accounts build projects
compose --profile accounts up -d projects
curl -i https://agorix.modern-ash.com/v1/session
```

The last request should return JSON `401 UNAUTHENTICATED`, indicating the
service is reachable without creating an account. The service logs only method,
status and elapsed time. Keep `AGORIX_PROJECT_ORIGIN` in
`~/.config/agorix/projects.env` for later Compose and backup commands. The file
must contain only host-local configuration and must not be committed.

## Back up

`scripts/backup-projects.sh` runs a one-shot container against the live data
volume. It uses SQLite's online backup API, checks the snapshot's integrity and
atomically moves it into the backup volume. It never copies a live WAL file with
`cp`. Run it manually once before enabling the schedule:

```bash
scripts/backup-projects.sh
mkdir -p ~/.config/systemd/user
cp deploy/web/agorix-project-backup.{service,timer} ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now agorix-project-backup.timer
```

The timer runs daily at 03:00 and catches up after downtime. Copy snapshots off
the host regularly: both named volumes normally reside on the same disk. Monitor
free space and apply an operator retention policy; snapshots are not deleted
automatically.

## Restore

First stop the project service. Pick a verified snapshot from the backup volume,
then copy it into the data volume with the service stopped. Replace
`SNAPSHOT.sqlite` with the exact basename reported by the backup command:

```bash
source scripts/web-deploy-lib.sh
compose --profile accounts stop projects
compose --profile accounts run --rm --no-deps --entrypoint sh projects -c \
  'cp /backups/SNAPSHOT.sqlite /data/agorix.sqlite.restore && \
   rm -f /data/agorix.sqlite-wal /data/agorix.sqlite-shm && \
   mv /data/agorix.sqlite.restore /data/agorix.sqlite'
compose --profile accounts up -d projects
curl -i https://agorix.modern-ash.com/v1/session
```

Restore from a snapshot to a **new volume first** when investigating an
incident; the command above replaces live data. A local container test for this
issue recreated the service with the same data volume, then restored an online
snapshot into another volume and retrieved the original project and session over
HTTP. `apps/server/src/sqlite.test.ts` covers repository persistence, guarded
revisions and snapshot restoration without Docker.
