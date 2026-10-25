# Ori educator evaluation — offline JSON report CLI

The CLI converts a bounded JSON file of blinded educator ratings and restricted A/B source keys into a reproducible, redacted report. It does not contact Ori, store child data or register an API.

## Run

From `apps/tutor-api` after compiling TypeScript:

```bash
pnpm exec tsc -p tsconfig.json
node scripts/ori-educator-report.mjs ./educator-input.json ./educator-report.json
```

Input format:

```json
{
  "keys": [
    {"fixtureId": "movement-01", "oriCandidate": "A", "deterministicCandidate": "B"}
  ],
  "submissions": [
    {
      "reviewerId": "educator1",
      "rating": {
        "fixtureId": "movement-01",
        "candidate": "A",
        "scores": {"clarity": 4, "learnerAgency": 4, "scaffolding": 4, "contextRelevance": 4, "ageAppropriateness": 4},
        "unsafe": false,
        "rationale": "La pista orienta sin entregar la respuesta completa."
      }
    },
    {
      "reviewerId": "educator1",
      "rating": {
        "fixtureId": "movement-01",
        "candidate": "B",
        "scores": {"clarity": 3, "learnerAgency": 3, "scaffolding": 3, "contextRelevance": 3, "ageAppropriateness": 3},
        "unsafe": false,
        "rationale": "La pista es clara pero ofrece menor progresión."
      }
    }
  ]
}
```

The report includes aggregate comparisons, not source keys, reviewer identifiers or rationales. The output file is created exclusively with restrictive permissions and is never overwritten automatically.

## Security and interpretation

The input contains the confidential source key and should be handled by an evaluation coordinator. The default import limit is 64 KiB; malformed or incomplete evaluations are rejected. Results are descriptive only and must not be interpreted as proof of learning gains or child safety. The CLI has no connection to Kids or production routes.
