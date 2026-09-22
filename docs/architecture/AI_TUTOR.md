# AI tutor architecture and behavior

## Goal

Help the learner reason about the current mission and program without making the tutor the programmer.

## Provider-neutral contract

Input:

- mission id/version;
- concept targets;
- sanitized canonical program;
- deterministic runtime observations/errors;
- previous hint levels;
- learner question;
- requested language/reading level if configured.

Output:

- hint level;
- child-facing message;
- optional highlighted concept/program node ids;
- no executable hidden action.

## Guardrails

- no direct provider call from browser;
- no secrets in client;
- do not send names, emails, chat history outside the minimum current learning context;
- do not claim deterministic program state not supplied by runtime;
- default to questions/hints before complete solutions;
- refuse unrelated unsafe requests using child-appropriate language;
- never ask the child for personal contact/location information.

## Availability

The editor and mission must function when tutor-api is down. UI displays “Tutor unavailable” and continues.

## POC provider strategy

Implement an interface plus a deterministic fake tutor first. Add one real LLM adapter only after contract tests exist.

## Observability

Record non-PII events:

- hint requested;
- hint level;
- mission id;
- program hash;
- completion after hint.

Do not log raw child free text by default.
