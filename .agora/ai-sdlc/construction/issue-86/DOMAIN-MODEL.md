<!-- agora-ai-sdlc:deterministic-construction/v1 -->

# Domain Model

This proposal is derived only from already approved Inception artifacts.
It is non-authoritative implementation guidance; Agora Flow retains the governed source artifacts below.

## Intent

---
schema: "agora/intent/v1"
id: "issue-86"
status: "draft"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: []
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/86"
created-at: "2026-09-30T12:24:28.258057Z"
decided-by: null
decided-at: null
decision-reason: null
---

# Intent issue-86

## Problem

Implement intent-to-plan learning dialogue before program generation

## Proposed outcome

Deliver the outcome described by GitHub issue #86: Implement intent-to-plan learning dialogue before program generation

## Requirements

<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Teach the learner to express and decompose intent before AI proposes code/program structure.

## Requirements

- No separate requirements section; acceptance criteria remain authoritative.

## Acceptance criteria

- clear intent can progress without unnecessary questions
- ambiguous intent triggers a pedagogically useful clarification
- no canonical mutation occurs during planning
- plan references learning objective/concepts where relevant
- learner can edit/reject plan
- deterministic fake companion supports test scenarios
- UI works without real provider credentials.

## Constraints

- no canonical mutation occurs during planning

## Dependencies

- No explicit dependencies.

## User Stories

# User stories — issue #86

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- US-001 candidate: clear intent can progress without unnecessary questions
- US-002 candidate: ambiguous intent triggers a pedagogically useful clarification
- US-003 candidate: no canonical mutation occurs during planning
- US-004 candidate: plan references learning objective/concepts where relevant
- US-005 candidate: learner can edit/reject plan
- US-006 candidate: deterministic fake companion supports test scenarios
- US-007 candidate: UI works without real provider credentials.
