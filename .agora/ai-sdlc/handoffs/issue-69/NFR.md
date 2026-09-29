---
schema: "agora-ai-sdlc/artifact/v1"
kind: "nfr"
version: 1
id: "NFR-069"
work: "issue-69"
revision: 1
traces-to: ["INT-069","REQ-069"]
---

# Non-functional requirements

## NFR-069-01 - Transparency

Documents must prohibit invisible AI-originated program mutation and preserve a visible distinction between proposal, accepted program and executed result.

## NFR-069-02 - Determinism

Runtime evidence must remain the objective authority for program behavior and mission completion; model claims cannot replace deterministic execution facts.

## NFR-069-03 - Provider independence

The product model must avoid depending on a specific LLM, provider or commercial runtime. Mission completion and core learning flow must remain possible without AI availability.

## NFR-069-04 - Child safety and privacy

The product language must preserve existing child-safety constraints: no secrets, provider credentials, child PII, raw personal chat history or social/public sharing assumptions.

## NFR-069-05 - Reviewability

The revised documents must be specific enough for later agents to implement and test learner agency, visible evidence and reflection without private chat context.
