# Non-functional Requirements - issue #79

- Deterministic: same canonical program and projection version produce byte-identical text, mapping and diagnostics.
- Pure: projection must not mutate canonical program state and must perform no provider/network I/O.
- Platform-neutral: no React, Blockly, Phaser, VS Code, Capacitor or provider SDK imports in the contract package.
- Authority-safe: generated text is display/learning output only and is not executed as arbitrary source code.
- Extensible: projection discovery must not couple domain packages to web UI or a specific language implementation.
