# Ori educator pilot — deterministic baseline evidence

The tutor server already exposes a Kids Ori flow using `evaluateOriAgentOutput` as fallback and optionally `options.ori.respond`. That production-facing flow accepts validated mission/program context; the synthetic `ori/shadow-plan/v1` evaluation protocol uses only mission index, hint level and script count. They are **not equivalent inputs**, so the five synthetic fixtures cannot yet be claimed to be actual deterministic-tutor executions.

This increment adds a metadata validation gate for five independently captured baseline hints. Each record must identify its fixture, mission index, hint level, declared deterministic source, a non-empty capture reference and bounded hint/next-step text. It rejects incomplete or mismatched batches.

## Critical evidence boundary

The validator does not execute the tutor or authenticate the capture reference. A caller could fabricate a record that passes schema validation. Therefore, **passing the validator is not proof of provenance**. A future adapter must execute the real deterministic tutor on documented synthetic program fixtures, preserve exact mission and context, and attach a reproducible trace or test reference. Only then should the outputs be used as evidence in a blind educator comparison.

No Kids API, rollout flag or stable branch is changed.
