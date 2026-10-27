# MIG-03 — Automated triage and educator acceptance protocol

The cross-repository test writes `ori-mig03-mission-matrix.json`, containing actual Ori loopback observations over synthetic mission inputs, the deterministic Kids baseline, technical comparisons, educator rubric, risk-first sampling, and automated triage.

## What is automated

Every mission receives one technical finding: candidate missing, observable divergence, non-comparable semantics, or observable match. Missing and divergent missions are mandatory review cases; a bounded, deterministic sample of remaining cases supports triage. The report validates sampling coverage and does not fabricate educational quality scores.

## Human acceptance

An educator must inspect the actual proposal, baseline behavior, learning context, and learner-facing explanation. For each reviewed mission, assess learner agency, progressive hints, conceptual clarity, age appropriateness, and non-application without consent. Record evidence, rationale, reviewer identity and disposition. Non-comparable semantics require explicit adjudication, not a fabricated parity score.

**The sample is not a waiver of the existing full-mission signoff gate.** Deferred missions remain pending until the approved acceptance protocol explicitly resolves their treatment. Neither this report nor a model judge grants approval. The acceptance manifest remains `rolloutAuthorized:false`.

## Outstanding before formal MIG-03 closure

- Collect representative learner scenarios and educator assessments, not just synthetic mission indices.
- Verify provenance, role authority and retained rationale in the administrative review workflow.
- Resolve missing evidence and semantic gaps; verify the complete acceptance checklist.
- Obtain human signoff and independently authorize any later MIG-04 pilot.
