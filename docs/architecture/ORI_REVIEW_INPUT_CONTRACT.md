# Ori adult-review request contract

This internal parser accepts only three bounded numeric metadata fields: `missionIndex`, `hintLevel` and `scriptCount`. The default request limit is 512 UTF-8 bytes.

It rejects malformed JSON, arrays, missing or unexpected fields, child identifiers, source code, noninteger or out-of-range values, and oversized requests. A valid result is an immutable metadata object.

## Important boundary

This function parses an already-buffered string. A future HTTP route must **enforce the byte limit while streaming the request body**, before buffering or parsing it, and must also enforce authenticated session, trusted host, same-origin, CSRF and rate limits. This parser is not a replacement for transport-level size enforcement.

No HTTP route, Kids output, persistence or program modification is introduced. The feature remains isolated to `integration/ori`.
