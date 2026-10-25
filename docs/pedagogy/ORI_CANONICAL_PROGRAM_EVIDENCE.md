# Ori comparable-context evidence — canonical program fingerprints

This increment executes the actual deterministic Kids rule provider against each canonical mission starter program and computes a SHA-256 digest of the serialized program. The digest is generated from the program, not accepted as an arbitrary caller-supplied value.

## Evidence captured

- Canonical Kids mission ID and index.
- Script count from the actual starter program.
- SHA-256 fingerprint of `JSON.stringify(mission.starterProject)`.
- Actual deterministic rule outcome kind and proposal presence.
- Assertion that executing the rule did not mutate the starter program.

The same canonical serialization must be used when checking comparable input contexts. A digest is a reproducibility marker, **not** proof that an external Ori service received the full program or identical context.

## Next integration gate

The current Ori `/v1/plan` shadow contract receives mission index, hint level and script count, not the full program. The deterministic tutor receives a mission definition and program. Therefore, strict same-input A/B comparability is not yet established. A future evaluation protocol must either align input contracts or explicitly compare two different teaching modalities, with educator-reviewed criteria.

No Kids API, UI or production behavior changes.
