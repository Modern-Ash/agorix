# @agorix/language-projection

Shared contract for deterministic language projections over the canonical Agorix
program model.

A projection consumes `ProjectProgram` and returns display text, language-neutral
canonical node id mappings, optional structural metadata, and explicit
diagnostics. Projection text is a learning/display surface; it is not executed as
runtime authority.
