# Non-functional Requirements

- NFR-001 Accessibility: interactive controls have visible focus, keyboard activation, non-color-only state and at least 44x44 CSS px touch targets.
- NFR-002 Responsiveness: the layout supports 768x1024, 820x1180, 1024x768, 1180x820, 1366x1024 and desktop without incoherent overlap or hidden Code.
- NFR-003 State continuity: orientation changes must preserve canonical program state through React state/local persistence, not remount into data loss.
- NFR-004 Localization resilience: English and Spanish labels must wrap or reflow without breaking controls or hiding mission/code surfaces.
- NFR-005 Visual system compliance: new UI uses #117 semantic tokens, softer surfaces and meaningful accents rather than heavy black bordered POC styling.
- NFR-006 Performance: the shell must remain static/lightweight and must not introduce provider or network dependencies.
- NFR-007 Safety/privacy: no child PII, secrets or provider credentials enter source, tests or fixtures.
