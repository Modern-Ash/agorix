# @agorix/provider-runtime

Provider-neutral runtime and capability negotiation contract for Learning Companion adapters.

This package defines the boundary that local/open, OpenAI-compatible and optional commercial adapters implement. It deliberately contains no provider SDK dependency and no credential-bearing configuration.

Real adapters for Ollama, OpenAI-compatible gateways and commercial providers belong in later issues; this package provides deterministic fake runtimes and a conformance harness so those adapters have a stable target.
