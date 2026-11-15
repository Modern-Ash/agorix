# Scratch import fidelity

How much of a Scratch project comes across when it is opened in Agorix. Measured on the corpus the team builds (`apps/web/src/kids/__fixtures__/scratch/corpus.ts`): synthetic projects of the kind a child makes, so the numbers show which blocks the importer handles, not how often children use them. There is still no corpus of real children's files.

A block counts as brought across when it is in the converted program (nested blocks included); a script counts as kept when it is not left out. The test `kidsScratchCorpus.test.ts` fails if either number drops, and fails if this table is out of date. After an importer change, regenerate it with `UPDATE_FIDELITY=1 pnpm vitest run kidsScratchCorpus` and raise the floors in the test.

<!-- fidelity:start -->

| Project       | Blocks | Brought across | Scripts | Scripts kept   |
| ------------- | ------ | -------------- | ------- | -------------- |
| catch-game    | 15     | 14 (93.3%)     | 4       | 4 (100.0%)     |
| pen-spiral    | 10     | 9 (90.0%)      | 2       | 2 (100.0%)     |
| quiz          | 7      | 2 (28.6%)      | 1       | 1 (100.0%)     |
| maze          | 12     | 12 (100.0%)    | 4       | 4 (100.0%)     |
| dance         | 9      | 6 (66.7%)      | 2       | 2 (100.0%)     |
| clone-rain    | 9      | 8 (88.9%)      | 2       | 2 (100.0%)     |
| timer-race    | 6      | 6 (100.0%)     | 2       | 2 (100.0%)     |
| music-box     | 5      | 5 (100.0%)     | 1       | 1 (100.0%)     |
| custom-blocks | 7      | 4 (57.1%)      | 2       | 1 (50.0%)      |
| ghost-story   | 11     | 9 (81.8%)      | 3       | 2 (66.7%)      |
| **Total**     | **91** | **75 (82.4%)** | **23**  | **21 (91.3%)** |

Left behind, most frequent first:

- another script of the sprite: 2
- control_if_else (a condition the scene has no block for): 1
- looks_nextcostume: 1
- looks_seteffectto (whirl effect): 1
- looks_switchbackdropto: 1
- looks_switchcostumeto: 1
- motion_gotoxy (value comes from another block): 1
- motion_setx (value comes from another block): 1
- operator_equals (values the scene cannot compare): 1
- pen_changePenColorParamBy: 1
- procedures_call: 1
- sensing_askandwait: 1

<!-- fidelity:end -->
