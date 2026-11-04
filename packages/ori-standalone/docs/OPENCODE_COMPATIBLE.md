# OpenCode-compatible local gateway (experimental)

This adapter targets an **OpenAI-compatible HTTP gateway** bound to loopback, not the OpenCode CLI directly. Do not assume a standard OpenCode installation exposes `/v1/chat/completions`; a separate compatible gateway must be configured and tested. No external URLs or credentials are accepted.

`createOpenCodeCompatibleAdapter({endpoint:"http://127.0.0.1:4096",model:"local-educational"})` implements the same `complete(request,{signal})` provider port as Ollama. It sends only `intent`, `learningStage`, `attempts`, and `hintsUsed` rendered into a constrained educational prompt. It does not send child messages, programs or traces.

This adapter does **not** prove native OpenCode interoperability. A native CLI/SDK adapter, if required, needs separate protocol verification, sandboxing, and tests. It is not approved for child-facing production.
