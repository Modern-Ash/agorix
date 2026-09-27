# Issue 95 Bolts

## Bolt A: Legacy Migration Note

- Document #27 as preserved, superseded, and migrated.
- Include current tutor-api behaviors that must remain true in the new architecture.

## Bolt B: Optional Commercial Adapter

- Implement or adapt one remote commercial-provider-compatible path behind provider-runtime.
- Keep provider/model/base URL/auth configurable.
- Require no credentials for tests or default runtime.

## Bolt C: Conformance And Safety Tests

- Exercise mocked success, invalid response, timeout/outage, and fallback behavior.
- Verify ProgramProposal validation applies before any canonical runtime mutation.

## Bolt D: Provider-Neutral Docs

- Update package/provider docs with extension guidance.
- Avoid preferred proprietary vendor language.
- Capture construction evidence for tests and migration mapping.
