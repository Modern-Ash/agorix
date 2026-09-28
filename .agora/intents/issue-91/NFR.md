<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Non-Functional Requirements — issue-91

- No external LLM required in CI.
- No hidden AI-originated mutation; every proposal is inspectable before acceptance.
- Code remains visible throughout the learner loop.
- Mission completion is independent from model judgment (deterministic runtime evidence outranks LLM claims).
- Provider-unavailable path remains safe (no broken learner experience if the LLM is unreachable).
- Child-facing copy follows the content guide.
- No permanent Scratch-style toolbox is required in the interface.
