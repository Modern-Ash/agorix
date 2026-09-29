# AI tutor architecture - superseded

This document is superseded by `docs/architecture/LEARNING_COMPANION.md`.

Older references to "AI tutor", `tutor-api` or `tutor-contract` must be read narrowly as legacy implementation names for provider-neutral Learning Companion infrastructure. They are not product authority and must not reintroduce the old optional-chatbot or hidden-assistant model.

The current product and architecture rule is:

> AI proposes. Child decides. Runtime proves. Child explains.

No AI-originated program mutation may enter canonical state without learner-visible proposal validation, preview/diff and learner acceptance.
