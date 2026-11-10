import { n, scratchProject, type Node, type ScratchJson } from "./builder.js";

/**
 * Ten projects of the kind a child makes in Scratch 3, written by the team (no real child's work
 * and no copied project). They exist to MEASURE the importer: what fraction of the blocks and
 * scripts comes across, and what is left behind and why. Add one when a new kind of project
 * matters; the measurement test shows the effect on every number.
 */
const v = (name: string, id: string): Node => n("data_variable", { f: { VARIABLE: [name, id] } });
const key = (k: string) => ({ KEY_OPTION: k });
const touching = (what: string): Node =>
  n("sensing_touchingobject", {
    menu: { TOUCHINGOBJECTMENU: ["sensing_touchingobjectmenu", "TOUCHINGOBJECTMENU", what] },
  });
const broadcast = (message: string): Node =>
  n("event_broadcast", {
    menu: { BROADCAST_INPUT: ["event_broadcast_menu", "BROADCAST_OPTION", message] },
  });
const onMessage = (message: string): Node =>
  n("event_whenbroadcastreceived", { f: { BROADCAST_OPTION: [message, `msg-${message}`] } });
const flag = n("event_whenflagclicked");
const setVar = (name: string, id: string, value: number | string): Node =>
  n("data_setvariableto", { f: { VARIABLE: [name, id] }, in: { VALUE: value } });
const changeVar = (name: string, id: string, by: number): Node =>
  n("data_changevariableby", { f: { VARIABLE: [name, id] }, in: { VALUE: by } });

export interface CorpusEntry {
  readonly name: string;
  readonly about: string;
  readonly project: ScratchJson;
}

