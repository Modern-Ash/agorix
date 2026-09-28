# Risk Register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Presentation state leaks into canonical program | High | Hash canonical semantic fields only and assert fixture exclusions. |
| Studio and Web drift on project versions | High | Use shared `ProjectStore` and explicit unsupported schema tests. |
| Locale changes alter semantics | Medium | Test program hash stability across locale metadata changes. |
| UI-specific IDs leak into program | High | Validate serialized canonical program and scan for UI keys. |
| Fixture becomes stale | Medium | Build fixture through shared contracts, not hand-waved UI state. |
