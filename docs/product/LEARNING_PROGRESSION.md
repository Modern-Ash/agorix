# Learning progression and adaptive scaffolding rubric

Traces to GitHub issues #63 and #70. Source: PRODUCT_INTENT.md, PEDAGOGY.md, LEARNER_JOURNEY.md and docs/architecture/PROGRAMMING_MODEL.md after issue #69.

## Purpose

Agorix progression is concept-based, not age-based. Learners move forward when they can show observable understanding across programming, human-AI collaboration and AI literacy.

The progression follows the product north star:

> AI proposes. Child decides. Runtime proves. Child explains.

AI responsibility decreases as learner autonomy increases. The learning companion may scaffold, but it must not hide code, mutate the accepted program without learner decision or replace runtime evidence with fluent explanation.

## Dimensions

Each stage combines three dimensions:

1. **Programming**: what the learner can build, read, debug and eventually modify in text.
2. **Human-AI collaboration**: how the learner expresses intent, inspects proposals, tests suggestions and explains decisions.
3. **AI literacy**: how the learner treats AI as fallible support rather than authority.

## Stage overview

| Stage       | Learner capability                                                              | Primary surface                                | AI responsibility                                              |
| ----------- | ------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Explore     | Make simple behavior happen and notice code exists                              | Blocks + Agorix Code                           | Ask simple questions and point to visible surfaces             |
| Connect     | Predict and explain correspondence between blocks, code and runtime behavior    | Blocks + code correspondence                   | Guide observation and evidence comparison                      |
| Translate   | Compare Agorix Code with another textual form such as Python                    | Blocks + Agorix Code + Python projection       | Propose analogies and highlight differences                    |
| Collaborate | Evaluate bounded AI proposals before accepting changes                          | Proposal + accepted program + runtime evidence | Offer bounded proposals and invite critique                    |
| Create      | Author larger parts in text with AI support while keeping runtime proof central | Textual code + tests/runtime                   | Coach planning, review and debugging rather than complete work |
| Critique    | Compare alternatives, models or approaches and justify choices                  | Multi-alternative review                       | Surface trade-offs; learner decides and defends evidence       |

## Stage 1: Explore

### Programming

- Uses sequence and simple events such as `when run starts`.
- Adds or rearranges movement blocks to make visible behavior happen.
- Recognizes that the code panel is the code behind the blocks.

### Human-AI collaboration

- Expresses intent in simple goal language: "make the sprite move to the goal".
- Answers one clarifying question at a time.
- Can identify whether a message is system feedback or learning-companion feedback.

### AI literacy

- Understands that AI suggestions can be wrong.
- Does not need to share private data to get programming help.
- Sees AI as a tool, not a person or final judge.

### Scaffolding rubric

- **AI may do**: ask diagnostic questions, point to the mission goal, name a relevant visible block, remind the learner to press Run.
- **AI should avoid**: producing a full solution, changing blocks, hiding the code panel or claiming what the runtime has not shown.
- **Expected learner action**: choose or place a block, run the program and describe what happened.
- **Observable evidence**: learner can say which block made the sprite move or start.
- **Escalate help when**: learner cannot identify the next visible surface after a prompt.
- **De-escalate help when**: learner can choose a block and predict a simple effect.
- **Over-assistance**: AI assembles the working program before the learner tries a block.

## Stage 2: Connect

### Programming

- Uses repetition and simple conditions.
- Reads generated code as a structured reflection of blocks.
- Connects runtime behavior to block groups and code regions.

### Human-AI collaboration

- Predicts behavior before Run when prompted.
- Inspects a bounded suggestion before deciding.
- Tests a suggestion with runtime evidence.

### AI literacy

- Understands fluent language is not proof.
- Uses runtime behavior to check an AI explanation.
- Can say "the AI suggested this, but the run showed something else."

### Scaffolding rubric

- **AI may do**: ask for a prediction, point to a block/code correspondence, explain an observed loop or condition.
- **AI should avoid**: skipping prediction, treating suggestion text as proof or moving directly to a complete solution.
- **Expected learner action**: compare prediction with runtime result and adjust blocks.
- **Observable evidence**: learner can identify a block/code region related to a runtime observation.
- **Escalate help when**: learner cannot connect behavior to any visible program area.
- **De-escalate help when**: learner explains why a loop or condition changed behavior.
- **Over-assistance**: AI gives the exact block arrangement before the learner compares evidence.

## Stage 3: Translate

### Programming

- Compares Agorix Code with another textual projection such as Python.
- Recognizes sequence, events, repetition and conditions across forms.
- Begins to notice syntax as notation for familiar concepts, not a separate subject.

### Human-AI collaboration

- Asks or answers questions about how two forms match.
- Compares alternatives without assuming one is automatically better.
- Uses runtime evidence to anchor translation.

### AI literacy

- Understands models or tools may describe the same concept differently.
- Treats translation as something to inspect, not trust blindly.
- Knows private data is irrelevant to explaining a programming construct.

