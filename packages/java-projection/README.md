# @agorix/java-projection

Display-only Java language pack over the canonical `ProjectProgram`. It projects the whole canonical
vocabulary: every statement, every expression and every trigger the runtime can run, plus variables,
lists, custom blocks with their numbers, and the pen. A program is a `class AgorixProgram extends
Sprite`; variables and lists are fields, custom blocks and events are methods, loops and conditions are
`for`, `while` and `if`. Numbers are `double` and conditions are `boolean`, converted the way the
runtime coerces them. Java text is never run by the product; the deterministic Agorix runtime executes
the canonical program.

- `JAVA_SUPPORT_API` lists the methods a program can call, and `JAVA_SUPPORT_STUB` is a stub of
  `Sprite` with all of them. The corpus tests in `apps/web` compile the projected text against the stub
  with `javac`, so the view is proven to be valid Java, and check that no node is left unsupported.
- Names a child chose are made safe: Java keywords and support methods get a trailing `_`, repeated
  names get a number, and two scripts or custom blocks never share a method name.
- An unknown node type (a future statement the model adds before this pack knows it) produces an
  `unsupported-node` diagnostic and a visible comment instead of a wrong line.
