# Agorix Code

Agorix Code is the beginner textual projection of the canonical Agorix program.

It is **not** a runtime language, an LLM-generated explanation, or a second source of program truth.

## Design decision

Agorix Code v1 uses a small stable keyword set:

```text
when start
  move 10
  turn 90
  repeat 4 times
    move 10
  if touching goal
    turn 90
```

Two-space indentation makes nesting visible without introducing braces, semicolons, declarations or runtime/library syntax.

### Why keywords are not localized

Product locale and programming projection are separate dimensions.

A learner may use the Agorix UI and Learning Companion in Spanish while reading the same canonical program as Agorix Code, Python or TypeScript. Changing UI locale must never change program semantics or canonical hash.

Learner-facing labels can explain the stable keywords in the selected product locale. A later version may add a separately versioned localized educational projection if evidence shows that it improves learning; it must not silently change `agorix-code/v1`.

## Current canonical coverage

| Canonical construct | Agorix Code                      |
| ------------------- | -------------------------------- |
| onStart             | `when start`                     |
| move                | `move 10`                        |
| turn                | `turn 90`                        |
| repeat              | `repeat 4 times` + indented body |
| if                  | `if <condition>` + indented body |
| touchingGoal        | `touching goal`                  |
| booleanLiteral      | `true` / `false`                 |
| numericLiteral      | number literal                   |

No semantic operation exists only in blocks.

## Progression

The same canonical idea can be revealed with increasing syntax.

**Blocks / concept**

```text
repeat 4
  move 10
```

**Agorix Code**

```text
repeat 4 times
  move 10
```

**Python direction**

```python
for _ in range(4):
    move(10)
```

**TypeScript direction**

```ts
for (let i = 0; i < 4; i++) {
  sprite.move(10);
}
```

The concept and canonical node identity remain stable while syntax becomes more conventional.

## Mapping

Every script/statement receives canonical node-to-text ranges through the shared `LanguageProjection` contract. Nested nodes have their own ranges; structural repeat/if ranges cover their visible nested form.

This allows block selection and runtime execution to highlight the corresponding Agorix Code.

## Editing

Agorix Code v1 is read-only projection output. Editable textual round-trip parsing is deliberately out of scope until the product has evidence that learners need it and can preserve one canonical authority.

## Pedagogical review checklist

An independent reviewer should verify:

- a beginner can distinguish sequence from nesting;
- `repeat` and `if` structure is visually apparent;
- no punctuation is required merely to satisfy a parser;
- the transition toward Python/TypeScript is recognizable;
- stable English keywords do not make the selected product locale confusing.