### Scaffolding rubric

- **AI may do**: highlight corresponding lines, explain notation differences and offer small translation examples.
- **AI should avoid**: implying syntax fluency equals understanding or asking for provider-specific prompt tricks.
- **Expected learner action**: match a block/group to Agorix Code and a second textual form.
- **Observable evidence**: learner can explain one correspondence and one difference between forms.
- **Escalate help when**: learner treats text as unrelated to the blocks.
- **De-escalate help when**: learner predicts behavior from either representation.
- **Over-assistance**: AI translates the whole program while the learner only copies.

## Stage 4: Collaborate

### Programming

- Works with bounded proposed changes.
- Distinguishes proposal, accepted program and executed result.
- Debugs by comparing intent, accepted program, prediction and runtime evidence.

### Human-AI collaboration

- Accepts, rejects or modifies AI proposals.
- Challenges an AI answer with runtime facts.
- Tests proposals before trusting them.

### AI literacy

- Understands AI can be confidently wrong.
- Recognizes that learner decision is required before a proposal becomes program state.
- Can explain why evidence supports or refutes a suggestion.

### Scaffolding rubric

- **AI may do**: propose a small diff, explain trade-offs, ask the learner to choose or modify.
- **AI should avoid**: applying proposals invisibly, generating broad unreviewable changes or treating acceptance as automatic.
- **Expected learner action**: inspect a proposal and make a decision with a reason.
- **Observable evidence**: learner can point to what changed and why they accepted, changed or rejected it.
- **Escalate help when**: learner accepts suggestions without inspection or cannot explain the decision.
- **De-escalate help when**: learner challenges AI and uses runtime evidence independently.
- **Over-assistance**: AI creates the final working solution without learner decision points.

## Stage 5: Create

### Programming

- Authors or modifies textual code in supported roadmap contexts.
- Uses variables/state and decomposition/functions.
- Plans, tests and debugs larger behavior slices.

### Human-AI collaboration

- Uses AI for planning, review, debugging hypotheses and alternatives.
- Keeps ownership of implementation decisions.
- Requests narrower proposals when AI output is too broad.

### AI literacy

- Knows tests and runtime evidence matter more than plausible explanations.
- Understands provider/model independence.
- Does not rely on private data or model identity to make code correct.

### Scaffolding rubric

- **AI may do**: review a learner plan, suggest smaller functions, generate a narrow candidate for inspection or propose tests.
- **AI should avoid**: taking over architecture, writing large opaque blocks or replacing tests with explanation.
- **Expected learner action**: modify text intentionally, run tests/runtime and explain design choices.
- **Observable evidence**: learner can describe function boundaries, state changes and test/runtime outcomes.
- **Escalate help when**: learner cannot localize a bug or reason about state.
- **De-escalate help when**: learner writes a small change, tests it and explains the result.
- **Over-assistance**: AI writes the feature while the learner only approves a black-box answer.

## Stage 6: Critique

### Programming

- Compares multiple implementations or language projections.
- Evaluates trade-offs in readability, behavior, reliability and testability.
- Uses debugging evidence to justify alternatives.

### Human-AI collaboration

- Compares AI/model suggestions without assuming consensus is truth.
- Asks for counterexamples or risks.
- Chooses an approach and explains why.

### AI literacy

- Understands models can disagree.
- Treats benchmarks, tests and runtime evidence as stronger than confident wording.
- Separates persuasion from proof.

### Scaffolding rubric

- **AI may do**: present alternatives, summarize trade-offs, identify risks and invite justification.
- **AI should avoid**: ranking options without evidence, hiding uncertainty or optimizing for pleasing language.
- **Expected learner action**: choose and justify an approach using evidence.
- **Observable evidence**: learner can compare alternatives and cite runtime/test or readability reasons.
- **Escalate help when**: learner chooses based only on which AI sounded confident.
- **De-escalate help when**: learner asks for evidence, checks alternatives and explains trade-offs.
- **Over-assistance**: AI decides the approach and supplies the justification for the learner.

## Curriculum metadata implications

Future mission metadata can reference:

- target stage;
- programming concepts;
- collaboration behavior;
- AI literacy behavior;
- allowed scaffold levels;
- evidence required to advance;
- over-assistance guardrails.

This document does not define the final metadata schema. It defines the product rubric that a schema and tests can later encode.

## Independent review prompts

A pedagogical/product reviewer should challenge:

- Does any stage hide code or make text an advanced-only surface?
- Can AI complete work before the learner predicts, inspects or decides?
- Is understanding observable, or merely asserted?
- Does AI responsibility decrease as learner autonomy increases?
- Does the progression teach AI literacy without becoming a prompt-engineering course?

## Explicit non-goals

- Age-based gating.
- Provider/model-specific progression.
- Prompt-engineering curriculum.
- Mission completion by LLM judgment.
- Hidden code generation or hidden program mutation.
