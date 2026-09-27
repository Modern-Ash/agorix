# Issue 94 Non-Functional Requirements

## Safety

- Fail closed on malformed provider output.
- Do not silently weaken capability requirements.
- Do not expose browser secrets.

## Reliability

- Timeout and cancellation are bounded and testable.
- Gateway outage is normalized as provider-runtime failure.
- Tests are deterministic and external-service free.

## Portability

- Compatible deployment classes may vary; adapter config must declare capabilities instead of assuming them.
- No OpenAI SDK dependency or product-specific domain coupling.
