<!-- agora-ai-sdlc:deterministic-construction/v1 -->

# Domain Model

This proposal is derived only from already approved Inception artifacts.
It is non-authoritative implementation guidance; Agora Flow retains the governed source artifacts below.

## Intent

---
schema: "agora/intent/v1"
id: "issue-87"
status: "draft"
author: "project:product-owner"
affected-systems: ["Modern-Ash/agorix"]
constraints: []
open-questions: []
source: "https://github.com/Modern-Ash/agorix/issues/87"
created-at: "2026-09-30T10:15:19.117971Z"
decided-by: null
decided-at: null
decision-reason: null
---

# Intent issue-87

## Problem

Define and implement structured ProgramProposal protocol for AI-generated changes

## Proposed outcome

Deliver the outcome described by GitHub issue #87: Define and implement structured ProgramProposal protocol for AI-generated changes

## Requirements

<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Create the domain protocol used whenever AI proposes a program change.

## Requirements

- A proposal must include:
- schema/version
- proposal id
- base program version/hash
- capability/source metadata
- pedagogical purpose
- affected canonical node ids where known
- structured operations/patch
- child-facing rationale
- optional concept tags
- no executable arbitrary code payload as authority.

## Acceptance criteria

- stale proposal cannot apply to changed base
- unknown operation rejected
- resulting program must validate
- deterministic diff generated independently from model prose
- proposal can be serialized/audited without PII
- no provider SDK types leak into protocol
- tests cover insert/change/remove/stale/invalid
- integrates with UI boundary from #75.

## Constraints

- no executable arbitrary code payload as authority.
- no provider SDK types leak into protocol

## Dependencies

- No explicit dependencies.

## User Stories

# User stories — issue #87

Derived from DETERMINISTIC_INCEPTION.md (deterministic draft, pending human review).

- US-001 candidate: stale proposal cannot apply to changed base
- US-002 candidate: unknown operation rejected
- US-003 candidate: resulting program must validate
- US-004 candidate: deterministic diff generated independently from model prose
- US-005 candidate: proposal can be serialized/audited without PII
- US-006 candidate: no provider SDK types leak into protocol
- US-007 candidate: tests cover insert/change/remove/stale/invalid
- US-008 candidate: integrates with UI boundary from #75.
