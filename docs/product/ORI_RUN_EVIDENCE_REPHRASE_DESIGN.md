# Rephrasing what Ori noticed with a model: design for review

Last increment of [ORI_RUN_EVIDENCE_PLAN.md](ORI_RUN_EVIDENCE_PLAN.md). Not built. The owner decided model rephrasing is in scope; this says how to do it without giving up the rule that the runtime proves and a model never decides that something went wrong.

## Principle

The finding and its local sentence always exist and always come first. A model may only offer **another way to say the same finding**. It never sees the program, never decides what is wrong, never proposes a change, and nothing it writes enters the program.

## What exists to build on

- `findingSentence` (es/en, by age band) is the always-available answer.
- `toProviderFinding` is the only thing allowed to leave the device: kind, counts, event or loop type. No ids, names, text or values (tested).
- The tutor server already hosts model-backed routes with a fixed pattern: same-origin request, host CLI model that stops at 7 s, Nginx at 9 s, browser at 10 s (`ORI_BROWSER_TIMEOUT_MS`), output validated, local fallback on any failure (`runOriChat`, `respondStudio`).
- `validateLearningCompanionSafety` and the chat's closed contract show the house style: strict key sets, size caps, a refusal path.

## Proposed contract

New route `POST /api/tutor/run-finding/rephrase` (same-origin, JSON, small body cap), next to `/api/tutor/studio/ori`.

Request (all closed values, validated on the server):

```
{ version: "agorix/run-finding-rephrase/v1", locale: "es"|"en", band: "6-8"|"9-12"|"13+",
  finding: ProviderFinding, local: <the local sentence> }
```

`local` is sent so the model rephrases a known-good sentence instead of inventing one; it is built from the finding by local copy, so it contains no learner text either (message and key names are replaced by the words "el mensaje" / "la tecla" in this path).

Response: `{ version, text }` or an error; the browser treats anything else as "no rephrase".

## Validation, in order, all deterministic

1. Strict JSON shape, no extra keys, `text` a string.
2. Length: at most 160 characters (the chat's cap), one or two sentences.
3. **Allowlist of content**: no digits except the finding's own counts; no URLs, emails, handles, emoji; no characters outside the language's alphabet and basic punctuation.
4. **No new instructions**: the text may not tell the learner to do anything beyond what the finding's kind allows (a small phrase list per kind: "mirá", "probá", "fijate" are fine; imperatives that name blocks other than those in the finding are not).
5. Voseo audit for Spanish (the same rules as the copy tests); reading-level cap per band (word length and sentence length bounds).
6. `validateLearningCompanionSafety` on a coach response built from it.
7. Any failure, a late answer or no model: the local sentence stays and nothing is shown to say a rephrase failed.

An adversarial fixture set (prompt injection in `local`, personal-data bait, over-long, wrong language, extra keys, a different finding's meaning) must all end at the local sentence. A fake provider keeps the tests offline.

## What the learner sees

Recommended: **only on request.** The marker opens with the local sentence as today; a small _Decímelo de otra forma_ button asks for the rephrase and shows it below, never replacing the first sentence. Nothing is requested before the child asks, so no model text appears unprompted and no request is made for runs nobody looks at. Each tap is one request, with a per-session cap (the existing request budget) and the usual 10 s limit.

## Controls and privacy

- Off unless an adult turns it on (new switch next to the Ori suggestions one) and the host has a model configured; absent either, the button is not shown.
- Provider and model are host configuration, not product code (`routing.profile` as for the other routes).
- The request carries no project, program, name or typed text, no account or device id. Nothing is logged beyond status and latency.
- No counters of rephrase use in the learner's evidence; an adult-only whole-number counter (`oriRephrased`) is the most it should have, and only if wanted.

## Out of scope

Any model decision about whether to show a finding, which finding, or what to change; rephrasing fix proposals (they stay deterministic and reviewable); chat about findings.

## Decisions (owner, 2026-11-08)

1. **Free text, restricted by validation** (not closed variants). Read as: the model writes the sentence, and every check above is applied by code, never by the model; any failure keeps the local sentence.
2. **On request only.**
3. **On by default** wherever the host has a model configured (the adult Ori switch still turns it off, because the marker itself is hidden then).
4. **Adult counter: yes** (`oriRephrased`, whole number).

## As built (PR #1288)

- `@agorix/ori-agent` `rephrase.ts`: the closed request, the instructions, the validation chain and `runOriRephrase`. Check 6 uses the chat's unsafe and personal-data filters on the text (`isUnsafeOrPersonalText`) instead of a full learning-companion response, which needs a mission and a program this path never has.
- Route `POST /api/tutor/run-finding/rephrase` in the tutor server. It reuses the **chat** capability's policy and rate budget rather than adding a capability to the admin configuration; the chat budget is small, which suits a tap on request.
- Web: _Decímelo de otra forma_ in the marker. The sentence it sends has the learner's message names taken out. A missing host or model (404, 502, 503, 504) hides the button for the session; any other failure shows one short note and keeps the button. The first sentence is never replaced.
- A deviation from the text above: a failure now shows a short note, because a button that silently does nothing is worse than one that says so.