export const SCRATCH_CORPUS: readonly CorpusEntry[] = [
  {
    name: "catch-game",
    about: "Move a cat with the arrows and catch a falling apple for points.",
    project: scratchProject(
      [
        {
          name: "Cat",
          y: -120,
          scripts: [
            [
              n("event_whenkeypressed", { f: key("right arrow") }),
              n("motion_changexby", { in: { DX: 15 } }),
            ],
            [
              n("event_whenkeypressed", { f: key("left arrow") }),
              n("motion_changexby", { in: { DX: -15 } }),
            ],
            [
              flag,
              n("motion_gotoxy", { in: { X: 0, Y: -120 } }),
              setVar("score", "v-score", 0),
              n("looks_say", { in: { MESSAGE: "Catch it!" } }),
            ],
          ],
        },
        {
          name: "Apple",
          y: 150,
          size: 60,
          scripts: [
            [
              flag,
              n("motion_gotoxy", { in: { X: 0, Y: 150 } }),
              n("control_forever", {
                sub: [
                  n("motion_changeyby", { in: { DY: -6 } }),
                  n("control_if", {
                    in: { CONDITION: touching("Cat") },
                    sub: [
                      changeVar("score", "v-score", 1),
                      n("sound_play", {
                        menu: { SOUND_MENU: ["sound_sounds_menu", "SOUND_MENU", "Pop"] },
                      }),
                      n("motion_gotoxy", { in: { X: 0, Y: 150 } }),
                    ],
                  }),
                  n("control_if", {
                    in: {
                      CONDITION: n("operator_lt", {
                        in: { OPERAND1: n("motion_yposition"), OPERAND2: -150 },
                      }),
                    },
                    sub: [
                      n("motion_sety", { in: { Y: 150 } }),
                      n("motion_setx", {
                        in: { X: n("operator_random", { in: { FROM: -200, TO: 200 } }) },
                      }),
                    ],
                  }),
                ],
              }),
            ],
          ],
        },
      ],
      { variables: { "v-score": ["score", 0] } },
    ),
  },
  {
    name: "pen-spiral",
    about: "Draw a growing coloured spiral with the pen.",
    project: scratchProject([
      {
        name: "Painter",
        scripts: [
          [
            flag,
            n("pen_clear"),
            n("pen_penDown"),
            n("pen_setPenSizeTo", { in: { SIZE: 3 } }),
            n("pen_setPenColorToColor", { in: { COLOR: "#ff0000" } }),
            n("control_repeat", {
              in: { TIMES: 36 },
              sub: [
                n("motion_movesteps", { in: { STEPS: 40 } }),
                n("motion_turnright", { in: { DEGREES: 91 } }),
                n("pen_changePenColorParamBy", {
                  in: { VALUE: 5 },
                  menu: { COLOR_PARAM: ["pen_menu_colorParam", "colorParam", "color"] },
                }),
              ],
            }),
            n("pen_penUp"),
          ],
          [n("event_whenkeypressed", { f: key("space") }), n("pen_stamp")],
        ],
      },
    ]),
  },
  {
    name: "quiz",
    about: "Ask a question, check the typed answer, keep a score.",
    project: scratchProject(
      [
        {
          name: "Teacher",
          scripts: [
            [
              flag,
              setVar("score", "v-score", 0),
              n("sensing_askandwait", { in: { QUESTION: "What is 2 + 2?" } }),
              n("control_if_else", {
                in: {
                  CONDITION: n("operator_equals", {
                    in: { OPERAND1: n("sensing_answer"), OPERAND2: 4 },
                  }),
                },
                sub: [
                  changeVar("score", "v-score", 1),
                  n("looks_say", { in: { MESSAGE: "Correct!" } }),
                ],
                sub2: [n("looks_say", { in: { MESSAGE: "Not quite" } })],
              }),
              n("looks_sayforsecs", {
                in: {
                  MESSAGE: n("operator_join", {
                    in: { STRING1: "Score: ", STRING2: v("score", "v-score") },
                  }),
                  SECS: 2,
                },
              }),
            ],
          ],
        },
      ],
      { variables: { "v-score": ["score", 0] } },
    ),
  },
  {
    name: "maze",
    about: "Walk through a maze with the arrows; touching the wall sends you back.",
    project: scratchProject([
      {
        name: "Hero",
        x: -200,
        y: -140,
        size: 40,
        scripts: [
          [
            n("event_whenkeypressed", { f: key("up arrow") }),
            n("motion_changeyby", { in: { DY: 10 } }),
          ],
          [
            n("event_whenkeypressed", { f: key("down arrow") }),
            n("motion_changeyby", { in: { DY: -10 } }),
          ],
          [
            flag,
            n("motion_gotoxy", { in: { X: -200, Y: -140 } }),
            n("control_forever", {
              sub: [
                n("control_if", {
                  in: { CONDITION: n("sensing_touchingcolor", { in: { COLOR: "#0000ff" } }) },
                  sub: [n("motion_gotoxy", { in: { X: -200, Y: -140 } })],
                }),
                n("control_if", {
                  in: { CONDITION: touching("Goal") },
                  sub: [broadcast("win"), n("control_stop", { f: { STOP_OPTION: "all" } })],
                }),
                n("motion_ifonedgebounce"),
              ],
            }),
          ],
        ],
      },
      {
        name: "Goal",
        x: 200,
        y: 140,
        scripts: [
          [
            onMessage("win"),
            n("looks_say", { in: { MESSAGE: "You made it!" } }),
            n("looks_think", { in: { MESSAGE: "Hmm" } }),
          ],
        ],
      },
    ]),
  },
  {
    name: "dance",
    about: "A character dances: costumes, sounds and a backdrop change.",
    project: scratchProject([
      {
        name: "Dancer",
        scripts: [
          [
            flag,
            n("looks_switchbackdropto", {
              menu: { BACKDROP: ["looks_backdrops", "BACKDROP", "Concert"] },
            }),
            n("control_repeat", {
              in: { TIMES: 8 },
              sub: [
                n("looks_nextcostume"),
                n("sound_play", {
                  menu: { SOUND_MENU: ["sound_sounds_menu", "SOUND_MENU", "Drum"] },
                }),
                n("control_wait", { in: { DURATION: 0.3 } }),
                n("motion_turnleft", { in: { DEGREES: 15 } }),
              ],
            }),
            n("looks_switchcostumeto", {
              menu: { COSTUME: ["looks_costume", "COSTUME", "dancer-a"] },
            }),
            n("looks_changesizeby", { in: { CHANGE: 10 } }),
          ],
          [
            n("event_whenthisspriteclicked"),
            n("looks_sayforsecs", { in: { MESSAGE: "Thanks!", SECS: 2 } }),
          ],
        ],
      },
    ]),
  },
  {
    name: "clone-rain",
    about: "Make many copies of a drop that fall and disappear.",
    project: scratchProject([
      {
        name: "Drop",
        y: 160,
        size: 30,
        scripts: [
          [
            flag,
            n("looks_hide"),
            n("control_forever", {
              sub: [
                n("control_create_clone_of", {
                  menu: {
                    CLONE_OPTION: ["control_create_clone_of_menu", "CLONE_OPTION", "_myself_"],
                  },
                }),
                n("control_wait", { in: { DURATION: 0.2 } }),
              ],
            }),
          ],
          [
            n("control_start_as_clone"),
            n("motion_gotoxy", {
              in: { X: n("operator_random", { in: { FROM: -200, TO: 200 } }), Y: 160 },
            }),
            n("looks_show"),
            n("control_repeat", {
              in: { TIMES: 30 },
              sub: [n("motion_changeyby", { in: { DY: -10 } })],
            }),
            n("control_delete_this_clone"),
          ],
        ],
      },
    ]),
  },
  {
    name: "timer-race",
    about: "Race against the clock: reset the timer and react when it passes a value.",
    project: scratchProject(
      [
        {
          name: "Runner",
          scripts: [
            [
              flag,
              n("sensing_resettimer"),
              n("control_forever", {
                sub: [n("motion_changexby", { in: { DX: 3 } }), n("motion_ifonedgebounce")],
              }),
            ],
            [
              n("event_whengreaterthan", { f: { WHENGREATERTHANMENU: "TIMER" }, in: { VALUE: 5 } }),
              n("looks_say", { in: { MESSAGE: "Time is up!" } }),
              n("control_stop", { f: { STOP_OPTION: "all" } }),
            ],
          ],
        },
      ],
      { variables: { "v-best": ["best", 0] } },
    ),
  },
  {
    name: "music-box",
    about: "Play a short tune with notes and drums using the Music extension.",
    project: scratchProject([
      {
        name: "Musician",
        scripts: [
          [
            flag,
            n("music_setTempo", { in: { TEMPO: 120 } }),
            n("control_repeat", {
              in: { TIMES: 4 },
              sub: [
                n("music_playNoteForBeats", { in: { NOTE: 60, BEATS: 0.5 } }),
                n("music_playNoteForBeats", { in: { NOTE: 64, BEATS: 0.5 } }),
                n("music_playDrumForBeats", {
                  in: { BEATS: 0.25 },
                  menu: { DRUM: ["music_menu_DRUM", "DRUM", "1"] },
                }),
              ],
            }),
          ],
        ],
      },
    ]),
  },
  {
    name: "custom-blocks",
    about: "A custom block and a list: build a shopping list and read it back.",
    project: scratchProject([
      {
        name: "Helper",
        scripts: [
          [
            n("procedures_definition", { in: { custom_block: n("procedures_prototype") } }),
            n("motion_movesteps", { in: { STEPS: 10 } }),
            n("motion_turnright", { in: { DEGREES: 90 } }),
          ],
          [
            flag,
            n("data_deletealloflist", { f: { LIST: ["items", "l-items"] } }),
            n("data_addtolist", { f: { LIST: ["items", "l-items"] }, in: { ITEM: "milk" } }),
            n("data_addtolist", { f: { LIST: ["items", "l-items"] }, in: { ITEM: "bread" } }),
            n("procedures_call"),
            n("looks_say", {
              in: {
                MESSAGE: n("data_itemoflist", {
                  f: { LIST: ["items", "l-items"] },
                  in: { INDEX: 1 },
                }),
              },
            }),
          ],
        ],
      },
    ]),
  },
  {
    name: "ghost-story",
    about: "Two characters talk, one fades away, with glides and effects.",
    project: scratchProject([
      {
        name: "Ghost",
        x: 100,
        scripts: [
          [
            flag,
            n("looks_say", { in: { MESSAGE: "Boo!" } }),
            n("control_wait", { in: { DURATION: 1 } }),
            n("looks_seteffectto", { f: { EFFECT: "GHOST" }, in: { VALUE: 60 } }),
            n("motion_glidesecstoxy", { in: { SECS: 2, X: -100, Y: 50 } }),
            n("looks_changeeffectby", { f: { EFFECT: "GHOST" }, in: { CHANGE: 20 } }),
            n("sound_setvolumeto", { in: { VOLUME: 50 } }),
            n("looks_seteffectto", { f: { EFFECT: "WHIRL" }, in: { VALUE: 30 } }),
            broadcast("scared"),
          ],
        ],
      },
      {
        name: "Kid",
        x: -100,
        scripts: [
          [
            onMessage("scared"),
            n("looks_think", { in: { MESSAGE: "Eek" } }),
            n("motion_turnleft", { in: { DEGREES: 30 } }),
          ],
          [n("event_whenbackdropswitchesto", { f: { BACKDROP: "Night" } }), n("looks_hide")],
        ],
      },
    ]),
  },
];
