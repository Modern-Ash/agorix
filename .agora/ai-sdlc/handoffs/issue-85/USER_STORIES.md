# Issue 85 User Stories

## US-001 Existing Tutor Hint Migration

As a learner using the current first mission, I can receive the same kind of deterministic scaffolded hint through the Learning Companion contract so the product does not regress while moving away from tutor-only naming.

Acceptance link: existing hint behavior can migrate without provider coupling.

## US-002 Capability-Routed Learning Support

As a product surface, I can ask for a specific pedagogical capability such as coach, builder, debugger, explainer, challenger or reflector and receive a structured response identifying that capability.

Acceptance link: contract supports local and remote providers equally.

## US-003 Reviewable Builder Proposal

As a learner, when the companion proposes a program structure, the output is a proposal with rationale, affected nodes and review metadata, not accepted canonical program state.

Acceptance link: builder output cannot be confused with accepted canonical state.

## US-004 Evidence-Grounded Debugger

As a learner debugging a program, I can distinguish runtime facts from companion suggestions so the model cannot invent runtime evidence.

Acceptance link: debugger context distinguishes facts from model suggestions.

## US-005 Fail-Closed Provider Output

As an app or adapter, malformed provider output is rejected before it reaches the learner UI.

Acceptance link: malformed responses fail closed.

## US-006 Data-Minimized Requests

As a child learner, I can use Learning Companion support without sending personal identity fields.

Acceptance link: no child PII required.

## US-007 Provider-Neutral Domain Package

As an implementer, I can use the domain contract with local fake providers, local model adapters or remote provider adapters without importing provider SDKs into `@agorix/tutor-contract`.

Acceptance link: package has no provider SDK dependency.
