# Content guide: child-facing language system

Traces to GitHub issue #9. Source: PEDAGOGY.md, MVP.md, CHILD_SAFETY_PRIVACY.md.
Requirements: `.agora/intents/issue-9/REQUIREMENTS.md` (R1-R6).

## Tone and reading-level principles

- Write for an 8-11 year old reader: short sentences, everyday words, no jargon
  ("iterate," "execute," "instantiate").
- Be concise and encouraging without being patronizing — no baby talk, no exclamation
  overload, no "Great job, superstar!" filler.
- Describe _behavior_, not correctness labels. Say what happened, not whether it was
  good or bad ("wrong"/"bad" framing avoided wherever a behavior-specific message
  works — R5).
- Never ask for a name, age, school, location or photo (R6).
- Second person, present tense: "Your sprite moves forward," not "The sprite has been
  moved."

## System feedback vs. AI tutor feedback

These must read as different voices (R3):

- **System feedback** (runtime, errors, success): short, factual, plain-labeled
  ("Run", "Stopped", "Goal reached"). No personality, no first person.
- **AI tutor feedback**: conversational but explicitly a _tool_, never a person.
  - Do: "The tutor thinks your loop might run more times than you meant."
  - Don't: "I'm here to help you, buddy!" or anything implying friendship,
    feelings, or human identity.
  - Tutor panel copy must make clear tutor suggestions can be wrong (e.g. a
    persistent label like "Tutor suggestion — may not be right").

## Block / toolbox labels

| Block             | Label                |
| ----------------- | -------------------- |
| `when run starts` | "When you press Run" |
| `move steps`      | "Move [N] steps"     |
| `turn`            | "Turn [N] degrees"   |
| `repeat N`        | "Repeat [N] times"   |
| `if condition`    | "If ___, then"       |
| `touching goal?`  | "Touching the goal?" |

Toolbox section headers: "Start", "Move", "Repeat & Decide", "Check" — task words,
not category jargon ("Events", "Control").

## Run / Stop / Reset

- **Run**: "Run" (button). While running: "Running…"
- **Stop**: "Stop". Confirmation not required; immediate.
- **Reset**: "Reset" with tooltip "Puts your sprite back at the start. Your blocks
  and code stay the same."

## Generated-code panel explanation

Always introduce the panel as: **"This is the code behind your blocks."** (R4)

- First-time hint (dismissible): "Every block you add shows up here as code."
- Never call it "advanced," "under the hood," or "magic."
- Label: "Code" (not "Generated Code," not "Preview").

## Mission intro

Template: "**Mission: [goal in one short sentence].** Use blocks to get there."

Example (First Mission): "**Mission: Get your sprite to the goal.** Use blocks to
move it there."

## Retry / error states (deterministic runtime errors → child-facing messages, R2)

| Runtime condition                                   | Message                                                                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Program run without any blocks in `when run starts` | "Nothing happens yet — add a block to 'When you press Run' to get started."                                             |
| Sprite never reaches goal after run completes       | "Not there yet. Your sprite stopped before reaching the goal — try adjusting how far it moves or turns."                |
| `repeat` block with 0 or missing count              | "This repeat block needs a number of times — try adding one."                                                           |
| Project file version mismatch on load               | "This project was made with a different version of Agorix and can't be opened here. Start a new project to keep going." |
| Autosave/persistence failure                        | "We couldn't save your project just now. Keep working — we'll try again, or you can try reloading."                     |

Error copy always names what happened and, where possible, a next step — never a bare
"Error" or error code.

## Success state

"**You did it! Your sprite reached the goal.**" Shown inline near the stage, tied to
the mission's completion predicate — not a full-screen takeover that hides the editor.

Follow-up line: "Want to try changing something and running it again?"

## Tutor-unavailable state

"The tutor isn't available right now. You can still finish this mission — check your
code against the blocks, and use Reset if you want a fresh start."

Never imply the tutor is "away," "sleeping," or otherwise personified.

## Hint ladder (PEDAGOGY.md levels 0-5)

- **Level 0** (no hint): no copy shown.
- **Level 1** (diagnostic question): "What do you think happens first when you press
  Run?"
- **Level 2** (concept reminder): "Repeat blocks run everything inside them, more
  than once."
- **Level 3** (point to program area): "Take a look at your `repeat` block — how many
  times does it run?"
- **Level 4** (partial structural example): "Try: `repeat 4` → `move 10 steps` →
  `turn 90 degrees`. What's missing to finish the shape?"
- **Level 5** (complete explanation, only after explicit request or repeated
  failure): full step-by-step walkthrough of the working solution.

All levels are framed as suggestions from a tool, not statements of fact ("Try…",
"One idea:…", never "You must…" or "The answer is…").

## Reflection prompt

Shown once after mission completion, optional:

"**What made your sprite start moving?**"

Skip affordance: "Skip" (equally prominent, no guilt copy like "Are you sure?").

## Wording to avoid

- "Wrong," "bad," "failed," "incorrect" as bare labels.
- "Error" without an explanation.
- First-person claims of feeling, friendship or identity from the tutor ("I'm proud
  of you," "I'm your friend").
- Praise disconnected from behavior ("You're so smart!") — prefer behavior-specific
  praise ("Your loop worked exactly as planned.").
- Any prompt requesting name, age, school, address, or photo.
- "Magic," "automatically," "under the hood" for the code panel — always name it as
  the code behind the blocks.
- Jargon: "execute," "instantiate," "null," "undefined," "syntax error" — translate
  to plain behavior language.
