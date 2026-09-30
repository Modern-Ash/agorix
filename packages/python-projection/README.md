# Python projection

Agorix projects the canonical program to beginner-readable Python through
`@agorix/python-projection`.

The output is **pedagogical source**, not an independently executable authority.

Functions such as:

```python
move(10)
turn(90)
touching_goal()
```

represent an Agorix support API. The deterministic Agorix runtime remains the authority for execution and mission completion. Agorix does not evaluate arbitrary projected Python.

## Example correspondence

Agorix Code:

```text
when start
  repeat 4 times
    move 10
  if touching goal
    turn 90
```

Python:

```python
def on_start():
    for _ in range(4):
        move(10)
    if touching_goal():
        turn(90)
```

Both are projections of the same canonical nodes and expose node-to-text mappings through the shared LanguageProjection contract.

Empty Python suites use `pass` only because Python syntax requires a body; this is projection boilerplate and introduces no canonical behavior.

A future controlled Python runtime may be designed separately. It must not change the authority of the canonical program merely because this projection resembles executable Python.
