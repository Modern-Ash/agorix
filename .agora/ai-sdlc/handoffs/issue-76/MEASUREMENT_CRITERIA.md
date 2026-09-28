# Measurement Criteria - issue #76

- MC1: Runtime/unit tests prove the same canonical program gives the same Step sequence.
- MC2: Tests prove the active block and code projection range use the same canonical node id.
- MC3: Tests prove Step cannot advance while Run is active.
- MC4: Tests prove editing while stepped/executing clears stale cursor/frame state according to documented stop semantics.
- MC5: Tests prove Reset restores the exact initial stage and Step cursor.
- MC6: Tests document simple, repeat and conditional stepping timing in child-understandable terms.
- MC7: Tests cover simple, repeat and conditional programs.
- MC8: Web/e2e evidence proves the Step control remains usable in a narrow layout.
- MC9: Web touch metadata/control affordance treats Step as first-class beside Run/Stop/Reset.
- MC10: Studio and Web produce the same canonical step sequence from the same program.
- MC11: Viewport/orientation changes do not lose the prepared step state.
- MC12: Presentation may differ, but observation node ids and frame sequence remain identical across surfaces.
