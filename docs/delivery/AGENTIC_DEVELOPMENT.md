# Agentic development model

Agorix is intentionally built as a visible proof of multi-agent software delivery under Agora AI-SDLC.

## Goal

Demonstrate that different coding agents can participate in the same governed SDLC without making any one agent or vendor authoritative.

Examples include:

- Claude / Claude Code;
- OpenAI Codex;
- GitHub Copilot coding agents;
- OpenCode;
- Ollama-backed/local agents;
- future compatible agents.

These are examples of executors, not dependencies of Agorix.

## Role-oriented use

Suggested assignment model:

| SDLC role              | Typical agent use                                           |
| ---------------------- | ----------------------------------------------------------- |
| Product/intent support | Claude, Codex, Copilot, OpenCode or human                   |
| Architect              | Claude, Codex, OpenCode                                     |
| Builder                | Codex, Claude Code, Copilot, OpenCode, local agent          |
| Reviewer               | a different agent/provider than the producer where possible |
| Operator               | human or automation/agent                                   |
| Quality reviewer       | human-final for governed decisions                          |

Agora owns the work contract, evidence, provenance and gates. The selected agent only executes bounded work.

## Visibility requirements

Every implementation issue SHOULD make the execution path observable:

- producing agent/runtime;
- provider/model when available;
- session/provenance;
- produced artifact/commit/PR;
- independent reviewer agent or human;
- test/CI evidence.

The goal is to be able to compare agents by real work output without changing the project process.

## Producer/reviewer diversity

Where practical:

- Claude-produced work is reviewed by Codex/OpenCode/human;
- Codex-produced work is reviewed by Claude/OpenCode/human;
- OpenCode/local-agent work is reviewed by a different provider or human;
- the same exact runtime should not both produce and independently approve the same artifact when separation is required.

## Agent portability

Issues and specs must contain enough context that a new agent can start from GitHub + repository state. Do not depend on private chat history.

## No privileged agent

No agent may:

- self-merge;
- bypass CI;
- silently alter product scope;
- weaken child-safety requirements;
- introduce provider credentials;
- change architecture contracts without an ADR/review.

## POC evidence

The final Agorix retrospective must report:

- which agents executed which issue classes;
- handoff friction;
- token/context efficiency observations;
- defects found by independent agents;
- vendor-specific assumptions discovered;
- whether Agora contracts were sufficient to switch agents midstream.
