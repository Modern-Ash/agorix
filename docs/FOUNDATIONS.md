# Agorix foundations

This document is the philosophical and pedagogical charter of Agorix. Product, architecture and curriculum documents derive from it. When they conflict, this document wins until it is amended by an ADR.

## Why Agorix exists

Children now grow up with AI that can write programs for them. If it does, they stop being authors. Agorix exists so a child can use AI as a collaborator and still be the author of what they build, and can always tell what they decided from what AI only suggested.

> AI proposes. Child decides. Runtime proves. Child explains.

> Nothing happens under the rug.

## Beliefs

1. **Authorship.** The learner creates. AI assists, proposes, challenges and explains. No AI-originated change enters the accepted program invisibly.
2. **AI is a fallible collaborator.** It is useful and sometimes wrong. Learners learn to direct it, to predict before trusting, and to verify.
3. **Evidence over eloquence.** The deterministic runtime, not fluent language, proves behavior and mission completion.
4. **Mistakes are material.** Failed predictions and surprising results are where learning happens. The agent never plants bugs to teach critique.
5. **Support is temporary.** Scaffolding is visible, attributable and removable, and it shrinks as the learner grows.
6. **Silence is respect.** The agent's default is to say nothing; it offers only when evidence justifies it.
7. **Equity.** Agorix works offline, without an account, on modest devices, in the learner's language, and without paid AI.
8. **Privacy over engagement.** Child safety and privacy outrank personalization and convenience.

## Lineage

| Source                                                                                                                                                                                                                                                                              | What Agorix takes from it                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Papert, constructionism                                                                                                                                                                                                                                                             | People learn best by building something they care about and can share. Basis of "the learner creates".                                                                |
| Resnick, four Ps (projects, passion, peers, play) and the creative learning spiral (imagine, create, play, share, reflect)                                                                                                                                                          | Basis of the Web experience: a Scratch native to AI.                                                                                                                  |
| Vygotsky, Wood, Bruner and Ross, scaffolding and the zone of proximal development                                                                                                                                                                                                   | Basis of the hint ladder (levels 0-5) and gradual release of responsibility.                                                                                          |
| Sentance, [PRIMM](https://computingeducationresearch.org/projects/primm/) (predict, run, investigate, modify, make)                                                                                                                                                                 | Basis of "predict before run" and reading code before writing it; maps to the Director/Auditor loop.                                                                  |
| UNESCO, [AI Competency Framework for Students](https://www.unesco.org/en/articles/ai-competency-framework-students)                                                                                                                                                                 | Four dimensions (human-centred mindset, ethics of AI, AI techniques and applications, AI system design) and three levels (understand, apply, create).                 |
| OECD and European Commission, [AI Literacy Framework for primary and secondary education](https://www.computingatschool.org.uk/resources/2025/august/an-ai-literacy-framework-for-primary-and-secondary-education/) (May 2025 review draft; a 2026 OECD edition exists, unverified) | Four domains: engaging with, creating with, managing and designing AI. Verify the final edition before citing it as final.                                            |
| AI4K12, [five big ideas](https://ai4k12.org/artificial-intelligence-thinking-in-k-12/)                                                                                                                                                                                              | Perception, representation and reasoning, learning, natural interaction, societal impact.                                                                             |

Agorix's own contribution is **authorship plus evidence**: a visible boundary between proposal, accepted program and executed result, enforced by the product rather than taught as advice.

## Mapping the progression

| Agorix stage | PRIMM               | UNESCO level | OECD-EC domain                |
| ------------ | ------------------- | ------------ | ----------------------------- |
| Explore      | Predict, Run        | Understand   | Engaging with AI              |
| Connect      | Investigate         | Understand   | Engaging with AI              |
| Translate    | Investigate, Modify | Apply        | Creating with AI              |
| Collaborate  | Modify              | Apply        | Creating with AI, Managing AI |
| Create       | Make                | Create       | Creating with AI, Managing AI |
| Critique     | Make                | Create       | Managing AI, Designing AI     |

This mapping is a starting hypothesis to validate with educators, not a certification claim.

## The two experiences

- **Agorix Web** is a Scratch native to AI: projects, play and peers first, with the agent as a companion character whose suggestions are ghost blocks the child can drag in or ignore.
- **Agorix Studio** is an IDE-native workspace in the style of spec-driven tools: the learner states intent, reviews a plan, builds in bounded steps, predicts, runs, compares and explains.

Both are views of one shared core. The same program has the same meaning on both.

## Commitments and limits

- No hidden AI code, no hidden program mutation.
- Core learning works with AI disabled.
- No mission is completed by AI judgment.
- No personal data is requested to personalize support.
- No provider or model is a product dependency.
- The agent never claims behavior the runtime has not observed.
- Reflection never blocks basic completion.

Public benefit commitments are in [`product/PUBLIC_BENEFIT.md`](./product/PUBLIC_BENEFIT.md).
