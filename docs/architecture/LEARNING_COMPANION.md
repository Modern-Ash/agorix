# Learning Companion architecture

Traces to GitHub issues #63, #66, #67, #68 and #72.

## Goal

The Learning Companion helps the learner reason about the current mission, program and runtime evidence without becoming the programmer.

It can coach, propose, debug, explain, challenge and reflect, but it cannot silently mutate the accepted program.

## Core rule

```text
AI proposes
  -> validate
  -> preview / diff
  -> learner accepts, rejects or modifies
  -> canonical program
  -> deterministic runtime
  -> runtime evidence
  -> learner explanation
```

## Pedagogical roles

The same provider/model may implement several roles:

- Coach: asks questions and scaffolds thinking.
- Builder: proposes bounded program structures.
- Debugger: reasons from deterministic runtime evidence.
- Explainer: explains concepts, code and evidence.
- Challenger: asks the learner to predict, compare or justify.
- Reflector: helps the learner explain what changed and why it works.

These are pedagogical capabilities, not necessarily separate agents.

## Provider-neutral contract

Input:

- mission id/version;
- current learning target and concept stage;
- sanitized canonical program snapshot;
- deterministic runtime observations/errors;
- selected canonical node ids or visible code ranges when relevant;
- previous scaffold/hint levels;
- learner question or intent;
- requested human language/reading level if configured.

Output:

- role/capability used;
- scaffold level;
- child-facing message;
- optional ProgramProposal;
- optional highlighted concept/program node ids;
- evidence references used;
- uncertainty/provenance signal suitable for child-facing UX.

The output contains no executable hidden action.

## ProgramProposal boundary

A ProgramProposal is data, not accepted program state.

It must include:

- proposed canonical change or structural suggestion;
- affected canonical node ids;
- affected actor, script, asset and variable ids when the project has shared
  creative state or learner variables;
- expected runtime evidence that the learner can test;
- human-readable rationale;
- validation result;
- preview/diff content for the learner;
- accept/reject/modify affordance.

The canonical program mutates only after learner acceptance or learner modification.

Proposal actor, script, asset, variable and evidence ids are validated as stable
tokens and must be unique within each scope list. Canonical node ids stay as AST
paths such as `scripts[0]/statements[0]`, but duplicates are rejected so the
review surface and runtime evidence cannot double-count the same change.
Every operation must target a node declared in `affectedNodeIds`, including the
predicted insertion path for append operations.
When a proposal declares `affectedAssetIds`, any inserted or replaced
appearance, backdrop or sound statement must reference only assets in that
declared scope.
When a proposal declares `affectedVariableIds`, any inserted or replaced
variable statement or expression must reference only variables in that declared
scope.
When any affected actor, script, asset or variable scope is declared, expected
runtime evidence for that dimension must stay within the declared scope.
Runtime evidence binding reports observed actors, scripts, assets and variables only
from trace entries whose node ids are in the proposal's affected or expected
evidence sets. Actor, script, asset and variable evidence also records
expected, matched and missing ids so review surfaces can distinguish "observed
somewhere" from "proved the proposal's stated expectation".

## Grounding

Learning Companion explanations and debugging must consume deterministic facts:

- canonical program;
- mission context;
- runtime observations;
- completion predicate result;
- current learning target;
- prior scaffold level.

It must not invent runtime facts, claim unobserved state or rank provider confidence above runtime evidence.

## Guardrails

- no direct provider call from browser;
- no secrets in client;
- no provider SDKs in domain packages;
- no provider-specific fields in canonical program, curriculum, runtime or LanguageProjection contracts;
- do not send names, emails, locations, raw long-term chat history or unrelated child data to providers;
- default to questions/hints before complete solutions;
- refuse unrelated unsafe requests using child-appropriate language;
- never ask the child for personal contact/location information;
- never apply a proposed program change invisibly.

## Availability

The editor, mission, canonical program, runtime, code projection and reflection flow must function when provider adapters are disabled or unavailable.

UI may display "Learning Companion unavailable" and continue.

## Provider strategy

Implement deterministic/fake behavior first for product interaction tests.

Provider adapters may include:

- local/open model path such as Ollama;
- OpenAI-compatible gateway for local/open inference servers;
- optional commercial providers.

All adapters implement the same Learning Companion contract. Switching providers must not change canonical program semantics, curriculum contracts, runtime behavior or mission completion.

## Observability

Record non-PII events:

- scaffold/proposal requested;
- role/capability used;
- scaffold level;
- mission id;
- program hash;
- proposal accepted/rejected/modified;
- completion after scaffold;
- reflection completed/skipped.

Do not log raw child free text by default.
