# Measurement Criteria

- MC1: Test loads a Web-created fixture in Studio.
- MC2: Test applies a Studio canonical modification and reloads it through Web-compatible `ProjectStore`.
- MC3: Test compares semantic hashes before/after round trip.
- MC4: Test asserts unsupported newer schema throws an explicit persistence error.
- MC5: Test proves presentation state is ignored/excluded from canonical semantic hash.
- MC6: Test proves locale switch changes metadata/preference only, not canonical program hash.
- MC7: Test scans/validates canonical model for absence of UI-specific identifiers.
