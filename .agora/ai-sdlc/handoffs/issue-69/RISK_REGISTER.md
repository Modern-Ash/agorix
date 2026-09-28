---
schema: "agora-ai-sdlc/artifact/v1"
kind: "risk-register"
version: 1
id: "RR-069"
work: "issue-69"
revision: 1
traces-to: ["INT-069","PLN-069"]
---

# Risk Register

## RISK-069-01 - Hidden implementation semantics leak into product docs

If the docs imply AI may silently mutate programs, later architecture work may implement an invisible code-generation path. Mitigation: require explicit proposal, learner decision and executed-result states.

## RISK-069-02 - Tutor-only language remains authoritative

If source docs keep framing AI as optional help only when stuck, later issues may miss the AI-native learner loop. Mitigation: align core docs around learning companion/scaffold terminology.

## RISK-069-03 - Runtime evidence is weakened

If AI explanation is treated as proof, mission completion and debugging become non-deterministic. Mitigation: state that runtime evidence outranks model claims.

## RISK-069-04 - Over-assistance undermines learning

If AI proposals become complete answers too early, learners lose authorship. Mitigation: define anti-over-assistance and gradual release rules in pedagogy.

## RISK-069-05 - Future issue dependencies race ahead

If #70-#72 start before #69 stabilizes, agents may implement from conflicting source truth. Mitigation: keep #106 order and treat #69 as blocking source-of-truth work.

## RISK-069-06 - Unresolved decisions get invented silently

If unclear boundaries are resolved by the agent inside prose, review loses decision visibility. Mitigation: record unresolved decisions explicitly in docs/PR evidence.
