# Ori adult-review streaming body limit

The internal `readOriReviewBody` helper limits request accumulation to 512 UTF-8 bytes by default, then decodes strictly and delegates to `parseOriReviewInput`.

- Rejects as soon as cumulative chunks exceed the cap.
- Never consumes subsequent chunks after detecting overflow.
- Rejects malformed UTF-8, invalid JSON, unexpected fields and stream errors.
- Uses synthetic metadata only in tests.
- No HTTP endpoint is registered and no Kids response changes.

## Integration gate

The future HTTP route must call the trusted-host, Origin, authenticated-session and CSRF preflight **before** consuming a body. It must also apply per-principal rate limits, handle aborted requests, and decide how to drain or close oversized HTTP connections safely.

The helper cannot prevent a malicious stream from sending a single oversized chunk before Node delivers it; it limits retained bytes and stops processing immediately after detecting the overflow. It is not a substitute for reverse-proxy body limits.

Merge only into `integration/ori` after all six CI checks pass.
