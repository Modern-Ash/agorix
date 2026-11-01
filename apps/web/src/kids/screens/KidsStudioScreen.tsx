import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
import {
  inStudioRange,
  STUDIO_BUBBLE_MAX_LENGTH,
  STUDIO_VOLUME_DELTA_RANGE,
  STUDIO_VOLUME_RANGE,
  STUDIO_X_RANGE,
  STUDIO_Y_RANGE,
  STUDIO_EFFECT_DELTAS,
  STUDIO_MOVE_CELLS,
  STUDIO_NAME_MAX_LENGTH,
  STUDIO_REPEAT_COUNTS,
  STUDIO_SIZE_DELTAS,
  STUDIO_SIZES,
  STUDIO_TURN_AMOUNTS,
  STUDIO_WAIT_SECONDS,
  studioEffectValues,
} from "../kidsStudioChoices.js";
import {
  studioCategories,
  studioCategoryId,
  type StudioCategory,
} from "../kidsStudioCategories.js";
import { starterShelf, starterStatement, type StudioStarterKind } from "../kidsPaletteCatalog.js";
import {
  createEditorHistory,
  recordCanonicalTransaction,
  redoCanonicalTransaction,
  undoCanonicalTransaction,
  type EditorHistory,
} from "@agorix/block-editor";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectPython } from "@agorix/python-projection";
import { projectJava } from "@agorix/java-projection";
import { conceptsOfProgram, reusedConcepts } from "@agorix/learning-evidence";
import { recordMastery } from "../kidsMastery.js";
import { ProjectStore, sanitizeAgorixFilename, type ProjectSceneGoal } from "@agorix/persistence";
import { KidsLoopHelp } from "./KidsLoopHelp.js";
import { KidsSceneGoalPanel } from "./KidsSceneGoalPanel.js";
import { sceneGoalValid } from "../kidsSceneGoal.js";
import { runMultiActorProgram, type MultiActorRunResult, type RuntimeEvent } from "@agorix/runtime";
import {
  acceptProposal,
  modifyProposal,
  rejectProposal,
  type ProgramProposal,
} from "@agorix/proposals";
import {
  ORI_STUDIO_INTENTS,
  oriIntentsWithin,
  proposeOriStudioIntent,
  validateOriStudioIntentProposal,
  validateOriStudioProposal,
  type OriStudioIntent,
} from "@agorix/ori-agent";
import { bandProfile, codeTabsForBand, type AgeBand, type CodeTab } from "../kidsAgeBand.js";
import { TOUCH_HOLD_MS, insertIndex, isAddControl, movedFar } from "../kidsDrag.js";
import {
  factsOfRun,
  previewCandidate,
  reflectionFor,
  type CandidatePreview,
  type Direction,
} from "../kidsStudioCoach.js";
import { StudioCoach, StudioIntentPicker, StudioPrediction } from "./KidsStudioCoach.js";
import { KidsPaletteBlock } from "./KidsPaletteBlock.js";
import {
  CHOICE_CATALOG,
  CHOICE_PROMPT_IDS,
  isChoicePromptId,
  MUSIC_BEATS,
  MUSIC_DRUMS,
  MUSIC_INSTRUMENTS,
  PEN_COLORS,
  type MusicBeats,
  type MusicDrum,
  type MusicInstrument,
  type PenColor,
  type ChoicePromptId,
} from "@agorix/program-model";
import type {
  Expression,
  Procedure,
  ProcedureParamId,
  ProjectProgram,
  Statement,
} from "@agorix/program-model";
import type { Locale } from "../../i18n.js";
import {
  KIDS_GALLERY_BACKDROPS,
  KIDS_GALLERY_CHARACTERS,
  galleryBackdropName,
  galleryCharacterName,
  isGalleryBackdropId,
  isGalleryCharacterId,
  type KidsGalleryBackdropId,
  type KidsGalleryCharacterId,
} from "../kidsGallery.js";
import { KIDS_SOUNDS } from "../kidsSoundLibrary.js";
import { processKidsImage } from "../kidsImage.js";
import { useKidsFlag } from "../kidsFlags.js";
import { playKidsSound, stopKidsSounds } from "../kidsSoundPlayer.js";
import { loadKidsMastery } from "../kidsMastery.js";
import { adaptInterventionByStage, stageBand, stagesOfProgram } from "../kidsStageAdaptation.js";
import { useInterventionPolicy } from "../kidsBehavior.js";
import { noteName, playKidsMusic, stopKidsMusic } from "../kidsMusic.js";
import {
  addStudioActor,
  addStudioList,
  addStudioProcedureNumber,
  addStudioVariable,
  bindStudioProcedureBlock,
  removeStudioProcedureNumber,
  setStudioCallNumbers,
  setStudioProcedureCallNumbers,
  type StudioCallValue,
  STUDIO_EDGE_CONDITION,
  STUDIO_NUMBER_CHOICES,
  STUDIO_NUMBER_DEFAULTS,
  STUDIO_NOTES,
  STUDIO_PANS,
  STUDIO_PEN_SIZES,
  STUDIO_PITCHES,
  STUDIO_TEMPOS,
  studioBlockHasNumberSlot,
  studioBlockNumber,
  studioProcedureNumberUnits,
  type StudioBlockPath,
  appendStudioStatement,
  creativeForStudio,
  copyStudioProcedure,
  createStudioProcedure,
  deleteStudioProcedure,
  moveStudioStatement,
  moveStudioStatementTo,
  moveStudioStatementToActor,
  type StudioListRef,
  removeStudioStatement,
  renameStudioProcedure,
  setStudioTrigger,
  studioProcedureUses,
  studioActorId,
  type StudioStatement,
  wrapStudioTail,
} from "../kidsStudioModel.js";
import {
  addStudioArt,
  listStudioProjects,
  moveStudioActorLayer,
  saveStudioProject,
  setStudioActorPosition,
  setStudioBackdrop,
  setStudioSceneGoal,
  studioSceneGoal,
  selectStudioArt,
  updateStudioArt,
  exportStudioProject,
} from "../kidsStudioProjects.js";
import { ExportMediaDialog } from "./ExportMediaDialog.js";
import {
  setStudioTutorialDone,
  studioTutorialDone,
  studioTutorialStep,
  studioTutorialText,
} from "../kidsStudioTutorial.js";
import { requestStudioOri } from "../kidsStudioOriRemote.js";
import {
  explainOriCompound,
  oriCompoundStatement,
  proposeOriCompound,
  reviewOriCompound,
  type OriCompoundJoin,
} from "../kidsOriCompound.js";
import { useOriPageVisible } from "../kidsOriMotion.js";
import { expressionForMotion, outcomeOfRun, useOriReaction } from "../kidsOriExpression.js";
import { KidsBackdrop, KidsSprite } from "./KidsArt.js";
import { OriFace } from "./OriFace.js";
import { KidsDrawArt } from "./KidsDrawArt.js";

interface Props {
  readonly id: string;
  readonly locale: Locale;
  readonly onBack: () => void;
  readonly oriSuggestions: boolean;
  /** The adult's age band; absent while the age-band switch is off, which shows every language. */
  readonly ageBand?: AgeBand | undefined;
}

const COPY = {
  es: {
    title: "Escena libre",
    back: "Volver a Crear",
    actors: "Personajes",
    add: "Agregar personaje",
    actorLimit: "Ya hay 12 personajes en esta escena.",
    backdrop: "Fondo",
    blocks: "Programa de",
    run: "Jugar",
    step: "Paso",
    reset: "Volver al inicio",
    move: "Mover",
    goTo: "Ir a posición",
    glideTo: "Deslizar a posición",
    xCoordinate: "Posición horizontal",
    yCoordinate: "Posición vertical",
    turnLeft: "Girar a la izquierda",
    turnRight: "Girar a la derecha",
    moveBackward: "Retroceder",
    turnAmount: "Grados",
    pointDirection: "Apuntar hacia",
    pointTowards: "Apuntar a",
    bounceOnEdge: "Rebotar en el borde",
    layerFront: "Pasar al frente",
    layerBack: "Pasar al fondo",
    dirRight: "derecha",
    dirDown: "abajo",
    dirLeft: "izquierda",
    dirUp: "arriba",
    costume: "Cambiar disfraz",
    switchBackdrop: "Cambiar fondo",
    sound: "Sonar",
    stopSounds: "Detener sonidos",
    stop: "Detener",
    stopScript: "este programa",
    stopActor: "este personaje",
    stopScene: "toda la escena",
    volume: "Volumen",
    volumeChange: "Cambio de volumen",
    setVolume: "Fijar volumen",
    changeVolume: "Cambiar volumen",
    say: "Decir",
    think: "Pensar",
    show: "Mostrar",
    hide: "Esconder",
    size: "Tamaño",
    wait: "Esperar",
    repeat: "Repetir",
    groupCount: "Bloques del final",
    myBlocks: "Mis bloques",
    myBlockName: "Título del bloque",
    makeBlock: "Crear bloque con estos bloques",
    useBlock: "Usar",
    renameBlock: "Cambiar nombre",
    deleteBlock: "Borrar bloque",
    inlineAndDelete: "Reemplazar usos y borrar",
    keepBlock: "Conservar",
    blockInUse: "Este bloque se usa",
    times: "veces",
    blockNumbers: "Números del bloque",
    numberTitle: "Título del número",
    addNumber: "Añadir número",
    removeNumber: "Quitar número",
    followsNumber: "Valor de",
    fixedNumber: "Fijo",
    numberFor: "Número",
    copyBlockTo: "Copiar bloque a",
    groupRepeat: "Repetir estos bloques",
    groupIf: "Si se cumple, ejecutar estos bloques",
    blocksCount: "bloques",
    sourceVariable: "Leer variable",
    mathOperator: "Operación",
    calculate: "Fijar con cálculo",
    mathFunction: "Función",
    applyFunction: "Fijar con función",
    fnAbs: "valor absoluto",
    fnRound: "redondear",
    fnFloor: "hacia abajo",
    fnCeiling: "hacia arriba",
    compareOperator: "Comparar",
    compareCalculation: "Comparar con cálculo",
    ifLabel: "Si",
    elseLabel: "Si no",
    thenMove: "mover 1",
    message: "Enviar mensaje",
    onKey: "Al pulsar",
    onMessage: "Al recibir",
    pressKey: "Pulsar tecla",
    variable: "Variable",
    list: "Lista",
    newVariable: "Crear variable",
    newList: "Crear lista",
    setVariable: "Fijar valor",
    changeVariable: "Cambiar valor",
    showVariable: "Mostrar variable",
    hideVariable: "Ocultar variable",
    listAdd: "Agregar número",
    listRemove: "Quitar elemento",
    listInsert: "Insertar número",
    listReplace: "Cambiar elemento",
    listRead: "Leer elemento en variable",
    listLength: "Guardar largo en variable",
    listIndex: "Posición (desde 1)",
    randomMin: "Azar desde",
    randomMax: "Azar hasta",
    setRandom: "Guardar azar en variable",
    saveX: "Guardar posición X",
    saveY: "Guardar posición Y",
    touchActor: "Tocando personaje",
    ifTouchActor: "Si toca, mover 1",
    groupIfTouchActor: "Si toca, ejecutar estos bloques",
    ifTouchEdge: "Si toca el borde, mover 1",
    groupIfTouchEdge: "Si toca el borde, ejecutar estos bloques",
    repeatUntil: "Repetir hasta",
    forever: "Por siempre",
    groupForever: "Repetir por siempre estos bloques",
    foreverBudget:
      "Tu programa sigue y sigue: lo paramos. Mirá cómo quedó la escena y probá cambiar el bucle.",
    waitUntil: "Esperar hasta",
    waitUntilEdge: "Esperar hasta tocar el borde",
    waitUntilTimeout:
      "La condición no se cumplió en 10 segundos del programa. Se detuvo la escena. Probá cambiar la condición y volvé a jugar.",
    askChoice: "Preguntar con opciones",
    askChoicePrompt: "Pregunta",
    askChoiceVariable: "Guardar respuesta en",
    growShrink: "Cambiar tamaño",
    exportScene: "Exportar escena",
    setEffect: "Poner efecto",
    changeEffect: "Cambiar efecto",
    clearEffects: "Quitar efectos",
    effectColor: "Color",
    effectGhost: "Fantasma",
    effectBrightness: "Brillo",
    groupUntilEdge: "Repetir hasta tocar el borde",
    groupUntilActor: "Repetir hasta tocar al personaje",
    saveDistance: "Guardar distancia",
    saveTimer: "Guardar el tiempo",
    saveMouseX: "Guardar X del ratón",
    saveMouseY: "Guardar Y del ratón",
    ifMouseDown: "Si el ratón está pulsado, mover 1",
    presetMouse: "ratón pulsado",
    senseKey: "Tecla a sentir",
    heldKeys: "Teclas mantenidas al jugar",
    penTitle: "Lápiz",
    penDown: "Bajar el lápiz",
    penUp: "Subir el lápiz",
    penColor: "Color del lápiz",
    penSize: "Grosor del lápiz",
    clearPen: "Borrar los trazos",
    musicTitle: "Música",
    playNote: "Tocar nota",
    playDrum: "Tocar percusión",
    setInstrument: "Instrumento",
    setTempo: "Velocidad",
    setPitch: "Tono",
    setPan: "Lado del sonido",
    beatsLabel: "tiempos",
    noteLabel: "Nota",
    drums: { kick: "bombo", snare: "redoblante", hat: "platillo", clap: "palmas" },
    instruments: { piano: "piano", flute: "flauta", guitar: "guitarra", bell: "campanas" },
    penColors: {
      dark: "oscuro",
      red: "rojo",
      orange: "naranja",
      green: "verde",
      blue: "azul",
      purple: "violeta",
    },
    ifKeyDown: "Si la tecla está pulsada, mover 1",
    groupIfKeyDown: "Si la tecla está pulsada, ejecutar estos bloques",
    timerSeconds: "Segundos del temporizador",
    groupUntilTimer: "Repetir hasta pasar los segundos (usá Esperar)",
    compoundTitle: "Combinar condiciones",
    compoundAdd: "Condición combinada",
    compoundGroup: "Agrupar bajo la condición combinada",
    compoundFirst: "Primera condición",
    compoundSecond: "Segunda condición",
    compoundJoin: "Unir con",
    compoundAnd: "y",
    compoundOr: "o",
    compoundNone: "solo la primera",
    compoundNot: "al revés (no)",
    presetKey: "tecla pulsada",
    presetEdge: "tocando el borde",
    presetTouch: "tocando otro personaje",
    presetTimer: "pasaron los segundos",
    randomDecimal: "con decimales",
    distanceTarget: "Distancia al personaje",
    dataName: "Nombre",
    number: "Número",
    watchers: "Datos al jugar",
    paletteLooks: "Apariencia y tiempo",
    starters: "Para empezar",
    startersNote: "Tres bloques para arrancar. La paleta completa sigue abajo.",
    paletteMotion: "Movimiento",
    paletteMedia: "Disfraces, fondos y sonidos",
    paletteLogic: "Eventos y control",
    paletteData: "Variables y listas",
    categories: "Categorías de bloques",
    event: "Cuando",
    onPlay: "Al jugar",
    onTap: "Al tocar este personaje",
    tapHint: "Tocá el personaje en el escenario después de Jugar.",
    remove: "Quitar bloque",
    undo: "Deshacer",
    redo: "Rehacer",
    code: "Código",
    idea: "Pedirle una idea a Ori",
    sheetOpen: "Agregar bloques",
    sheetClose: "Cerrar bloques",
    sheetHint: "Tocá un bloque para agregarlo a tu programa.",
    ghostNote: "Idea de Ori: todavía no está en tu programa",
    dragHint: "Arrastrá un bloque del panel hasta tu programa, o tocá el botón +.",
    moveBlock: "Arrastrar bloque",
    blockUp: "Subir bloque",
    blockDown: "Bajar bloque",
    dropHere: "Soltá acá para agregar",
    moreLanguages: "Más lenguajes",
    fewerLanguages: "Menos lenguajes",
    takeOut: "Sacar del bloque",
    giveTo: "Dar a",
    putInto: "Meter en",
    moveTo: "Mover bloque a…",
    evidenceNow: "Ahora termina en",
    evidenceWith: "Con la idea terminaría en",
    evidenceBlocks: "bloques",
    evidenceStops:
      "Ojo: con esta idea el programa no llega al final. Podés cambiarla o rechazarla.",
    ideaText: "Mirá el bloque propuesto y decidí.",
    use: "Usar idea",
    change: "Cambiar idea",
    reject: "No usar",
    facts: "Lo que pasó de verdad",
    conditionResult: "La condición se cumplió",
    yes: "Sí",
    no: "No",
    saveError: "No pudimos guardar esta escena. Probá de nuevo.",
    chooseActor: "Elegí un personaje",
    noBlocks: "Agregá un bloque para ver qué hace este personaje.",
    stage: "Escenario",
    place: "Ubicar personaje",
    drawCostume: "Dibujar disfraz",
    drawBackdrop: "Dibujar fondo",
    uploadCostume: "Agregar disfraz desde imagen",
    uploadBackdrop: "Agregar fondo desde imagen",
    ownCostumes: "Mis disfraces",
    ownBackdrops: "Mis fondos",
    edit: "Editar",
    forward: "Traer adelante",
    backward: "Enviar atrás",
  },
  en: {
    title: "Free scene",
    back: "Back to Create",
    actors: "Characters",
    add: "Add character",
    actorLimit: "This scene already has 12 characters.",
    backdrop: "Backdrop",
    blocks: "Program for",
    run: "Play",
    step: "Step",
    reset: "Back to start",
    move: "Move",
    goTo: "Go to position",
    glideTo: "Glide to position",
    xCoordinate: "Horizontal position",
    yCoordinate: "Vertical position",
    turnLeft: "Turn left",
    turnRight: "Turn right",
    moveBackward: "Move backward",
    turnAmount: "Degrees",
    pointDirection: "Point",
    pointTowards: "Point at",
    bounceOnEdge: "Bounce on edge",
    layerFront: "Go to front",
    layerBack: "Go to back",
    dirRight: "right",
    dirDown: "down",
    dirLeft: "left",
    dirUp: "up",
    costume: "Switch costume",
    switchBackdrop: "Switch backdrop",
    sound: "Sound",
    stopSounds: "Stop sounds",
    stop: "Stop",
    stopScript: "this script",
    stopActor: "this actor",
    stopScene: "the whole scene",
    volume: "Volume",
    volumeChange: "Volume change",
    setVolume: "Set volume",
    changeVolume: "Change volume",
    say: "Say",
    think: "Think",
    show: "Show",
    hide: "Hide",
    size: "Size",
    wait: "Wait",
    repeat: "Repeat",
    groupCount: "Last blocks",
    myBlocks: "My blocks",
    myBlockName: "Block title",
    makeBlock: "Make a block from these blocks",
    useBlock: "Use",
    renameBlock: "Rename",
    deleteBlock: "Delete block",
    inlineAndDelete: "Replace uses and delete",
    keepBlock: "Keep",
    blockInUse: "This block is used",
    times: "times",
    blockNumbers: "Block numbers",
    numberTitle: "Number title",
    addNumber: "Add number",
    removeNumber: "Remove number",
    followsNumber: "Value of",
    fixedNumber: "Fixed",
    numberFor: "Number",
    copyBlockTo: "Copy block to",
    groupRepeat: "Repeat these blocks",
    groupIf: "If true, run these blocks",
    blocksCount: "blocks",
    sourceVariable: "Read variable",
    mathOperator: "Operation",
    calculate: "Set from calculation",
    mathFunction: "Function",
    applyFunction: "Set with function",
    fnAbs: "absolute value",
    fnRound: "round",
    fnFloor: "round down",
    fnCeiling: "round up",
    compareOperator: "Compare",
    compareCalculation: "Compare with calculation",
    ifLabel: "If",
    elseLabel: "Else",
    thenMove: "move 1",
    message: "Broadcast message",
    onKey: "When key pressed",
    onMessage: "When receiving",
    pressKey: "Press key",
    variable: "Variable",
    list: "List",
    newVariable: "Create variable",
    newList: "Create list",
    setVariable: "Set value",
    changeVariable: "Change value",
    showVariable: "Show variable",
    hideVariable: "Hide variable",
    listAdd: "Add number",
    listRemove: "Remove item",
    listInsert: "Insert number",
    listReplace: "Replace item",
    listRead: "Read item into variable",
    listLength: "Save length into variable",
    listIndex: "Position (from 1)",
    randomMin: "Random from",
    randomMax: "Random to",
    setRandom: "Save random in variable",
    saveX: "Save X position",
    saveY: "Save Y position",
    touchActor: "Touching character",
    ifTouchActor: "If touching, move 1",
    groupIfTouchActor: "If touching, run these blocks",
    ifTouchEdge: "If at edge, move 1",
    groupIfTouchEdge: "If at edge, run these blocks",
    repeatUntil: "Repeat until",
    forever: "Forever",
    groupForever: "Repeat these blocks forever",
    foreverBudget:
      "Your program keeps going: we stopped it. Look at the scene and try changing the loop.",
    waitUntil: "Wait until",
    waitUntilEdge: "Wait until touching the edge",
    waitUntilTimeout:
      "The condition did not become true in 10 program seconds. The scene stopped. Try changing the condition and play again.",
    askChoice: "Ask with choices",
    askChoicePrompt: "Question",
    askChoiceVariable: "Save answer in",
    growShrink: "Change size",
    exportScene: "Export scene",
    setEffect: "Set effect",
    changeEffect: "Change effect",
    clearEffects: "Clear effects",
    effectColor: "Color",
    effectGhost: "Ghost",
    effectBrightness: "Brightness",
    groupUntilEdge: "Repeat until at the edge",
    groupUntilActor: "Repeat until touching the character",
    saveDistance: "Save distance",
    saveTimer: "Save the time",
    saveMouseX: "Save mouse X",
    saveMouseY: "Save mouse Y",
    ifMouseDown: "If the mouse is down, move 1",
    presetMouse: "mouse pressed",
    senseKey: "Key to sense",
    heldKeys: "Keys held while playing",
    penTitle: "Pen",
    penDown: "Pen down",
    penUp: "Pen up",
    penColor: "Pen color",
    penSize: "Pen size",
    clearPen: "Clear drawing lines",
    musicTitle: "Music",
    playNote: "Play note",
    playDrum: "Play drum",
    setInstrument: "Instrument",
    setTempo: "Speed",
    setPitch: "Pitch",
    setPan: "Sound side",
    beatsLabel: "beats",
    noteLabel: "Note",
    drums: { kick: "kick", snare: "snare", hat: "hi-hat", clap: "clap" },
    instruments: { piano: "piano", flute: "flute", guitar: "guitar", bell: "bells" },
    penColors: {
      dark: "dark",
      red: "red",
      orange: "orange",
      green: "green",
      blue: "blue",
      purple: "purple",
    },
    ifKeyDown: "If the key is down, move 1",
    groupIfKeyDown: "If the key is down, run these blocks",
    timerSeconds: "Timer seconds",
    groupUntilTimer: "Repeat until the seconds pass (use Wait)",
    compoundTitle: "Combine conditions",
    compoundAdd: "Combined condition",
    compoundGroup: "Group under the combined condition",
    compoundFirst: "First condition",
    compoundSecond: "Second condition",
    compoundJoin: "Join with",
    compoundAnd: "and",
    compoundOr: "or",
    compoundNone: "only the first",
    compoundNot: "the other way round (not)",
    presetKey: "key pressed",
    presetEdge: "touching the edge",
    presetTouch: "touching another character",
    presetTimer: "the seconds passed",
    randomDecimal: "with decimals",
    distanceTarget: "Distance to character",
    dataName: "Name",
    number: "Number",
    watchers: "Data after Play",
    paletteLooks: "Looks and time",
    starters: "To start",
    startersNote: "Three blocks to begin with. The whole palette is below.",
    paletteMotion: "Motion",
    paletteMedia: "Costumes, backdrops and sounds",
    paletteLogic: "Events and control",
    paletteData: "Variables and lists",
    categories: "Block categories",
    event: "When",
    onPlay: "When played",
    onTap: "When this character is tapped",
    tapHint: "Tap the character on the stage after Play.",
    remove: "Remove block",
    undo: "Undo",
    redo: "Redo",
    code: "Code",
    idea: "Ask Ori for an idea",
    sheetOpen: "Add blocks",
    sheetClose: "Close blocks",
    sheetHint: "Tap a block to add it to your program.",
    ghostNote: "Ori's idea: not in your program yet",
    dragHint: "Drag a block from the panel into your program, or tap the + button.",
    moveBlock: "Drag block",
    blockUp: "Move block up",
    blockDown: "Move block down",
    dropHere: "Drop here to add",
    moreLanguages: "More languages",
    fewerLanguages: "Fewer languages",
    takeOut: "Take out of the block",
    giveTo: "Give to",
    putInto: "Put into",
    moveTo: "Move block to…",
    evidenceNow: "Now it ends at",
    evidenceWith: "With the idea it would end at",
    evidenceBlocks: "blocks",
    evidenceStops:
      "Careful: with this idea the program does not reach the end. You can change or reject it.",
    ideaText: "Look at the suggested block and decide.",
    use: "Use idea",
    change: "Change idea",
    reject: "Don't use",
    facts: "What really happened",
    conditionResult: "Condition was true",
    yes: "Yes",
    no: "No",
    saveError: "We couldn't save this scene. Try again.",
    chooseActor: "Choose a character",
    noBlocks: "Add a block to see what this character does.",
    stage: "Stage",
    place: "Place character",
    drawCostume: "Draw costume",
    drawBackdrop: "Draw backdrop",
    uploadCostume: "Add costume from image",
    uploadBackdrop: "Add backdrop from image",
    ownCostumes: "My costumes",
    ownBackdrops: "My backdrops",
    edit: "Edit",
    forward: "Bring forward",
    backward: "Send backward",
  },
} as const;

const STUDIO_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
const STUDIO_MESSAGES = ["hola", "vamos", "listo"] as const;
type DropTarget =
  | {
      readonly kind: "list";
      readonly ref: StudioListRef;
      readonly index: number;
      readonly key: string;
    }
  | { readonly kind: "actor"; readonly actorId: string; readonly key: string };

/** What is under a point of the page that can receive a block: a character, or a list of blocks. */
function dropTargetAt(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const actor = element?.closest<HTMLElement>("[data-drop-actor]");
  if (actor?.dataset.dropActor)
    return {
      kind: "actor",
      actorId: actor.dataset.dropActor,
      key: `actor:${actor.dataset.dropActor}`,
    };
  const list = element?.closest<HTMLElement>("[data-drop-list]");
  const raw = list?.dataset.dropList;
  if (!list || !raw) return null;
  try {
    const ref = JSON.parse(raw) as StudioListRef;
    const rows = [...list.querySelectorAll(":scope > [data-block-path]")].map((row) =>
      row.getBoundingClientRect(),
    );
    const index = insertIndex(rows, y);
    return { kind: "list", ref, index, key: `${raw}#${index}` };
  } catch {
    return null;
  }
}

/** The list a block at this path belongs to. */
function listOf(path: StudioBlockPath): StudioListRef {
  if (path.length <= 1) return { container: null };
  if (path[path.length - 2] === "else") return { container: path.slice(0, -2), branch: "else" };
  return { container: path.slice(0, -1) };
}

function sameListRef(a: StudioListRef, b: StudioListRef): boolean {
  return JSON.stringify(a.container) === JSON.stringify(b.container) && a.branch === b.branch;
}

const PEN_HEX: Record<PenColor, string> = {
  dark: "#252342",
  red: "#ef627d",
  orange: "#ffb14a",
  green: "#61b992",
  blue: "#548de4",
  purple: "#a17ad6",
};
/** The stage position of a coordinate, in percent, matching where an actor is drawn. */
const stageX = (x: number) => Math.max(4, Math.min(90, 8 + x / 4));
const stageY = (y: number) => Math.max(8, Math.min(82, 40 + y / 3));

type StudioEvent = "greenFlag" | "onActorClicked" | "onKeyPressed" | "onMessage";

function expressionLabel(
  value: Expression,
  program: ProjectProgram,
  locale: Locale = "es",
): string {
  if (value.type === "xPosition") return "X";
  if (value.type === "yPosition") return "Y";
  if (value.type === "touchingActor")
    return `${locale === "es" ? "tocando" : "touching"} ${galleryCharacterName(characterOfActor(value.actorId), locale)}`;
  if (value.type === "touchingStageEdge")
    return locale === "es" ? "tocando borde" : "touching edge";
  if (value.type === "timer") return locale === "es" ? "tiempo" : "timer";
  if (value.type === "mouseX") return locale === "es" ? "X del ratón" : "mouse X";
  if (value.type === "mouseY") return locale === "es" ? "Y del ratón" : "mouse Y";
  if (value.type === "mouseDown") return locale === "es" ? "ratón pulsado" : "mouse pressed";
  if (value.type === "keyDown")
    return `${locale === "es" ? "tecla" : "key"} ${value.key} ${locale === "es" ? "pulsada" : "down"}`;
  if (value.type === "distanceToActor")
    return `${locale === "es" ? "distancia a" : "distance to"} ${galleryCharacterName(characterOfActor(value.actorId), locale)}`;
  if (value.type === "numericLiteral") return String(value.value);
  if (value.type === "variable")
    return program.variables?.find((item) => item.id === value.variableId)?.name ?? "?";
  if (value.type === "listLength")
    return `${program.lists?.find((item) => item.id === value.listId)?.name ?? "?"}.length`;
  if (value.type === "listItem")
    return `${program.lists?.find((item) => item.id === value.listId)?.name ?? "?"}[${expressionLabel(value.index, program)}]`;
  if (value.type === "mathFunction")
    return `${value.function}(${expressionLabel(value.value, program, locale)})`;
  if (value.type === "randomInteger" || value.type === "random")
    return `🎲${value.type === "random" ? "~" : ""}(${expressionLabel(value.min, program)}, ${expressionLabel(value.max, program)})`;
  if (value.type === "not")
    return `${locale === "es" ? "no" : "not"} ${expressionLabel(value.value, program, locale)}`;
  if (value.type === "and" || value.type === "or")
    return `(${expressionLabel(value.left, program, locale)} ${value.type === "and" ? (locale === "es" ? "y" : "and") : locale === "es" ? "o" : "or"} ${expressionLabel(value.right, program, locale)})`;
  const operators: Partial<Record<Expression["type"], string>> = {
    add: "+",
    subtract: "−",
    multiply: "×",
    divide: "÷",
    modulo: "mod",
    greaterThan: ">",
    lessThan: "<",
    equals: "=",
    lessOrEqual: "≤",
    greaterOrEqual: "≥",
  };
  if ("left" in value && "right" in value && operators[value.type])
    return `(${expressionLabel(value.left, program)} ${operators[value.type]} ${expressionLabel(value.right, program)})`;
  return "?";
}

function characterOfActor(id: string): KidsGalleryCharacterId {
  const suffix = id.split("-").at(-1);
  return isGalleryCharacterId(suffix) ? suffix : "nova";
}

function containsForever(statements: readonly Statement[]): boolean {
  return statements.some((statement) =>
    statement.type === "forever"
      ? true
      : statement.type === "repeat" || statement.type === "repeatUntil"
        ? containsForever(statement.body)
        : statement.type === "if"
          ? containsForever(statement.then) || containsForever(statement.else ?? [])
          : false,
  );
}

function characterOfCostume(
  id: string | undefined,
  fallback: KidsGalleryCharacterId,
): KidsGalleryCharacterId {
  const suffix = id?.replace(/^costume:/, "");
  return isGalleryCharacterId(suffix) ? suffix : fallback;
}

function backdropOfStage(
  id: string | undefined,
  fallback: KidsGalleryBackdropId,
): KidsGalleryBackdropId {
  const suffix = id?.replace(/^backdrop:/, "");
  return isGalleryBackdropId(suffix) ? suffix : fallback;
}

type ConditionPreset = "key" | "edge" | "touch" | "timer" | "mouse";

function waitingChoiceId(result: MultiActorRunResult | null): ChoicePromptId | null {
  const note = result?.trace.find(
    (entry) =>
      entry.statementType === "askChoice" && entry.note?.startsWith("askChoice: awaiting "),
  )?.note;
  const id = note?.slice("askChoice: awaiting ".length);
  return isChoicePromptId(id) ? id : null;
}

function starterLabel(
  kind: StudioStarterKind,
  copy: {
    readonly move: string;
    readonly turnRight: string;
    readonly sound: string;
    readonly repeat: string;
    readonly wait: string;
  },
): string {
  return kind === "move"
    ? copy.move
    : kind === "turn"
      ? copy.turnRight
      : kind === "repeat"
        ? copy.repeat
        : kind === "wait"
          ? copy.wait
          : copy.sound;
}

export function KidsStudioScreen({ id, locale, onBack, oriSuggestions, ageBand }: Props) {
  const copy = COPY[locale];
  const effectName = (effect: string) =>
    effect === "ghost"
      ? copy.effectGhost
      : effect === "brightness"
        ? copy.effectBrightness
        : copy.effectColor;
  const [store] = useState(() => new ProjectStore());
  const [history, setHistory] = useState<EditorHistory>(() =>
    createEditorHistory(store.load(id).program),
  );
  const [backdropId, setBackdropId] = useState<KidsGalleryBackdropId>(
    () => listStudioProjects().find((item) => item.id === id)?.backdropId ?? "forest",
  );
  const [activeActorId, setActiveActorId] = useState(
    () => store.load(id).metadata.actors?.activeId ?? studioActorId(1, "nova"),
  );
  const [sceneGoal, setSceneGoal] = useState<ProjectSceneGoal | null>(
    () => studioSceneGoal(id, store) ?? null,
  );
  const [newCharacter, setNewCharacter] = useState<KidsGalleryCharacterId>("mika");
  const [newCostume, setNewCostume] = useState<KidsGalleryCharacterId>("mika");
  const [newBackdrop, setNewBackdrop] = useState<KidsGalleryBackdropId>("moon");
  const [newSound, setNewSound] = useState<(typeof KIDS_SOUNDS)[number]["id"]>("kids:pop");
  const [moveCells, setMoveCells] = useState(1);
  const [targetX, setTargetX] = useState(160);
  const [targetY, setTargetY] = useState(0);
  const [turnAmount, setTurnAmount] = useState(90);
  const [pointDegrees, setPointDegrees] = useState(0);
  const [pointTargetId, setPointTargetId] = useState("");
  const [bubbleText, setBubbleText] = useState(locale === "es" ? "¡Hola!" : "Hello!");
  const [spriteSize, setSpriteSize] = useState(100);
  const [sizeDelta, setSizeDelta] = useState(25);
  const [effectKind, setEffectKind] = useState<"color" | "ghost" | "brightness">("color");
  const [effectValue, setEffectValue] = useState(50);
  const [effectDelta, setEffectDelta] = useState(25);
  const [waitSeconds, setWaitSeconds] = useState(1);
  const [stopScope, setStopScope] = useState<"script" | "actor" | "scene">("script");
  const [choicePromptId, setChoicePromptId] = useState<ChoicePromptId>("path");
  const [volume, setVolume] = useState(100);
  const [volumeChange, setVolumeChange] = useState(-10);
  const [eventKey, setEventKey] = useState<(typeof STUDIO_KEYS)[number]>("Space");
  const [eventMessage, setEventMessage] = useState<(typeof STUDIO_MESSAGES)[number]>("vamos");
  const [repeatCount, setRepeatCount] = useState(3);
  const [groupCount, setGroupCount] = useState(2);
  const [blockName, setBlockName] = useState("");
  const [blockNumbers, setBlockNumbers] = useState<string[]>([]);
  const [numberTitle, setNumberTitle] = useState("");
  const [copyTargets, setCopyTargets] = useState<Record<string, string>>({});
  const [numberTitles, setNumberTitles] = useState<Record<string, string>>({});
  const [blockRenames, setBlockRenames] = useState<Record<string, string>>({});
  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);
  const [sourceVariableId, setSourceVariableId] = useState("studio-var-1");
  const [mathOperator, setMathOperator] = useState<
    "add" | "subtract" | "multiply" | "divide" | "modulo"
  >("add");
  const [compareOperator, setCompareOperator] = useState<
    "greaterThan" | "lessThan" | "equals" | "lessOrEqual" | "greaterOrEqual"
  >("greaterThan");
  const [compoundA, setCompoundA] = useState<ConditionPreset>("key");
  const [compoundB, setCompoundB] = useState<ConditionPreset>("edge");
  const [compoundJoin, setCompoundJoin] = useState<"none" | "and" | "or">("and");
  const [compoundNot, setCompoundNot] = useState(false);
  const [randomDecimal, setRandomDecimal] = useState(false);
  const [compareCalculation, setCompareCalculation] = useState(false);
  const [sensorTargetId, setSensorTargetId] = useState("");
  const [senseKey, setSenseKey] = useState<(typeof STUDIO_KEYS)[number]>("Space");
  const [timerSeconds, setTimerSeconds] = useState(3);
  const [heldKeys, setHeldKeys] = useState<string[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, down: false });
  const [penColor, setPenColor] = useState<PenColor>("dark");
  const [penSize, setPenSize] = useState(8);
  const penEnabled = useKidsFlag("extensionPen");
  const musicEnabled = useKidsFlag("extensionMusic");
  const categoryLabel: Record<StudioCategory, string> = {
    motion: copy.paletteMotion,
    looks: copy.paletteLooks,
    media: copy.paletteMedia,
    logic: copy.paletteLogic,
    pen: copy.penTitle,
    music: copy.musicTitle,
    data: copy.paletteData,
    myBlocks: copy.myBlocks,
  };
  const interventionPolicy = useInterventionPolicy();
  const [musicNote, setMusicNote] = useState(60);
  const [musicBeats, setMusicBeats] = useState<MusicBeats>(1);
  const [musicDrum, setMusicDrum] = useState<MusicDrum>("kick");
  const [musicInstrument, setMusicInstrument] = useState<MusicInstrument>("piano");
  const [musicTempo, setMusicTempo] = useState(120);
  const [musicPitch, setMusicPitch] = useState(0);
  const [musicPan, setMusicPan] = useState(0);
  const [dataName, setDataName] = useState("");
  const [dataValue, setDataValue] = useState(1);
  const [mathFn, setMathFn] = useState<"abs" | "round" | "floor" | "ceiling">("round");
  const [variableId, setVariableId] = useState("studio-var-1");
  const [listId, setListId] = useState("studio-list-1");
  const [listIndex, setListIndex] = useState(1);
  const [randomMin, setRandomMin] = useState(1);
  const [randomMax, setRandomMax] = useState(6);
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const choiceAnswers = useRef<Record<string, number>>({});
  const pendingChoiceId = waitingChoiceId(run);
  const [events, setEvents] = useState<readonly RuntimeEvent[]>([{ type: "start" }]);
  const [frame, setFrame] = useState<number | null>(null);
  const tutorialFlag = useKidsFlag("tutorial");
  const [tutorialOpen, setTutorialOpen] = useState(() => !studioTutorialDone());
  const [stepped, setStepped] = useState(false);
  useEffect(() => {
    if (stepped) setStudioTutorialDone(true);
  }, [stepped]);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript" | "java">("agorix");
  const [showMoreLanguages, setShowMoreLanguages] = useState(false);
  const [oriIdea, setOriIdea] = useState<ProgramProposal | null>(null);
  const [compoundOri, setCompoundOri] = useState<{
    readonly proposal: ProgramProposal;
    readonly join: OriCompoundJoin;
  } | null>(null);
  const [oriMessage, setOriMessage] = useState("");
  const [oriBusy, setOriBusy] = useState(false);
  const [oriReaction, reactOri] = useOriReaction();
  const oriPageVisible = useOriPageVisible();
  const [error, setError] = useState(false);
  const [exportingMedia, setExportingMedia] = useState(false);
  const customImagesEnabled = useKidsFlag("customImages");
  const [drawingKind, setDrawingKind] = useState<"costume" | "backdrop" | null>(null);
  const [editingArtId, setEditingArtId] = useState<string | null>(null);
  const [placementRevision, setPlacementRevision] = useState(0);
  const [dragPreview, setDragPreview] = useState<{ id: string; x: number; y: number } | null>(null);
  const dragStart = useRef<{
    id: string;
    pointerId: number;
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const suppressStageClick = useRef(false);
  const creative = useMemo(() => {
    const saved = store.load(id).metadata;
    return creativeForStudio(
      history.current,
      backdropId,
      locale,
      Object.fromEntries(
        (saved.actors?.items ?? []).map((item) => [item.id, { x: item.x, y: item.y }]),
      ),
      saved.stage?.actorOrder,
      {
        assets: saved.assets?.filter((asset) => asset.source.startsWith("data:")),
        actorCostumes: Object.fromEntries(
          (saved.actors?.items ?? [])
            .filter((actor) => actor.costumeId !== undefined)
            .map((actor) => [actor.id, actor.costumeId!]),
        ),
        stageBackdropId: saved.stage?.backdropId,
      },
    );
  }, [history.current, backdropId, locale, placementRevision, store, id]);
  const actor = creative.actors?.find((item) => item.id === activeActorId) ?? creative.actors?.[0];
  const otherActors = creative.actors?.filter((item) => item.id !== actor?.id) ?? [];
  const targetActorId = otherActors.some((item) => item.id === sensorTargetId)
    ? sensorTargetId
    : otherActors[0]?.id;
  const script = history.current.scripts.find((item) => actor?.scripts?.includes(item.id));
  const selectedVariableId = history.current.variables?.some((item) => item.id === variableId)
    ? variableId
    : (history.current.variables?.[0]?.id ?? variableId);
  const selectedSourceVariableId = history.current.variables?.some(
    (item) => item.id === sourceVariableId,
  )
    ? sourceVariableId
    : (history.current.variables?.[0]?.id ?? sourceVariableId);
  const currentProgram = useRef(history.current);
  const currentActor = useRef(activeActorId);
  currentProgram.current = history.current;
  currentActor.current = activeActorId;
  const proposedOperation = oriIdea?.operations[0];
  const compoundReview = useMemo(() => {
    if (!compoundOri) return null;
    try {
      return reviewOriCompound(history.current, activeActorId, compoundOri.proposal);
    } catch {
      return null;
    }
  }, [compoundOri, history.current, activeActorId]);
  const proposedStatement =
    proposedOperation?.type === "appendStatement" ? proposedOperation.statement : null;
  // "Change" swaps a suggested move/turn for its sibling, and a suggested own block for another one.
  const otherOwnBlock =
    proposedStatement?.type === "callProcedure"
      ? (script?.procedures ?? []).find((item) => item.id !== proposedStatement.procedureId)
      : undefined;
  const canChangeIdea = proposedStatement?.type !== "callProcedure" || otherOwnBlock !== undefined;
  /**
   * What would really happen with Ori's idea: the same deterministic runtime, run on a copy. Nothing
   * here is saved, so the child can look, accept, change or reject (issues #602 and #605).
   */
  const oriPreview = useMemo((): CandidatePreview | null => {
    if (!oriIdea || !proposedStatement) return null;
    try {
      const review = validateOriStudioProposal(
        { actorId: activeActorId, locale, program: history.current },
        oriIdea,
      );
      return previewCandidate(
        history.current,
        review.candidateProgram,
        creative,
        activeActorId,
        heldKeys,
      );
    } catch {
      return null;
    }
  }, [oriIdea, proposedStatement, history.current, activeActorId, creative, heldKeys, locale]);
  const [intentPlan, setIntentPlan] = useState<{
    readonly intent: OriStudioIntent;
    readonly statements: readonly Statement[];
    readonly preview: CandidatePreview | null;
    /** Ori's idea applied to a copy, only to listen to it: the child's program is untouched. */
    readonly candidate: ProjectProgram;
  } | null>(null);
  const [prediction, setPrediction] = useState<Direction | null>(null);
  const [predictedForRun, setPredictedForRun] = useState<Direction | null>(null);
  const [runCount, setRunCount] = useState(0);
  // What the runtime has shown about this child's concepts sets Ori's pace (issue #611).
  const pacedPolicy = useMemo(
    () =>
      adaptInterventionByStage(
        interventionPolicy,
        stageBand(stagesOfProgram(loadKidsMastery(), history.current)),
      ),
    [interventionPolicy, history.current, runCount],
  );
  // Ori's help since the last run, so a run is counted as helped or on the child's own.
  const helped = useRef(false);
  const [palette, setPalette] = useState<HTMLDivElement | null>(null);
  // Phone only: the palette is a bottom sheet, open on entry and closable (#1110).
  const [sheetOpen, setSheetOpen] = useState(true);
  const programRef = useRef<HTMLOListElement>(null);
  // What is under the pointer while a block is dragged: a list (with the place in it) or a character.
  const [over, setOver] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ readonly from: StudioBlockPath } | null>(null);
  const targetRef = useRef<DropTarget | null>(null);
  // A block dropped from the panel is added by its button, then moved to where it was dropped.
  const pendingInsert = useRef<{
    readonly ref: StudioListRef;
    readonly index: number;
    readonly expected: number;
  } | null>(null);
  const lengthRef = useRef(0);
  lengthRef.current = script?.statements.length ?? 0;

  // Drag a block from the panel into the program: dropping presses that button, so a drag and a tap
  // always do exactly the same thing. A touch needs a short hold so scrolling still works.
  useEffect(() => {
    if (!palette) return;
    let start: {
      x: number;
      y: number;
      button: HTMLButtonElement;
      touch: boolean;
      armed: boolean;
      timer: number | null;
    } | null = null;
    let ghost: HTMLElement | null = null;
    let dragging = false;
    let swallowClick = false;
    let scrollFrame: number | null = null;
    let pointer: { x: number; y: number } | null = null;
    const scrollWhileDragging = () => {
      scrollFrame = null;
      if (!dragging || !pointer) return;
      const edge = 72;
      const speed = 18;
      const delta = pointer.y < edge ? -speed : pointer.y > window.innerHeight - edge ? speed : 0;
      if (delta !== 0) {
        window.scrollBy(0, delta);
        const under = dropTargetAt(pointer.x, pointer.y);
        setOver(under?.kind === "list" ? under.key : null);
      }
      scrollFrame = window.requestAnimationFrame(scrollWhileDragging);
    };
    const stop = () => {
      if (start?.timer != null) window.clearTimeout(start.timer);
      if (scrollFrame != null) window.cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
      pointer = null;
      ghost?.remove();
      ghost = null;
      dragging = false;
      start = null;
      setOver(null);
    };
    const down = (event: globalThis.PointerEvent) => {
      const button = (event.target as HTMLElement).closest("button");
      if (!button || button.disabled || !isAddControl(button)) return;
      const touch = event.pointerType === "touch";
      start = { x: event.clientX, y: event.clientY, button, touch, armed: !touch, timer: null };
      if (touch)
        start.timer = window.setTimeout(() => {
          if (start) start.armed = true;
        }, TOUCH_HOLD_MS);
    };
    const move = (event: globalThis.PointerEvent) => {
      if (!start) return;
      const far = movedFar(event.clientX - start.x, event.clientY - start.y);
      if (!dragging) {
        // A touch that moves before the hold is a scroll, not a drag.
        if (start.touch && !start.armed && far) return stop();
        if (!far || !start.armed) return;
        dragging = true;
        ghost = document.createElement("div");
        ghost.className = "kids-drag-ghost";
        ghost.textContent =
          start.button.dataset.kidsAddLabel ??
          start.button.textContent?.replace(/^\s*\+\s*/, "") ??
          "";
        ghost.setAttribute("aria-hidden", "true");
        document.body.appendChild(ghost);
        scrollFrame = window.requestAnimationFrame(scrollWhileDragging);
      }
      pointer = { x: event.clientX, y: event.clientY };
      if (ghost) {
        ghost.style.left = `${event.clientX}px`;
        ghost.style.top = `${event.clientY}px`;
      }
      const under = dropTargetAt(event.clientX, event.clientY);
      setOver(under?.kind === "list" ? under.key : null);
      event.preventDefault();
    };
    const up = (event: globalThis.PointerEvent) => {
      if (!start) return;
      const button = start.button;
      const wasDragging = dragging;
      const target = wasDragging ? dropTargetAt(event.clientX, event.clientY) : null;
      stop();
      if (wasDragging) {
        // Press the button once for the drop, then swallow the click the browser sends on release.
        // A drop inside a repeat or an if, or between blocks, moves the new block there afterwards.
        if (target?.kind === "list") {
          const count = lengthRef.current;
          const atEnd = target.ref.container === null && target.index >= count;
          if (!atEnd)
            pendingInsert.current = {
              ref: target.ref,
              index: target.index,
              expected: count + 1,
            };
          button.click();
        }
        swallowClick = true;
        window.setTimeout(() => {
          swallowClick = false;
        }, 0);
      }
    };
    const click = (event: MouseEvent) => {
      if (swallowClick) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const block = (event: TouchEvent) => {
      if (dragging) event.preventDefault();
    };
    palette.addEventListener("pointerdown", down);
    palette.addEventListener("click", click, true);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      stop();
      palette.removeEventListener("pointerdown", down);
      palette.removeEventListener("click", click, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("touchmove", block);
    };
  }, [palette]);

  useEffect(() => {
    const pending = pendingInsert.current;
    if (!pending) return;
    pendingInsert.current = null;
    const count = script?.statements.length ?? 0;
    // The button did not add a block (or something else changed it): leave the program alone.
    if (count !== pending.expected) return;
    try {
      persist(
        moveStudioStatementTo(history, activeActorId, [count - 1], pending.ref, pending.index),
      );
    } catch {
      setError(true);
    }
  }, [history]);

  /** Drag one of the program's blocks into another place, a repeat or an if, or to a character. */
  function beginBlockDrag(event: PointerEvent<HTMLButtonElement>, from: StudioBlockPath) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from });
  }
  function overBlockDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const target = dropTargetAt(event.clientX, event.clientY);
    targetRef.current = target;
    setOver(target?.key ?? null);
  }
  function endBlockDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag;
    const target = dropTargetAt(event.clientX, event.clientY);
    setDrag(null);
    setOver(null);
    targetRef.current = null;
    if (!current || !target) return;
    placeBlock(current.from, target);
  }
  /** One way to move a block, for a drag and for the keyboard choices alike. */
  function placeBlock(from: StudioBlockPath, target: DropTarget) {
    try {
      if (target.kind === "actor") {
        if (from.length === 1 && typeof from[0] === "number")
          persist(moveStudioStatementToActor(history, activeActorId, from[0], target.actorId));
        return;
      }
      const source = listOf(from);
      const sameList = sameListRef(source, target.ref);
      const last = from[from.length - 1];
      const index =
        sameList && typeof last === "number" && last < target.index
          ? target.index - 1
          : target.index;
      if (sameList && index === last) return;
      persist(moveStudioStatementTo(history, activeActorId, from, target.ref, index));
    } catch {
      setError(true);
    }
  }

  /** The program's repeat and if bodies: each block can be dragged, moved and taken out. */
  function programList(items: readonly Statement[], container: StudioBlockPath, branch?: "else") {
    const ref: StudioListRef = branch ? { container, branch } : { container };
    const key = JSON.stringify(ref);
    const base: StudioBlockPath = branch ? [...container, "else"] : container;
    return (
      <ol
        className="kids-studio-nested-blocks"
        data-drop-list={key}
        data-over={over?.startsWith(`${key}#`) ? "true" : undefined}
      >
        {items.map((item, index) => {
          const path: StudioBlockPath = [...base, index];
          return (
            <li
              key={`${key}-${index}`}
              className="kids-nested-block"
              data-block-path={JSON.stringify(path)}
              data-target={over === `${key}#${index}` ? "true" : undefined}
              data-dragging={
                drag && JSON.stringify(drag.from) === JSON.stringify(path) ? "true" : undefined
              }
            >
              <button
                type="button"
                className="kids-block-handle"
                aria-label={`${copy.moveBlock}: ${blockLabel(item)}`}
                onPointerDown={(event) => beginBlockDrag(event, path)}
                onPointerMove={overBlockDrag}
                onPointerUp={endBlockDrag}
                onPointerCancel={() => setDrag(null)}
              >
                ⠿
              </button>
              <span>{blockLabel(item)}</span>
              <button
                type="button"
                className="kids-button"
                aria-label={`${copy.blockUp}: ${blockLabel(item)}`}
                disabled={index === 0}
                onClick={() => placeBlock(path, { kind: "list", ref, index: index - 1, key: "" })}
              >
                ↑
              </button>
              <button
                type="button"
                className="kids-button"
                aria-label={`${copy.blockDown}: ${blockLabel(item)}`}
                disabled={index === items.length - 1}
                onClick={() => placeBlock(path, { kind: "list", ref, index: index + 2, key: "" })}
              >
                ↓
              </button>
              <button
                type="button"
                className="kids-button"
                aria-label={`${copy.takeOut}: ${blockLabel(item)}`}
                onClick={() => {
                  const parent = listOf(container);
                  const at = container[container.length - 1];
                  if (typeof at === "number")
                    placeBlock(path, { kind: "list", ref: parent, index: at + 1, key: "" });
                }}
              >
                {copy.takeOut}
              </button>
              {item.type === "repeat" || item.type === "repeatUntil" || item.type === "forever"
                ? programList(item.body, path)
                : null}
              {item.type === "if" ? programList(item.then, path) : null}
              {item.type === "if" && item.else ? (
                <>
                  <strong>{copy.elseLabel}</strong>
                  {programList(item.else, path, "else")}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  /** Keyboard and screen-reader way to put a block somewhere else: a list of places to choose from. */
  function placeChoices(
    from: StudioBlockPath,
  ): { readonly label: string; readonly run: () => void }[] {
    const choices: { label: string; run: () => void }[] = [];
    for (const other of otherActors)
      choices.push({
        label: `${copy.giveTo} ${other.name}`,
        run: () => placeBlock(from, { kind: "actor", actorId: other.id, key: "" }),
      });
    (script?.statements ?? []).forEach((statement, at) => {
      if (from.length === 1 && from[0] === at) return;
      const name = blockLabel(statement);
      if (
        statement.type === "repeat" ||
        statement.type === "repeatUntil" ||
        statement.type === "forever"
      )
        choices.push({
          label: `${copy.putInto} ${name}`,
          run: () =>
            placeBlock(from, {
              kind: "list",
              ref: { container: [at] },
              index: statement.body.length,
              key: "",
            }),
        });
      if (statement.type === "if") {
        choices.push({
          label: `${copy.putInto} ${name}`,
          run: () =>
            placeBlock(from, {
              kind: "list",
              ref: { container: [at] },
              index: statement.then.length,
              key: "",
            }),
        });
        if (statement.else)
          choices.push({
            label: `${copy.putInto} ${name} (${copy.elseLabel})`,
            run: () =>
              placeBlock(from, {
                kind: "list",
                ref: { container: [at], branch: "else" },
                index: statement.else!.length,
                key: "",
              }),
          });
      }
    });
    return choices;
  }
  const oriMotion = oriBusy
    ? "thinking"
    : oriIdea
      ? "proposal"
      : oriMessage
        ? "fallback"
        : run
          ? "observing"
          : "idle";
  const oriExpression = oriReaction ?? expressionForMotion(oriMotion, outcomeOfRun(run?.outcome));
  const selectedFrame = frame === null ? null : run?.frames[frame];
  const shownActors = selectedFrame?.actors ?? run?.actors;
  const shownWorld = shownActors?.find((entry) => entry.id === activeActorId)?.world;
  const shownStage = selectedFrame?.stage ?? run?.stage ?? creative.stage;
  const stageBackdrop = backdropOfStage(shownStage?.backdropId, backdropId);
  const stageArt = customImagesEnabled
    ? creative.assets?.find(
        (asset) => asset.id === shownStage?.backdropId && asset.source.startsWith("data:"),
      )?.source
    : undefined;
  const ownCostumes =
    creative.assets?.filter(
      (asset) => asset.kind === "costume" && asset.source.startsWith("data:"),
    ) ?? [];
  const ownBackdrops =
    creative.assets?.filter(
      (asset) => asset.kind === "backdrop" && asset.source.startsWith("data:"),
    ) ?? [];
  const codeTabs: readonly CodeTab[] = ageBand
    ? codeTabsForBand(ageBand, showMoreLanguages)
    : ["agorix", "python", "node", "java"];
  const shownLanguage = codeTabs.includes(language === "typescript" ? "node" : language)
    ? language
    : "agorix";
  const codeView = (() => {
    if (shownLanguage === "python") {
      const result = projectPython(history.current);
      return { text: result.text, rangesOf: (id: string) => result.mapping[id] };
    }
    if (shownLanguage === "java") {
      const result = projectJava(history.current);
      return { text: result.text, rangesOf: (id: string) => result.mapping[id] };
    }
    if (shownLanguage === "typescript") {
      const result = projectProgram(history.current);
      return {
        text: result.code,
        rangesOf: (id: string) => (result.mapping[id] ? [result.mapping[id]!] : undefined),
      };
    }
    const result = projectAgorixCode(history.current);
    return { text: result.text, rangesOf: (id: string) => result.mapping[id] };
  })();
  const code = codeView.text;
  // The line the stepped block is on, so a child can see which line of the code is running.
  const currentLine = (() => {
    const nodeId = selectedFrame?.nodeId;
    const range = nodeId ? codeView.rangesOf(nodeId)?.[0] : undefined;
    if (!range) return null;
    const end = code.indexOf("\n", range.start);
    return { start: range.start, end: end === -1 || end > range.end ? range.end : end };
  })();

  function fireKey(key: string) {
    if (!run || !STUDIO_KEYS.includes(key as (typeof STUDIO_KEYS)[number])) return;
    const nextEvents: readonly RuntimeEvent[] = [...events, { type: "keyPressed", key }];
    setRun(
      runMultiActorProgram(history.current, creative, {
        events: nextEvents,
        keysDown: heldKeys,
        pointer: pointerRef.current,
        choices: choiceAnswers.current,
      }),
    );
    setEvents(nextEvents);
    setFrame(null);
  }

  function captureStagePointer(event: PointerEvent<HTMLDivElement>, down: boolean) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = Math.max(
      0,
      Math.min(320, Math.round((((event.clientX - rect.left) / rect.width) * 100 - 8) * 4)),
    );
    const y = Math.max(
      -100,
      Math.min(120, Math.round((((event.clientY - rect.top) / rect.height) * 100 - 40) * 3)),
    );
    const previous = pointerRef.current;
    if (previous.x === x && previous.y === y && previous.down === down) return;
    pointerRef.current = { x, y, down };
    if (run) {
      setRun(
        runMultiActorProgram(history.current, creative, {
          events,
          keysDown: heldKeys,
          pointer: pointerRef.current,
          choices: choiceAnswers.current,
        }),
      );
      setFrame(null);
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      if (event.code === "Space" || event.key.startsWith("Arrow"))
        fireKey(event.code === "Space" ? "Space" : event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function setEvent(type: StudioEvent) {
    const trigger =
      type === "onKeyPressed"
        ? ({ type, key: eventKey } as const)
        : type === "onMessage"
          ? ({ type, message: eventMessage } as const)
          : ({ type } as const);
    persist(setStudioTrigger(history, activeActorId, trigger));
  }

  function createData(kind: "variable" | "list") {
    try {
      const name = dataName.trim();
      const next =
        kind === "variable" ? addStudioVariable(history, name) : addStudioList(history, name);
      persist(next);
      setDataName("");
      if (kind === "variable") setVariableId(`studio-var-${next.current.variables?.length ?? 1}`);
      else setListId(`studio-list-${next.current.lists?.length ?? 1}`);
    } catch {
      setError(true);
    }
  }

  function persist(next: EditorHistory, selected: string = activeActorId) {
    const nextCreative = creativeForStudio(next.current, backdropId, locale);
    const nextActive = nextCreative.actors?.some((item) => item.id === selected)
      ? selected
      : nextCreative.actors![0]!.id;
    try {
      saveStudioProject(id, next.current, backdropId, nextActive, locale, store);
      setHistory(next);
      setActiveActorId(nextActive);
      setRun(null);
      setEvents([{ type: "start" }]);
      setFrame(null);
      setOriIdea(null);
      setCompoundOri(null);
      setOriMessage("");
      setIntentPlan(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function selectActor(next: string) {
    try {
      saveStudioProject(id, history.current, backdropId, next, locale, store);
      setActiveActorId(next);
      setOriIdea(null);
      setCompoundOri(null);
      setOriMessage("");
      setError(false);
    } catch {
      setError(true);
    }
  }

  function placeActor(dx: number, dy: number) {
    if (!actor) return;
    try {
      setStudioActorPosition(
        id,
        actor.id,
        Math.max(0, Math.min(320, actor.x + dx)),
        Math.max(-100, Math.min(120, actor.y + dy)),
        store,
      );
      setPlacementRevision((value) => value + 1);
      setRun(null);
      setFrame(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function changeLayer(direction: "forward" | "backward") {
    if (!actor) return;
    try {
      if (moveStudioActorLayer(id, actor.id, direction, store)) {
        setPlacementRevision((value) => value + 1);
        setRun(null);
        setFrame(null);
      }
      setError(false);
    } catch {
      setError(true);
    }
  }

  function saveDrawing(dataUrl: string) {
    if (!customImagesEnabled || !drawingKind || !actor) return;
    try {
      if (editingArtId) updateStudioArt(id, editingArtId, dataUrl, store);
      else addStudioArt(id, drawingKind, actor.id, dataUrl, locale, store);
      setPlacementRevision((value) => value + 1);
      setDrawingKind(null);
      setEditingArtId(null);
      setRun(null);
      setFrame(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  async function importImage(kind: "costume" | "backdrop", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !actor || !customImagesEnabled) return;
    try {
      addStudioArt(id, kind, actor.id, await processKidsImage(file), locale, store);
      setPlacementRevision((value) => value + 1);
      setRun(null);
      setFrame(null);
      setError(false);
    } catch {
      setError(true);
    } finally {
      event.target.value = "";
    }
  }

  function chooseArt(assetId: string) {
    if (!actor) return;
    try {
      selectStudioArt(id, assetId, actor.id, locale, store);
      setPlacementRevision((value) => value + 1);
      setRun(null);
      setFrame(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function dragPosition(event: PointerEvent<HTMLButtonElement>) {
    const start = dragStart.current;
    if (!start || event.pointerId !== start.pointerId) return null;
    return {
      id: start.id,
      x: Math.max(
        0,
        Math.min(320, Math.round(start.x + ((event.clientX - start.pointerX) / start.width) * 400)),
      ),
      y: Math.max(
        -100,
        Math.min(
          120,
          Math.round(start.y + ((event.clientY - start.pointerY) / start.height) * 300),
        ),
      ),
    };
  }

  function beginDrag(
    event: PointerEvent<HTMLButtonElement>,
    actorId: string,
    x: number,
    y: number,
  ) {
    if (actorId !== activeActorId || (event.pointerType === "mouse" && event.button !== 0)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;
    dragStart.current = {
      id: actorId,
      pointerId: event.pointerId,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x,
      y,
      width: bounds.width,
      height: bounds.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const next = dragPosition(event);
    if (next && (next.x !== dragStart.current?.x || next.y !== dragStart.current?.y))
      setDragPreview(next);
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const next = dragPosition(event);
    const start = dragStart.current;
    dragStart.current = null;
    setDragPreview(null);
    if (
      !next ||
      !start ||
      Math.hypot(event.clientX - start.pointerX, event.clientY - start.pointerY) < 5
    )
      return;
    suppressStageClick.current = true;
    window.setTimeout(() => {
      suppressStageClick.current = false;
    }, 0);
    try {
      setStudioActorPosition(id, next.id, next.x, next.y, store);
      setPlacementRevision((value) => value + 1);
      setRun(null);
      setFrame(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function addActor() {
    try {
      const next = addStudioActor(history, newCharacter);
      persist(next, studioActorId(next.current.scripts.length, newCharacter));
    } catch {
      setError(true);
    }
  }

  function add(statement: StudioStatement) {
    try {
      persist(appendStudioStatement(history, activeActorId, statement));
    } catch {
      setError(true);
    }
  }

  function calculation(): Expression {
    return {
      type: mathOperator,
      left: { type: "variable", variableId: selectedSourceVariableId },
      right: { type: "numericLiteral", value: dataValue },
    };
  }

  /** One of the simple conditions a child already knows, ready to be joined with another. */
  function presetCondition(preset: ConditionPreset): Expression | null {
    if (preset === "key") return { type: "keyDown", key: senseKey };
    if (preset === "mouse") return { type: "mouseDown" };
    if (preset === "edge") return STUDIO_EDGE_CONDITION;
    if (preset === "touch")
      return targetActorId ? { type: "touchingActor", actorId: targetActorId } : null;
    return {
      type: "greaterThan",
      left: { type: "timer" },
      right: { type: "numericLiteral", value: timerSeconds },
    };
  }

  /** "A and B", "A or B" or just "A", optionally turned round with "not". */
  function compoundCondition(): Expression | null {
    const first = presetCondition(compoundA);
    if (first === null) return null;
    let joined: Expression = first;
    if (compoundJoin !== "none") {
      const second = presetCondition(compoundB);
      if (second === null) return null;
      joined = { type: compoundJoin, left: first, right: second };
    }
    return compoundNot ? { type: "not", value: joined } : joined;
  }

  function condition(): Expression {
    return {
      type: compareOperator,
      left: { type: "variable", variableId: selectedVariableId },
      right: compareCalculation ? calculation() : { type: "numericLiteral", value: dataValue },
    };
  }

  const directionOptions = [
    { degrees: 0, name: copy.dirRight },
    { degrees: 90, name: copy.dirDown },
    { degrees: 180, name: copy.dirLeft },
    { degrees: -90, name: copy.dirUp },
  ] as const;

  function directionName(degrees: number): string {
    return directionOptions.find((item) => item.degrees === degrees)?.name ?? `${degrees}°`;
  }

  const pointTarget = otherActors.find((item) => item.id === pointTargetId) ?? otherActors[0];

  const targetOutOfRange =
    !inStudioRange(targetX, STUDIO_X_RANGE) || !inStudioRange(targetY, STUDIO_Y_RANGE);

  function blockLabel(statement: Statement, owner?: Procedure): string {
    switch (statement.type) {
      case "move":
        return `${statement.steps < 0 ? copy.moveBackward : copy.move} ${Math.abs(statement.steps) / 40}`;
      case "goTo":
        return `${copy.goTo}: ${statement.x}, ${statement.y}`;
      case "glideTo":
        return `${copy.glideTo}: ${statement.x}, ${statement.y} (${statement.seconds}s)`;
      case "turn":
        return `${statement.degrees < 0 ? copy.turnLeft : copy.turnRight} ${Math.abs(statement.degrees)}°`;
      case "pointInDirection":
        return `${copy.pointDirection}: ${directionName(statement.degrees)}`;
      case "pointTowards":
        return `${copy.pointTowards}: ${creative.actors?.find((item) => item.id === statement.actorId)?.name ?? "?"}`;
      case "bounceOnEdge":
        return copy.bounceOnEdge;
      case "goToLayer":
        return statement.layer === "front" ? copy.layerFront : copy.layerBack;
      case "switchCostume":
        return `${copy.costume}: ${galleryCharacterName(characterOfCostume(statement.costumeId, "nova"), locale)}`;
      case "switchBackdrop":
        return `${copy.switchBackdrop}: ${galleryBackdropName(backdropOfStage(statement.backdropId, backdropId), locale)}`;
      case "playSound":
        return `${copy.sound}: ${KIDS_SOUNDS.find((item) => item.id === statement.soundId)?.[locale] ?? ""}`;
      case "stopSounds":
        return copy.stopSounds;
      case "stop":
        return `${copy.stop}: ${statement.scope === "script" ? copy.stopScript : statement.scope === "actor" ? copy.stopActor : copy.stopScene}`;
      case "askChoice":
        return `${copy.askChoice}: ${CHOICE_CATALOG[statement.promptId].prompt[locale]}`;
      case "setVolume":
        return `${copy.setVolume}: ${statement.volume}%`;
      case "changeVolume":
        return `${copy.changeVolume}: ${statement.delta}`;
      case "say":
      case "think":
        return `${statement.type === "say" ? copy.say : copy.think}: ${statement.text}`;
      case "show":
        return copy.show;
      case "hide":
        return copy.hide;
      case "setSize":
        return `${copy.size}: ${statement.size}%`;
      case "changeSize":
        return `${copy.growShrink}: ${statement.delta > 0 ? "+" : ""}${statement.delta}%`;
      case "setEffect":
        return `${copy.setEffect}: ${effectName(statement.effect)} ${statement.value}`;
      case "changeEffect":
        return `${copy.changeEffect}: ${effectName(statement.effect)} ${statement.delta > 0 ? "+" : ""}${statement.delta}`;
      case "clearEffects":
        return copy.clearEffects;
      case "wait":
        return `${copy.wait}: ${statement.seconds}s`;
      case "broadcast":
        return `${copy.message}: ${statement.message}`;
      case "setVariable":
      case "changeVariable":
        return `${statement.type === "setVariable" ? copy.setVariable : copy.changeVariable}: ${history.current.variables?.find((item) => item.id === statement.variableId)?.name ?? "?"} ${expressionLabel(statement.type === "setVariable" ? statement.value : statement.delta, history.current)}`;
      case "showVariable":
      case "hideVariable":
        return `${statement.type === "showVariable" ? copy.showVariable : copy.hideVariable}: ${history.current.variables?.find((item) => item.id === statement.variableId)?.name ?? "?"}`;
      case "listAdd":
        return `${copy.listAdd}: ${history.current.lists?.find((item) => item.id === statement.listId)?.name ?? "?"} ${expressionLabel(statement.value, history.current)}`;
      case "listRemoveAt":
        return `${copy.listRemove}: ${history.current.lists?.find((item) => item.id === statement.listId)?.name ?? "?"} ${expressionLabel(statement.index, history.current)}`;
      case "listInsertAt":
      case "listReplaceAt":
        return `${statement.type === "listInsertAt" ? copy.listInsert : copy.listReplace}: ${history.current.lists?.find((item) => item.id === statement.listId)?.name ?? "?"} ${expressionLabel(statement.index, history.current)} ← ${expressionLabel(statement.value, history.current)}`;
      case "repeat":
        return `${copy.repeat} ${statement.count}`;
      case "forever":
        return copy.forever;
      case "penDown":
        return copy.penDown;
      case "penUp":
        return copy.penUp;
      case "clearPen":
        return copy.clearPen;
      case "setPenColor":
        return `${copy.penColor}: ${copy.penColors[statement.color]}`;
      case "setPenSize":
        return `${copy.penSize}: ${statement.size}`;
      case "playNote":
        return `${copy.playNote}: ${noteName(statement.note, locale)} · ${statement.beats} ${copy.beatsLabel}`;
      case "playDrum":
        return `${copy.playDrum}: ${copy.drums[statement.drum]} · ${statement.beats} ${copy.beatsLabel}`;
      case "setInstrument":
        return `${copy.setInstrument}: ${copy.instruments[statement.instrument]}`;
      case "setTempo":
        return `${copy.setTempo}: ${statement.bpm}`;
      case "setPitch":
        return `${copy.setPitch}: ${statement.semitones}`;
      case "setPan":
        return `${copy.setPan}: ${statement.pan}`;
      case "callProcedure": {
        const procedure = script?.procedures?.find((item) => item.id === statement.procedureId);
        const numbers = (procedure?.params ?? [])
          .map((param, index) => {
            const arg = statement.args?.[index];
            const value =
              arg?.type === "param"
                ? (owner?.params?.find((item) => item.id === arg.paramId)?.name ?? "?")
                : arg?.type === "numericLiteral"
                  ? arg.value
                  : 0;
            return `${param.name}: ${value}`;
          })
          .join(", ");
        return `${copy.useBlock}: ${procedure?.name ?? "?"}${numbers ? ` (${numbers})` : ""}`;
      }
      case "repeatUntil":
        return `${copy.repeatUntil} ${expressionLabel(statement.condition, history.current, locale)}`;
      case "waitUntil":
        return `${copy.waitUntil} ${expressionLabel(statement.condition, history.current, locale)}`;
      case "if":
        return `${copy.ifLabel} ${expressionLabel(statement.condition, history.current, locale)}`;
      default:
        return "";
    }
  }

  function procedureBlocks(
    procedure: Procedure,
    statements: readonly Statement[],
    path: StudioBlockPath,
  ) {
    return (
      <ol className="kids-studio-nested-blocks">
        {statements.map((item, index) => {
          const here: StudioBlockPath = [...path, index];
          return (
            <li key={`${procedure.id}-${here.join("-")}`}>
              {blockLabel(item, procedure)}
              {item.type === "callProcedure" ? calleeNumbers(procedure, item, here) : null}
              {procedure.params && studioBlockHasNumberSlot(item) ? (
                <select
                  aria-label={`${copy.followsNumber}: ${blockLabel(item)}`}
                  value={studioBlockNumber(item) ?? ""}
                  onChange={(event) =>
                    authorBlock(() =>
                      bindStudioProcedureBlock(
                        history,
                        activeActorId,
                        procedure.id,
                        here,
                        event.target.value === "" ? null : (event.target.value as ProcedureParamId),
                      ),
                    )
                  }
                >
                  <option value="">{copy.fixedNumber}</option>
                  {procedure.params?.map((param) => (
                    <option key={param.id} value={param.id}>
                      {param.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {item.type === "repeat" || item.type === "repeatUntil" || item.type === "forever"
                ? procedureBlocks(procedure, item.body, here)
                : null}
              {item.type === "if" ? procedureBlocks(procedure, item.then, here) : null}
              {item.type === "if" && item.else ? (
                <>
                  <strong>{copy.elseLabel}</strong>
                  {procedureBlocks(procedure, item.else, [...here, "else"])}
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    );
  }

  /** Pickers for a use of one custom block inside another: a fixed number, or the outer block's own. */
  function calleeNumbers(owner: Procedure, statement: Statement, path: StudioBlockPath) {
    if (statement.type !== "callProcedure") return null;
    const callee = script?.procedures?.find((item) => item.id === statement.procedureId);
    if (!callee?.params) return null;
    const units = studioProcedureNumberUnits(callee, script?.procedures);
    const values: StudioCallValue[] = callee.params.map((_param, at) => {
      const arg = statement.args?.[at];
      return arg?.type === "param" ? arg.paramId : arg?.type === "numericLiteral" ? arg.value : 0;
    });
    return callee.params.map((param, at) => {
      const choices = STUDIO_NUMBER_CHOICES[units[at] ?? "number"];
      const current = values[at] ?? 0;
      return (
        <label key={param.id}>
          {copy.numberFor} {param.name} ({callee.name})
          <select
            value={String(current)}
            onChange={(event) => {
              const picked = event.target.value;
              authorBlock(() =>
                setStudioProcedureCallNumbers(
                  history,
                  activeActorId,
                  owner.id,
                  path,
                  values.map((value, position) =>
                    position === at
                      ? /^p[1-3]$/.test(picked)
                        ? (picked as ProcedureParamId)
                        : Number(picked)
                      : value,
                  ),
                ),
              );
            }}
          >
            {(typeof current === "string" || choices.includes(current)
              ? choices
              : [current, ...choices]
            ).map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
            {owner.params?.map((outer) => (
              <option key={outer.id} value={outer.id}>
                {copy.numberFor}: {outer.name}
              </option>
            ))}
          </select>
        </label>
      );
    });
  }

  function callNumbers(statement: Statement, index: number) {
    if (statement.type !== "callProcedure") return null;
    const procedure = script?.procedures?.find((item) => item.id === statement.procedureId);
    if (!procedure?.params) return null;
    const units = studioProcedureNumberUnits(procedure, script?.procedures);
    const values = procedure.params.map((_param, at) => {
      const arg = statement.args?.[at];
      return arg?.type === "numericLiteral" ? arg.value : 0;
    });
    return procedure.params.map((param, at) => {
      const unit = units[at] ?? "number";
      const choices = STUDIO_NUMBER_CHOICES[unit];
      const current = values[at] ?? 0;
      return (
        <label key={param.id}>
          {copy.numberFor} {param.name} ({index + 1})
          <select
            value={current}
            onChange={(event) =>
              authorBlock(() =>
                setStudioCallNumbers(
                  history,
                  activeActorId,
                  index,
                  values.map((value, position) =>
                    position === at ? Number(event.target.value) : value,
                  ),
                ),
              )
            }
          >
            {(choices.includes(current) ? choices : [current, ...choices]).map((choice) => (
              <option key={choice} value={choice}>
                {choice}
              </option>
            ))}
          </select>
        </label>
      );
    });
  }

  function authorBlock(change: () => EditorHistory) {
    try {
      persist(change());
      setBlockToDelete(null);
    } catch {
      setError(true);
    }
  }

  function groupLast(
    type: "repeat" | "repeatUntil" | "forever" | "if",
    overrideCondition?: Expression,
  ) {
    try {
      persist(
        wrapStudioTail(
          history,
          activeActorId,
          groupCount,
          type === "repeat"
            ? { type, times: repeatCount as 2 | 3 | 5 }
            : type === "forever"
              ? { type }
              : { type, condition: overrideCondition ?? condition() },
        ),
      );
    } catch {
      setError(true);
    }
  }

  function changeBackdrop(next: KidsGalleryBackdropId) {
    try {
      setStudioBackdrop(id, next, locale, store);
      setBackdropId(next);
      setRun(null);
      setEvents([{ type: "start" }]);
      setFrame(null);
      setOriIdea(null);
      setOriMessage("");
      setError(false);
    } catch {
      setError(true);
    }
  }

  /** A goal from the closed list becomes a short reviewable sequence; nothing is applied yet. */
  function startIntent(intent: OriStudioIntent) {
    try {
      const context = { actorId: activeActorId, locale, program: history.current };
      const proposal = proposeOriStudioIntent(context, intent);
      const review = validateOriStudioIntentProposal(context, proposal);
      setOriIdea(null);
      setIntentPlan({
        intent,
        candidate: review.candidateProgram,
        statements: proposal.operations.flatMap((operation) =>
          operation.type === "appendStatement" ? [operation.statement] : [],
        ),
        preview: previewCandidate(
          history.current,
          review.candidateProgram,
          creative,
          activeActorId,
          heldKeys,
        ),
      });
      setError(false);
    } catch {
      setError(true);
    }
  }

  /** Listen to Ori's idea before deciding; the speaker is presentation, the runtime is the proof. */
  function listenToIdea() {
    if (!intentPlan) return;
    try {
      const result = runMultiActorProgram(intentPlan.candidate, creative, { keysDown: heldKeys });
      stopKidsSounds();
      if (playKidsMusic(result.trace) > 0) return;
      let played = 0;
      for (const entry of result.trace) {
        if (entry.statementType !== "playSound" || played >= 4) continue;
        played += 1;
        void playKidsSound(
          entry.worldAfter.sounds?.activeSoundIds.at(-1) ?? "kids:pop",
          { kind: "gallery", id: characterOfActor(entry.actorId ?? activeActorId) },
          { volume: entry.worldAfter.sounds?.volume ?? 100 },
        );
      }
    } catch {
      // A blocked speaker never changes the idea or the program.
    }
  }

  function decideIntent(decision: "accept" | "reject") {
    if (!intentPlan) return;
    if (decision === "reject") {
      setIntentPlan(null);
      return;
    }
    try {
      const context = { actorId: activeActorId, locale, program: history.current };
      const review = validateOriStudioIntentProposal(
        context,
        proposeOriStudioIntent(context, intentPlan.intent),
      );
      persist(
        recordCanonicalTransaction(history, {
          label: `Ori goal ${intentPlan.intent}`,
          after: acceptProposal(history.current, review).program,
        }).history,
      );
      reactOri("happy");
      helped.current = true;
    } catch {
      setError(true);
    }
  }

  function recordRunResult(result: MultiActorRunResult) {
    if (waitingChoiceId(result)) return;
    const completed = result.outcome === "completed";
    recordMastery({
      kind: "run",
      concepts: conceptsOfProgram(history.current),
      completed,
      helped: helped.current,
      free: true,
    });
    const reused = reusedConcepts(history.current);
    if (completed && reused.length > 0) recordMastery({ kind: "reuse", concepts: reused });
    helped.current = false;
    setRunCount((count) => count + 1);
  }

  function presentRun(result: MultiActorRunResult) {
    setRun(result);
    setFrame(null);
    stopKidsSounds();
    stopKidsMusic();
    // Music pack: a timeline from the trace; plain sounds below only play without it.
    const timeline = playKidsMusic(result.trace);
    let soundsPlayed = 0;
    for (const entry of timeline > 0 ? [] : result.trace) {
      if (entry.statementType === "stopSounds") {
        stopKidsSounds();
        continue;
      }
      if (entry.statementType !== "playSound" || soundsPlayed >= 4) continue;
      const owner = creative.actors?.find((item) => item.id === entry.actorId);
      if (owner) {
        soundsPlayed += 1;
        void playKidsSound(
          entry.worldAfter.sounds?.activeSoundIds.at(-1) ?? "kids:pop",
          { kind: "gallery", id: characterOfActor(owner.id) },
          { volume: entry.worldAfter.sounds?.volume ?? 100 },
        );
      }
    }
  }

  function downloadScene(includeMedia = false) {
    try {
      if (
        !includeMedia &&
        store.load(id).metadata.assets?.some((asset) => asset.source.startsWith("data:"))
      ) {
        setExportingMedia(true);
        return;
      }
      const blob = new Blob([exportStudioProject(id, store, includeMedia)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url; // agora-allowlist: local Blob download from validated .agorix serializer, not outbound navigation
      anchor.download = sanitizeAgorixFilename(id);
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function play() {
    try {
      choiceAnswers.current = {};
      const result = runMultiActorProgram(history.current, creative, {
        keysDown: heldKeys,
        pointer: pointerRef.current,
        choices: choiceAnswers.current,
      });
      recordRunResult(result);
      presentRun(result);
      setPredictedForRun(prediction);
      setEvents([{ type: "start" }]);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function tapActor(actorId: string) {
    if (
      !run ||
      !history.current.scripts.some(
        (entry) =>
          entry.id === creative.actors?.find((item) => item.id === actorId)?.scripts?.[0] &&
          entry.trigger.type === "onActorClicked",
      )
    ) {
      selectActor(actorId);
      return;
    }
    const nextEvents: readonly RuntimeEvent[] = [...events, { type: "actorClicked", actorId }];
    setRun(
      runMultiActorProgram(history.current, creative, {
        events: nextEvents,
        keysDown: heldKeys,
        pointer: pointerRef.current,
        choices: choiceAnswers.current,
      }),
    );
    setEvents(nextEvents);
    setFrame(null);
    selectActor(actorId);
  }

  async function askOri() {
    if (!actor || !script) return;
    const atRequest = history.current;
    const selected = actor.id;
    setOriBusy(true);
    setOriIdea(null);
    setOriMessage("");
    try {
      const offer = await requestStudioOri({ actorId: selected, locale, program: atRequest });
      if (
        JSON.stringify(currentProgram.current) === JSON.stringify(atRequest) &&
        currentActor.current === selected
      ) {
        setOriMessage(offer.message);
        setOriIdea(offer.proposal ?? null);
      }
    } catch {
      setError(true);
    } finally {
      setOriBusy(false);
    }
  }

  function askOriCompound() {
    try {
      setCompoundOri({
        proposal: proposeOriCompound(history.current, activeActorId, "and", locale),
        join: "and",
      });
      setError(false);
    } catch {
      setCompoundOri(null);
      setError(true);
    }
  }

  function decideOriCompound(decision: "accept" | "change" | "reject") {
    if (!compoundOri || !compoundReview) return;
    try {
      if (decision === "reject") {
        rejectProposal(history.current, compoundReview);
        setCompoundOri(null);
        return;
      }
      let next = acceptProposal(history.current, compoundReview).program;
      if (decision === "change") {
        const operation = compoundOri.proposal.operations[0];
        if (operation?.type !== "appendStatement") throw new Error("invalid Ori idea");
        const changedJoin = compoundOri.join === "and" ? "or" : "and";
        const scripts = [...compoundReview.candidateProgram.scripts];
        const script = scripts[operation.scriptIndex]!;
        scripts[operation.scriptIndex] = {
          ...script,
          statements: [...script.statements.slice(0, -1), oriCompoundStatement(changedJoin)],
        };
        next = modifyProposal(history.current, compoundReview, {
          ...compoundReview.candidateProgram,
          scripts,
        }).program;
      }
      persist(
        recordCanonicalTransaction(history, {
          label: decision === "change" ? "Ori compound idea changed" : "Ori compound idea",
          after: next,
        }).history,
      );
    } catch {
      setCompoundOri(null);
      setError(true);
    }
  }

  function decideOri(decision: "accept" | "change" | "reject") {
    if (!oriIdea) return;
    try {
      const review = validateOriStudioProposal(
        { actorId: activeActorId, locale, program: history.current },
        oriIdea,
      );
      if (decision === "reject") {
        rejectProposal(history.current, review);
        setOriIdea(null);
        setOriMessage("");
        return;
      }
      helped.current = true;
      if (decision === "accept") {
        persist(
          recordCanonicalTransaction(history, {
            label: "Ori studio idea",
            after: acceptProposal(history.current, review).program,
          }).history,
        );
        reactOri("happy");
      } else {
        const operation = oriIdea.operations[0];
        if (operation?.type !== "appendStatement") throw new Error("invalid Ori proposal");
        const scripts = [...history.current.scripts];
        const target = scripts[operation.scriptIndex]!;
        const replacement =
          operation.statement.type === "turn"
            ? { type: "turn" as const, degrees: -operation.statement.degrees }
            : operation.statement.type === "move"
              ? { type: "move" as const, steps: operation.statement.steps === 40 ? 80 : 40 }
              : operation.statement.type === "callProcedure" && otherOwnBlock !== undefined
                ? {
                    type: "callProcedure" as const,
                    procedureId: otherOwnBlock.id,
                    ...(otherOwnBlock.params?.length
                      ? {
                          args: studioProcedureNumberUnits(otherOwnBlock, target.procedures).map(
                            (unit) => ({
                              type: "numericLiteral" as const,
                              value: STUDIO_NUMBER_DEFAULTS[unit],
                            }),
                          ),
                        }
                      : {}),
                  }
                : (() => {
                    throw new Error("invalid Ori block");
                  })();
        scripts[operation.scriptIndex] = {
          ...target,
          statements: [...target.statements, replacement],
        };
        const changed = modifyProposal(history.current, review, { ...history.current, scripts });
        persist(
          recordCanonicalTransaction(history, {
            label: "Ori studio idea changed",
            after: changed.program,
          }).history,
        );
      }
    } catch {
      setOriIdea(null);
      setError(true);
    }
  }

  const tutorialStep = studioTutorialStep({
    blocks: history.current.scripts.reduce((total, item) => total + item.statements.length, 0),
    ran: run !== null,
    stepped,
  });

  return (
    <section className="kids-screen kids-studio" aria-label={copy.title}>
      <header className="kids-studio-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {copy.back}
        </button>
        <h1>{copy.title}</h1>
        <div>
          <button type="button" className="kids-button" onClick={() => downloadScene()}>
            {copy.exportScene}
          </button>
          {tutorialFlag ? (
            <button
              type="button"
              className="kids-button"
              onClick={() => {
                setStudioTutorialDone(false);
                setStepped(false);
                setTutorialOpen(true);
              }}
            >
              {studioTutorialText("help", locale)}
            </button>
          ) : null}
          <button
            type="button"
            className="kids-button"
            disabled={!history.canUndo}
            onClick={() => persist(undoCanonicalTransaction(history).history)}
          >
            {copy.undo}
          </button>
          <button
            type="button"
            className="kids-button"
            disabled={!history.canRedo}
            onClick={() => persist(redoCanonicalTransaction(history).history)}
          >
            {copy.redo}
          </button>
        </div>
      </header>
      {tutorialFlag && tutorialOpen && tutorialStep !== null ? (
        <aside className="kids-tutorial" aria-label={studioTutorialText("title", locale)}>
          <p aria-live="polite" data-testid="studio-tutorial">
            {studioTutorialText(tutorialStep, locale)}
          </p>
          <button
            type="button"
            className="kids-button"
            onClick={() => {
              setStudioTutorialDone(true);
              setTutorialOpen(false);
            }}
          >
            {studioTutorialText("skip", locale)}
          </button>
        </aside>
      ) : null}
      <nav className="kids-studio-categories" aria-label={copy.categories}>
        {studioCategories({ pen: penEnabled, music: musicEnabled }).map((category) => (
          <button
            key={category}
            type="button"
            className="kids-studio-category"
            data-category={category}
            onClick={() => {
              setSheetOpen(true);
              // The sheet is hidden on a phone until it opens, so jump once it is on screen.
              window.setTimeout(() => {
                const heading = document.getElementById(studioCategoryId(category));
                heading?.scrollIntoView({ block: "start" });
                heading?.focus({ preventScroll: true });
              }, 0);
            }}
          >
            {categoryLabel[category]}
          </button>
        ))}
      </nav>
      <div className="kids-studio-layout">
        <div className="kids-studio-stage-column">
          <h2>{copy.stage}</h2>
          <KidsBackdrop
            world={{ kind: "gallery", id: stageBackdrop }}
            imageOverride={stageArt}
            className="kids-studio-stage"
            role="group"
            label={copy.stage}
            onPointerDown={(event) => {
              if (event.target === event.currentTarget)
                event.currentTarget.setPointerCapture(event.pointerId);
              captureStagePointer(event, true);
            }}
            onPointerMove={(event) => captureStagePointer(event, event.buttons !== 0)}
            onPointerUp={(event) => captureStagePointer(event, false)}
            onPointerCancel={(event) => captureStagePointer(event, false)}
          >
            {shownActors?.some((entry) => entry.world.pen?.segments.length) ? (
              <svg
                className="kids-studio-pen"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {shownActors.flatMap((entry) =>
                  (entry.world.pen?.segments ?? []).map((segment, index) => (
                    <line
                      key={`${entry.id}-${index}`}
                      x1={stageX(segment.x1)}
                      y1={stageY(segment.y1)}
                      x2={stageX(segment.x2)}
                      y2={stageY(segment.y2)}
                      stroke={PEN_HEX[segment.color]}
                      strokeWidth={segment.size / 2}
                      strokeLinecap="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  )),
                )}
              </svg>
            ) : null}
            {creative.actors?.map((item) => {
              const final = shownActors?.find((entry) => entry.id === item.id);
              const characterId = characterOfCostume(
                final?.world.sprite.costumeId,
                characterOfActor(item.id),
              );
              const x =
                dragPreview?.id === item.id ? dragPreview.x : (final?.world.sprite.x ?? item.x);
              const y =
                dragPreview?.id === item.id ? dragPreview.y : (final?.world.sprite.y ?? item.y);
              const sprite = final?.world.sprite;
              const costumeArt = customImagesEnabled
                ? creative.assets?.find(
                    (asset) =>
                      asset.id === (sprite?.costumeId ?? item.costumeId) &&
                      asset.source.startsWith("data:"),
                  )?.source
                : undefined;
              if (sprite?.visible === false) return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="kids-studio-stage-actor"
                  style={{
                    left: `${Math.max(4, Math.min(90, 8 + x / 4))}%`,
                    top: `${Math.max(8, Math.min(82, 40 + y / 3))}%`,
                    zIndex: (shownStage?.actorOrder?.indexOf(item.id) ?? 0) + 1,
                  }}
                  aria-label={`${copy.chooseActor}: ${item.name} ${item.id}`}
                  aria-pressed={activeActorId === item.id}
                  onClick={() => {
                    if (suppressStageClick.current) {
                      suppressStageClick.current = false;
                      return;
                    }
                    tapActor(item.id);
                  }}
                  onPointerDown={(event) => beginDrag(event, item.id, item.x, item.y)}
                  onPointerMove={moveDrag}
                  onPointerUp={endDrag}
                  onPointerCancel={() => {
                    dragStart.current = null;
                    setDragPreview(null);
                  }}
                >
                  <span
                    className="kids-studio-stage-costume"
                    style={{ transform: `scale(${(sprite?.size ?? 100) / 100})` }}
                  >
                    <KidsSprite
                      slot={{ kind: "gallery", id: characterId }}
                      imageOverride={costumeArt}
                      label={item.name}
                    />
                  </span>
                  {sprite?.bubble ? (
                    <span className="kids-studio-bubble">
                      {sprite.bubble.kind === "think" ? "☁ " : ""}
                      {sprite.bubble.text}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </KidsBackdrop>
          {customImagesEnabled ? (
            <div className="kids-studio-art-controls">
              <button
                type="button"
                className="kids-button"
                onClick={() => {
                  setEditingArtId(null);
                  setDrawingKind("costume");
                }}
              >
                {copy.drawCostume}
              </button>
              <button
                type="button"
                className="kids-button"
                onClick={() => {
                  setEditingArtId(null);
                  setDrawingKind("backdrop");
                }}
              >
                {copy.drawBackdrop}
              </button>
              <label className="kids-button kids-image-file">
                {copy.uploadCostume}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={copy.uploadCostume}
                  onChange={(event) => void importImage("costume", event)}
                />
              </label>
              <label className="kids-button kids-image-file">
                {copy.uploadBackdrop}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={copy.uploadBackdrop}
                  onChange={(event) => void importImage("backdrop", event)}
                />
              </label>
              {ownCostumes.length ? (
                <div role="group" aria-label={copy.ownCostumes}>
                  {ownCostumes.map((asset) => (
                    <span key={asset.id}>
                      <button
                        type="button"
                        className="kids-button"
                        aria-pressed={actor?.costumeId === asset.id}
                        onClick={() => chooseArt(asset.id)}
                      >
                        {asset.name}
                      </button>
                      <button
                        type="button"
                        className="kids-button"
                        aria-label={`${copy.edit} ${asset.name}`}
                        onClick={() => {
                          setEditingArtId(asset.id);
                          setDrawingKind("costume");
                        }}
                      >
                        {copy.edit}
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {ownBackdrops.length ? (
                <div role="group" aria-label={copy.ownBackdrops}>
                  {ownBackdrops.map((asset) => (
                    <span key={asset.id}>
                      <button
                        type="button"
                        className="kids-button"
                        aria-pressed={creative.stage?.backdropId === asset.id}
                        onClick={() => chooseArt(asset.id)}
                      >
                        {asset.name}
                      </button>
                      <button
                        type="button"
                        className="kids-button"
                        aria-label={`${copy.edit} ${asset.name}`}
                        onClick={() => {
                          setEditingArtId(asset.id);
                          setDrawingKind("backdrop");
                        }}
                      >
                        {copy.edit}
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {customImagesEnabled && drawingKind ? (
            <KidsDrawArt
              kind={drawingKind === "costume" ? "explorer" : "backdrop"}
              locale={locale}
              initialImage={creative.assets?.find((asset) => asset.id === editingArtId)?.source}
              onSave={saveDrawing}
              onCancel={() => {
                setDrawingKind(null);
                setEditingArtId(null);
              }}
              onError={() => setError(true)}
            />
          ) : null}
          <div
            className="kids-studio-placement"
            role="group"
            aria-label={`${copy.place}: ${actor?.name ?? ""}`}
          >
            <span>
              {copy.place}: {actor?.name}
            </span>
            <button
              type="button"
              className="kids-button"
              aria-label={`${copy.place} ←`}
              disabled={!actor || actor.x <= 0}
              onClick={() => placeActor(-20, 0)}
            >
              ←
            </button>
            <button
              type="button"
              className="kids-button"
              aria-label={`${copy.place} ↑`}
              disabled={!actor || actor.y <= -100}
              onClick={() => placeActor(0, -20)}
            >
              ↑
            </button>
            <button
              type="button"
              className="kids-button"
              aria-label={`${copy.place} ↓`}
              disabled={!actor || actor.y >= 120}
              onClick={() => placeActor(0, 20)}
            >
              ↓
            </button>
            <button
              type="button"
              className="kids-button"
              aria-label={`${copy.place} →`}
              disabled={!actor || actor.x >= 320}
              onClick={() => placeActor(20, 0)}
            >
              →
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={
                !actor ||
                (creative.stage?.actorOrder?.indexOf(actor.id) ?? 0) ===
                  (creative.stage?.actorOrder?.length ?? 1) - 1
              }
              onClick={() => changeLayer("forward")}
            >
              {copy.forward}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={!actor || (creative.stage?.actorOrder?.indexOf(actor.id) ?? 0) === 0}
              onClick={() => changeLayer("backward")}
            >
              {copy.backward}
            </button>
          </div>
          <StudioPrediction
            locale={locale}
            name={actor?.name ?? ""}
            value={prediction}
            onChange={setPrediction}
          />
          <div className="kids-run-controls">
            <button type="button" className="kids-button kids-primary" onClick={play}>
              {copy.run}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={!run || (frame !== null && frame >= run.frames.length - 1)}
              onClick={() => {
                setStepped(true);
                setFrame(frame === null ? 0 : frame + 1);
              }}
            >
              {copy.step}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => {
                setRun(null);
                setFrame(null);
              }}
            >
              {copy.reset}
            </button>
          </div>
          <p className="kids-note">
            {copy.facts}:{" "}
            {run
              ? `${run.trace.length} ${locale === "es" ? (run.trace.length === 1 ? "bloque ejecutado" : "bloques ejecutados") : run.trace.length === 1 ? "block executed" : "blocks executed"}`
              : "—"}
          </p>
          {pendingChoiceId ? (
            <div role="group" aria-label={copy.askChoice} className="kids-studio-compound">
              <strong>{CHOICE_CATALOG[pendingChoiceId].prompt[locale]}</strong>
              {CHOICE_CATALOG[pendingChoiceId].options.map((option, index) => (
                <button
                  key={index}
                  type="button"
                  className="kids-button"
                  onClick={() => {
                    try {
                      choiceAnswers.current = {
                        ...choiceAnswers.current,
                        [pendingChoiceId]: index + 1,
                      };
                      const result = runMultiActorProgram(history.current, creative, {
                        events,
                        keysDown: heldKeys,
                        pointer: pointerRef.current,
                        choices: choiceAnswers.current,
                      });
                      recordRunResult(result);
                      presentRun(result);
                      setError(false);
                    } catch {
                      setError(true);
                    }
                  }}
                >
                  {option[locale]}
                </button>
              ))}
            </div>
          ) : null}
          {run?.outcome === "stopped" && !pendingChoiceId ? (
            <p className="kids-note" role="status">
              {locale === "es" ? "Programa detenido: " : "Program stopped: "}
              {(() => {
                const scope = run.trace
                  .filter((entry) => entry.statementType === "stop")
                  .at(-1)?.stopScope;
                return scope === "script"
                  ? copy.stopScript
                  : scope === "actor"
                    ? copy.stopActor
                    : scope === "scene"
                      ? copy.stopScene
                      : copy.stop;
              })()}
            </p>
          ) : null}
          {run?.trace.some((entry) => entry.statementType === "waitUntil" && entry.note) ? (
            <p className="kids-note" role="status">
              {oriSuggestions ? "Ori: " : ""}
              {copy.waitUntilTimeout}
            </p>
          ) : null}
          {run?.outcome === "budget-exceeded" &&
          run.trace.some((entry) => entry.statementType === "forever") ? (
            <p className="kids-note" role="status">
              {oriSuggestions ? "Ori: " : ""}
              {copy.foreverBudget}
            </p>
          ) : null}
          {oriSuggestions ? (
            <KidsLoopHelp
              locale={locale}
              program={history.current}
              run={run}
              actorId={activeActorId}
              onApplyProgram={(next, label) => {
                try {
                  persist(recordCanonicalTransaction(history, { label, after: next }).history);
                  helped.current = true;
                  reactOri("happy");
                } catch {
                  setError(true);
                }
              }}
            />
          ) : null}
          <KidsSceneGoalPanel
            locale={locale}
            actors={creative.actors ?? []}
            goal={
              sceneGoal !== null &&
              sceneGoalValid(
                sceneGoal,
                (creative.actors ?? []).map((item) => item.id),
              )
                ? sceneGoal
                : null
            }
            run={run}
            program={history.current}
            oriSuggestions={oriSuggestions}
            onApplyProgram={(next, label) => {
              try {
                persist(recordCanonicalTransaction(history, { label, after: next }).history);
                helped.current = true;
                reactOri("happy");
              } catch {
                setError(true);
              }
            }}
            onChange={(next) => {
              try {
                setStudioSceneGoal(id, next, store);
                setSceneGoal(next);
              } catch {
                setError(true);
              }
            }}
          />
          {run && actor ? (
            <StudioCoach
              key={runCount}
              locale={locale}
              name={actor.name}
              facts={factsOfRun(run, activeActorId)}
              predicted={predictedForRun}
              onExplained={() =>
                recordMastery({ kind: "explained", concepts: conceptsOfProgram(history.current) })
              }
              reflection={reflectionFor(
                ageBand ?? "6-8",
                factsOfRun(run, activeActorId),
                script?.statements.map((statement) => statement.type) ?? [],
                actor.name,
                locale,
              )}
            />
          ) : null}
          {run?.trace.some((entry) => entry.conditionResult !== undefined) ? (
            <p className="kids-note" role="status">
              {copy.conditionResult}:{" "}
              {run.trace.filter((entry) => entry.conditionResult !== undefined).at(-1)
                ?.conditionResult
                ? copy.yes
                : copy.no}
            </p>
          ) : null}
          {run ? (
            <p className="kids-note">
              {copy.volume}: {shownWorld?.sounds?.volume ?? 100}%
            </p>
          ) : null}
          {history.current.variables?.length || history.current.lists?.length ? (
            <div className="kids-studio-watchers" aria-label={copy.watchers}>
              <h3>{copy.watchers}</h3>
              {history.current.variables
                ?.filter((item) => shownWorld?.variables?.[item.id]?.visible !== false)
                .map((item) => (
                  <p key={item.id}>
                    {item.name}: {shownWorld?.variables?.[item.id]?.value ?? item.initialValue}
                  </p>
                ))}
              {history.current.lists?.map((item) => (
                <p key={item.id}>
                  {item.name}:{" "}
                  {(
                    shownActors?.find((entry) => entry.id === activeActorId)?.world.lists?.[item.id]
                      ?.items ?? item.initialItems
                  ).join(", ") || "—"}
                </p>
              ))}
            </div>
          ) : null}
          <h2>{copy.actors}</h2>
          <div className="kids-studio-actors" role="group" aria-label={copy.actors}>
            {creative.actors?.map((item) => (
              <button
                key={item.id}
                type="button"
                className="kids-button"
                data-drop-actor={item.id}
                data-over={over === `actor:${item.id}` ? "true" : undefined}
                aria-pressed={activeActorId === item.id}
                onClick={() => selectActor(item.id)}
              >
                <KidsSprite
                  slot={{ kind: "gallery", id: characterOfActor(item.id) }}
                  label={item.name}
                />{" "}
                {item.name} {item.id.split("-")[2]}
              </button>
            ))}
          </div>
          <div className="kids-studio-add">
            <label>
              {copy.add}
              <select
                value={newCharacter}
                onChange={(event) => setNewCharacter(event.target.value as KidsGalleryCharacterId)}
              >
                {KIDS_GALLERY_CHARACTERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {galleryCharacterName(item.id, locale)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={(creative.actors?.length ?? 0) >= 12}
              onClick={addActor}
            >
              + {copy.add}
            </button>
            {(creative.actors?.length ?? 0) >= 12 ? (
              <p className="kids-note">{copy.actorLimit}</p>
            ) : null}
          </div>
          <label className="kids-studio-backdrop-select">
            {copy.backdrop}
            <select
              value={backdropId}
              onChange={(event) => changeBackdrop(event.target.value as KidsGalleryBackdropId)}
            >
              {KIDS_GALLERY_BACKDROPS.map((item) => (
                <option key={item.id} value={item.id}>
                  {galleryBackdropName(item.id, locale)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="kids-studio-program-column">
          <h2>
            {copy.blocks} {actor?.name}
          </h2>
          <div className="kids-program-stack">
            <label>
              {copy.event}
              <select
                value={script?.trigger.type ?? "greenFlag"}
                onChange={(event) => setEvent(event.target.value as StudioEvent)}
              >
                <option value="greenFlag">{copy.onPlay}</option>
                <option value="onActorClicked">{copy.onTap}</option>
                <option value="onKeyPressed">{copy.onKey}</option>
                <option value="onMessage">{copy.onMessage}</option>
              </select>
            </label>
            {script?.trigger.type === "onKeyPressed" ? (
              <label>
                {copy.onKey}{" "}
                <select
                  value={script.trigger.key}
                  onChange={(event) => {
                    const key = event.target.value as (typeof STUDIO_KEYS)[number];
                    setEventKey(key);
                    persist(
                      setStudioTrigger(history, activeActorId, { type: "onKeyPressed", key }),
                    );
                  }}
                >
                  {STUDIO_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {script?.trigger.type === "onMessage" ? (
              <label>
                {copy.onMessage}{" "}
                <select
                  value={script.trigger.message}
                  onChange={(event) => {
                    const message = event.target.value as (typeof STUDIO_MESSAGES)[number];
                    setEventMessage(message);
                    persist(
                      setStudioTrigger(history, activeActorId, { type: "onMessage", message }),
                    );
                  }}
                >
                  {STUDIO_MESSAGES.map((message) => (
                    <option key={message} value={message}>
                      {message}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="kids-start-block">
              ▶{" "}
              {script?.trigger.type === "onActorClicked"
                ? copy.onTap
                : script?.trigger.type === "onKeyPressed"
                  ? `${copy.onKey} ${script.trigger.key}`
                  : script?.trigger.type === "onMessage"
                    ? `${copy.onMessage} ${script.trigger.message}`
                    : copy.onPlay}
            </div>
            {script?.trigger.type === "onActorClicked" ? (
              <p className="kids-note">{copy.tapHint}</p>
            ) : null}
            {script?.trigger.type === "onKeyPressed" ? (
              <button
                type="button"
                className="kids-button"
                disabled={!run}
                onClick={() =>
                  fireKey(script.trigger.type === "onKeyPressed" ? script.trigger.key : "")
                }
              >
                {copy.pressKey}: {script.trigger.key}
              </button>
            ) : null}
            <ol
              ref={programRef}
              className="kids-program-drop"
              data-drop-list={JSON.stringify({ container: null })}
              data-over={
                over?.startsWith(`${JSON.stringify({ container: null })}#`) ? "true" : undefined
              }
              aria-label={copy.dragHint}
              data-hint={copy.dropHere}
            >
              {script?.statements.map((statement, index) => (
                <li
                  key={`${script.id}-${index}`}
                  className="kids-program-block"
                  data-block-path={JSON.stringify([index])}
                  data-dragging={
                    drag && drag.from.length === 1 && drag.from[0] === index ? "true" : undefined
                  }
                  data-target={
                    over === `${JSON.stringify({ container: null })}#${index}` ? "true" : undefined
                  }
                >
                  <button
                    type="button"
                    className="kids-block-handle"
                    aria-label={`${copy.moveBlock} ${index + 1}`}
                    onPointerDown={(event) => beginBlockDrag(event, [index])}
                    onPointerMove={overBlockDrag}
                    onPointerUp={endBlockDrag}
                    onPointerCancel={() => setDrag(null)}
                  >
                    ⠿
                  </button>
                  <span>{blockLabel(statement)}</span>
                  {callNumbers(statement, index)}
                  {statement.type === "repeat" ||
                  statement.type === "repeatUntil" ||
                  statement.type === "forever"
                    ? programList(statement.body, [index])
                    : null}
                  {statement.type === "if" ? programList(statement.then, [index]) : null}
                  {statement.type === "if" && statement.else ? (
                    <>
                      <strong>{copy.elseLabel}</strong>
                      {programList(statement.else, [index], "else")}
                    </>
                  ) : null}
                  {placeChoices([index]).length > 0 ? (
                    <select
                      aria-label={`${copy.moveTo} ${index + 1}`}
                      value=""
                      onChange={(event) => {
                        placeChoices([index])[Number(event.target.value)]?.run();
                      }}
                    >
                      <option value="">{copy.moveTo}</option>
                      {placeChoices([index]).map((choice, at) => (
                        <option key={choice.label} value={at}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    className="kids-button"
                    aria-label={`${copy.blockUp} ${index + 1}`}
                    disabled={index === 0}
                    onClick={() =>
                      persist(moveStudioStatement(history, activeActorId, index, index - 1))
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="kids-button"
                    aria-label={`${copy.blockDown} ${index + 1}`}
                    disabled={index === (script?.statements.length ?? 1) - 1}
                    onClick={() =>
                      persist(moveStudioStatement(history, activeActorId, index, index + 1))
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="kids-button"
                    aria-label={`${copy.remove} ${index + 1}`}
                    onClick={() => persist(removeStudioStatement(history, activeActorId, index))}
                  >
                    ×
                  </button>
                </li>
              ))}
              {intentPlan?.statements.map((statement, index) => (
                <li
                  key={`intent-ghost-${index}`}
                  className="kids-ghost-block"
                  data-testid="ori-ghost-block"
                >
                  <span>{blockLabel(statement)}</span>
                  <small>{copy.ghostNote}</small>
                </li>
              ))}
              {oriPreview && proposedStatement ? (
                <li className="kids-ghost-block" data-testid="ori-ghost-block">
                  <span>{blockLabel(proposedStatement)}</span>
                  <small>{copy.ghostNote}</small>
                </li>
              ) : null}
            </ol>
            {script?.statements.length === 0 ? <p className="kids-note">{copy.noBlocks}</p> : null}
          </div>
          <button
            type="button"
            className="kids-button kids-primary kids-studio-sheet-toggle"
            aria-expanded={sheetOpen}
            onClick={() => {
              setSheetOpen((open) => !open);
              // Opening covers the lower half: bring the program above the sheet.
              if (!sheetOpen)
                window.setTimeout(
                  () =>
                    document
                      .querySelector(".kids-studio-program-column")
                      ?.scrollIntoView({ block: "start" }),
                  0,
                );
            }}
          >
            {sheetOpen ? copy.sheetClose : copy.sheetOpen}
          </button>
          <div
            className="kids-studio-palette"
            ref={setPalette}
            data-sheet={sheetOpen ? "open" : "closed"}
          >
            <p className="kids-note kids-studio-sheet-hint">{copy.sheetHint}</p>
            {/* A shelf over the whole palette: it suggests where to begin and hides nothing (#1110). */}
            <section className="kids-studio-starters" aria-label={copy.starters}>
              <h3>{copy.starters}</h3>
              <p className="kids-note">{copy.startersNote}</p>
              <div className="kids-studio-starter-row">
                {starterShelf(script?.statements ?? []).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="kids-button"
                    data-starter={kind}
                    onClick={() => add(starterStatement(kind, newSound))}
                  >
                    ★ {starterLabel(kind, copy)}
                  </button>
                ))}
              </div>
            </section>
            <h3 id={studioCategoryId("looks")} tabIndex={-1}>
              {copy.paletteLooks}
            </h3>
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.say,
                  disabled: !bubbleText.trim(),
                  block: "say",
                  onAdd: () => add({ type: "say", text: bubbleText.trim() }),
                },
                {
                  label: copy.think,
                  disabled: !bubbleText.trim(),
                  block: "think",
                  onAdd: () => add({ type: "think", text: bubbleText.trim() }),
                },
              ]}
            >
              <input
                type="text"
                aria-label={`${copy.say} / ${copy.think}`}
                maxLength={STUDIO_BUBBLE_MAX_LENGTH}
                value={bubbleText}
                onChange={(event) => setBubbleText(event.target.value)}
              />
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="looks"
              actions={[{ label: copy.show, block: "show", onAdd: () => add({ type: "show" }) }]}
            />
            <KidsPaletteBlock
              tone="looks"
              actions={[{ label: copy.hide, block: "hide", onAdd: () => add({ type: "hide" }) }]}
            />
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.size,
                  block: "setSize",
                  onAdd: () => add({ type: "setSize", size: spriteSize }),
                },
              ]}
            >
              <select
                aria-label={copy.size}
                value={spriteSize}
                onChange={(event) => setSpriteSize(Number(event.target.value))}
              >
                {STUDIO_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}%
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.growShrink,
                  block: "changeSize",
                  onAdd: () => add({ type: "changeSize", delta: sizeDelta }),
                },
              ]}
            >
              <select
                aria-label={copy.growShrink}
                value={sizeDelta}
                onChange={(event) => setSizeDelta(Number(event.target.value))}
              >
                {STUDIO_SIZE_DELTAS.map((delta) => (
                  <option key={delta} value={delta}>
                    {delta > 0 ? "+" : ""}
                    {delta}%
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.setEffect,
                  block: "setEffect",
                  onAdd: () => add({ type: "setEffect", effect: effectKind, value: effectValue }),
                },
                {
                  label: copy.changeEffect,
                  block: "changeEffect",
                  onAdd: () =>
                    add({ type: "changeEffect", effect: effectKind, delta: effectDelta }),
                },
                {
                  label: copy.clearEffects,
                  block: "clearEffects",
                  onAdd: () => add({ type: "clearEffects" }),
                },
              ]}
            >
              <select
                aria-label={copy.setEffect}
                value={effectKind}
                onChange={(event) => {
                  const next = event.target.value as typeof effectKind;
                  setEffectKind(next);
                  setEffectValue(next === "brightness" ? 0 : 50);
                }}
              >
                {(["color", "ghost", "brightness"] as const).map((effect) => (
                  <option key={effect} value={effect}>
                    {effectName(effect)}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${copy.setEffect}: ${effectName(effectKind)}`}
                value={effectValue}
                onChange={(event) => setEffectValue(Number(event.target.value))}
              >
                {studioEffectValues(effectKind).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                aria-label={copy.changeEffect}
                value={effectDelta}
                onChange={(event) => setEffectDelta(Number(event.target.value))}
              >
                {STUDIO_EFFECT_DELTAS.map((delta) => (
                  <option key={delta} value={delta}>
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.wait,
                  block: "wait",
                  onAdd: () => add({ type: "wait", seconds: waitSeconds }),
                },
              ]}
            >
              <select
                aria-label={copy.wait}
                value={waitSeconds}
                onChange={(event) => setWaitSeconds(Number(event.target.value))}
              >
                {STUDIO_WAIT_SECONDS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <h3 id={studioCategoryId("motion")} tabIndex={-1}>
              {copy.paletteMotion}
            </h3>
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.move,
                  block: "move",
                  onAdd: () => add({ type: "move", steps: moveCells * 40 }),
                },
                {
                  label: copy.moveBackward,
                  block: "move",
                  onAdd: () => add({ type: "move", steps: -moveCells * 40 }),
                },
              ]}
            >
              <select
                aria-label={copy.move}
                value={moveCells}
                onChange={(event) => setMoveCells(Number(event.target.value))}
              >
                {STUDIO_MOVE_CELLS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.goTo,
                  disabled: targetOutOfRange,
                  block: "goTo",
                  onAdd: () => add({ type: "goTo", x: targetX, y: targetY }),
                },
                {
                  label: `${copy.glideTo} (${waitSeconds}s)`,
                  disabled: targetOutOfRange,
                  block: "glideTo",
                  onAdd: () =>
                    add({ type: "glideTo", x: targetX, y: targetY, seconds: waitSeconds }),
                },
              ]}
            >
              <input
                type="number"
                aria-label={copy.xCoordinate}
                min={STUDIO_X_RANGE.min}
                max={STUDIO_X_RANGE.max}
                step={1}
                value={targetX}
                onChange={(event) => setTargetX(Number(event.target.value))}
              />
              <input
                type="number"
                aria-label={copy.yCoordinate}
                min={STUDIO_Y_RANGE.min}
                max={STUDIO_Y_RANGE.max}
                step={1}
                value={targetY}
                onChange={(event) => setTargetY(Number(event.target.value))}
              />
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.turnLeft,
                  block: "turn",
                  onAdd: () => add({ type: "turn", degrees: -turnAmount }),
                },
                {
                  label: copy.turnRight,
                  block: "turn",
                  onAdd: () => add({ type: "turn", degrees: turnAmount }),
                },
              ]}
            >
              <select
                aria-label={copy.turnAmount}
                value={turnAmount}
                onChange={(event) => setTurnAmount(Number(event.target.value))}
              >
                {STUDIO_TURN_AMOUNTS.map((degrees) => (
                  <option key={degrees} value={degrees}>
                    {degrees}°
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.pointDirection,
                  block: "pointInDirection",
                  onAdd: () => add({ type: "pointInDirection", degrees: pointDegrees }),
                },
              ]}
            >
              <select
                aria-label={copy.pointDirection}
                value={pointDegrees}
                onChange={(event) => setPointDegrees(Number(event.target.value))}
              >
                {directionOptions.map((item) => (
                  <option key={item.degrees} value={item.degrees}>
                    {item.name}
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            {pointTarget ? (
              <KidsPaletteBlock
                tone="motion"
                actions={[
                  {
                    label: copy.pointTowards,
                    block: "pointTowards",
                    onAdd: () => add({ type: "pointTowards", actorId: pointTarget.id }),
                  },
                ]}
              >
                <select
                  aria-label={copy.pointTowards}
                  value={pointTarget.id}
                  onChange={(event) => setPointTargetId(event.target.value)}
                >
                  {otherActors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </KidsPaletteBlock>
            ) : null}
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.bounceOnEdge,
                  block: "bounceOnEdge",
                  onAdd: () => add({ type: "bounceOnEdge" }),
                },
              ]}
            />
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.layerFront,
                  block: "goToLayer",
                  onAdd: () => add({ type: "goToLayer", layer: "front" }),
                },
              ]}
            />
            <KidsPaletteBlock
              tone="motion"
              actions={[
                {
                  label: copy.layerBack,
                  block: "goToLayer",
                  onAdd: () => add({ type: "goToLayer", layer: "back" }),
                },
              ]}
            />
            <h3 id={studioCategoryId("media")} tabIndex={-1}>
              {copy.paletteMedia}
            </h3>
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.costume,
                  block: "switchCostume",
                  onAdd: () => add({ type: "switchCostume", costumeId: `costume:${newCostume}` }),
                },
              ]}
            >
              <select
                aria-label={copy.costume}
                value={newCostume}
                onChange={(event) => setNewCostume(event.target.value as KidsGalleryCharacterId)}
              >
                {KIDS_GALLERY_CHARACTERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {galleryCharacterName(item.id, locale)}
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="looks"
              actions={[
                {
                  label: copy.switchBackdrop,
                  block: "switchBackdrop",
                  onAdd: () =>
                    add({ type: "switchBackdrop", backdropId: `backdrop:${newBackdrop}` }),
                },
              ]}
            >
              <select
                aria-label={copy.switchBackdrop}
                value={newBackdrop}
                onChange={(event) => setNewBackdrop(event.target.value as KidsGalleryBackdropId)}
              >
                {KIDS_GALLERY_BACKDROPS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {galleryBackdropName(item.id, locale)}
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="sound"
              actions={[
                {
                  label: copy.sound,
                  block: "playSound",
                  onAdd: () => add({ type: "playSound", soundId: newSound }),
                },
                {
                  label: `▶ ${copy.sound}`,
                  kind: "tool",
                  onAdd: () =>
                    void playKidsSound(newSound, {
                      kind: "gallery",
                      id: characterOfActor(activeActorId),
                    }),
                },
              ]}
            >
              <select
                aria-label={copy.sound}
                value={newSound}
                onChange={(event) =>
                  setNewSound(event.target.value as (typeof KIDS_SOUNDS)[number]["id"])
                }
              >
                {KIDS_SOUNDS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item[locale]}
                  </option>
                ))}
              </select>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="sound"
              actions={[
                {
                  label: copy.stopSounds,
                  block: "stopSounds",
                  onAdd: () => add({ type: "stopSounds" }),
                },
              ]}
            />
            <KidsPaletteBlock
              tone="sound"
              actions={[
                {
                  label: copy.setVolume,
                  disabled: !inStudioRange(volume, STUDIO_VOLUME_RANGE),
                  block: "setVolume",
                  onAdd: () => add({ type: "setVolume", volume }),
                },
              ]}
            >
              <input
                type="number"
                aria-label={copy.volume}
                min={STUDIO_VOLUME_RANGE.min}
                max={STUDIO_VOLUME_RANGE.max}
                step={1}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="sound"
              actions={[
                {
                  label: copy.changeVolume,
                  disabled: !inStudioRange(volumeChange, STUDIO_VOLUME_DELTA_RANGE),
                  block: "changeVolume",
                  onAdd: () => add({ type: "changeVolume", delta: volumeChange }),
                },
              ]}
            >
              <input
                type="number"
                aria-label={copy.volumeChange}
                min={STUDIO_VOLUME_DELTA_RANGE.min}
                max={STUDIO_VOLUME_DELTA_RANGE.max}
                step={1}
                value={volumeChange}
                onChange={(event) => setVolumeChange(Number(event.target.value))}
              />
            </KidsPaletteBlock>
            <h3 id={studioCategoryId("logic")} tabIndex={-1}>
              {copy.paletteLogic}
            </h3>
            <KidsPaletteBlock
              tone="control"
              actions={[
                {
                  label: `${copy.repeat} → ${copy.thenMove}`,
                  block: "repeat",
                  onAdd: () =>
                    add({
                      type: "repeat",
                      count: repeatCount,
                      body: [{ type: "move", steps: 40 }],
                    }),
                },
                {
                  label: copy.groupRepeat,
                  kind: "tool",
                  disabled: (script?.statements.length ?? 0) < groupCount,
                  onAdd: () => groupLast("repeat"),
                },
              ]}
            >
              <label>
                {copy.repeat}{" "}
                <select
                  aria-label={copy.repeat}
                  value={repeatCount}
                  onChange={(event) => setRepeatCount(Number(event.target.value))}
                >
                  {STUDIO_REPEAT_COUNTS.map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {copy.groupCount}{" "}
                <select
                  aria-label={copy.groupCount}
                  value={groupCount}
                  onChange={(event) => setGroupCount(Number(event.target.value))}
                >
                  {[1, 2, 3].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </KidsPaletteBlock>
            <KidsPaletteBlock
              tone="control"
              actions={[
                {
                  label: `${copy.forever} → ${copy.thenMove}`,
                  disabled: containsForever(script?.statements ?? []),
                  block: "forever",
                  onAdd: () => add({ type: "forever", body: [{ type: "move", steps: 40 }] }),
                },
                {
                  label: copy.groupForever,
                  kind: "tool",
                  disabled:
                    containsForever(script?.statements ?? []) ||
                    (script?.statements.length ?? 0) < groupCount,
                  onAdd: () => groupLast("forever"),
                },
              ]}
            />
            <h3 id={studioCategoryId("myBlocks")} tabIndex={-1}>
              {copy.myBlocks}
            </h3>
            <label>
              {copy.myBlockName}
              <input
                type="text"
                maxLength={STUDIO_NAME_MAX_LENGTH}
                value={blockName}
                onChange={(event) => setBlockName(event.target.value)}
              />
            </label>
            <label>
              {copy.numberTitle}
              <input
                type="text"
                maxLength={STUDIO_NAME_MAX_LENGTH}
                value={numberTitle}
                onChange={(event) => setNumberTitle(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={
                !numberTitle.trim() ||
                blockNumbers.length >= 3 ||
                blockNumbers.some((item) => item.toLowerCase() === numberTitle.trim().toLowerCase())
              }
              onClick={() => {
                setBlockNumbers([...blockNumbers, numberTitle.trim()]);
                setNumberTitle("");
              }}
            >
              {copy.addNumber}
            </button>
            {blockNumbers.map((title) => (
              <button
                key={title}
                type="button"
                className="kids-button"
                aria-label={`${copy.removeNumber}: ${title}`}
                onClick={() => setBlockNumbers(blockNumbers.filter((item) => item !== title))}
              >
                {title} ✕
              </button>
            ))}
            <button
              type="button"
              className="kids-button"
              disabled={!blockName.trim() || (script?.statements.length ?? 0) < groupCount}
              onClick={() => {
                authorBlock(() =>
                  createStudioProcedure(
                    history,
                    activeActorId,
                    groupCount,
                    blockName.trim(),
                    blockNumbers,
                  ),
                );
                setBlockName("");
                setBlockNumbers([]);
              }}
            >
              {copy.makeBlock}
            </button>
            <ul className="kids-studio-my-blocks">
              {script?.procedures?.map((item) => {
                const uses = studioProcedureUses(history.current, activeActorId, item.id);
                const draft = blockRenames[item.id] ?? item.name;
                return (
                  <li key={item.id}>
                    <strong>{item.name}</strong>
                    {procedureBlocks(item, item.body, [])}
                    {item.params?.map((param) => (
                      <button
                        key={param.id}
                        type="button"
                        className="kids-button"
                        aria-label={`${copy.removeNumber}: ${param.name} (${item.name})`}
                        onClick={() =>
                          authorBlock(() =>
                            removeStudioProcedureNumber(history, activeActorId, item.id, param.id),
                          )
                        }
                      >
                        {param.name} ✕
                      </button>
                    ))}
                    {(item.params?.length ?? 0) < 3 ? (
                      <>
                        <label>
                          {copy.numberTitle} ({item.name})
                          <input
                            type="text"
                            maxLength={STUDIO_NAME_MAX_LENGTH}
                            value={numberTitles[item.id] ?? ""}
                            onChange={(event) =>
                              setNumberTitles({ ...numberTitles, [item.id]: event.target.value })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="kids-button"
                          disabled={!(numberTitles[item.id] ?? "").trim()}
                          onClick={() => {
                            authorBlock(() =>
                              addStudioProcedureNumber(
                                history,
                                activeActorId,
                                item.id,
                                (numberTitles[item.id] ?? "").trim(),
                              ),
                            );
                            setNumberTitles({ ...numberTitles, [item.id]: "" });
                          }}
                        >
                          {copy.addNumber}: {item.name}
                        </button>
                      </>
                    ) : null}
                    <button
                      data-kids-block="callProcedure"
                      type="button"
                      className="kids-button"
                      onClick={() => {
                        const units = studioProcedureNumberUnits(item, script?.procedures);
                        add({
                          type: "callProcedure",
                          procedureId: item.id,
                          ...(item.params
                            ? {
                                args: units.map((unit) => ({
                                  type: "numericLiteral" as const,
                                  value: STUDIO_NUMBER_DEFAULTS[unit],
                                })),
                              }
                            : {}),
                        } as StudioStatement);
                      }}
                    >
                      + {copy.useBlock}: {item.name}
                    </button>
                    {otherActors.length > 0 ? (
                      <>
                        <label>
                          {copy.copyBlockTo} ({item.name})
                          <select
                            value={copyTargets[item.id] ?? otherActors[0]?.id ?? ""}
                            onChange={(event) =>
                              setCopyTargets({ ...copyTargets, [item.id]: event.target.value })
                            }
                          >
                            {otherActors.map((other) => (
                              <option key={other.id} value={other.id}>
                                {other.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className="kids-button"
                          onClick={() =>
                            authorBlock(() =>
                              copyStudioProcedure(
                                history,
                                activeActorId,
                                item.id,
                                copyTargets[item.id] ?? otherActors[0]?.id ?? "",
                              ),
                            )
                          }
                        >
                          {copy.copyBlockTo}: {item.name}
                        </button>
                      </>
                    ) : null}
                    <label>
                      {copy.renameBlock}: {item.name}
                      <input
                        type="text"
                        maxLength={STUDIO_NAME_MAX_LENGTH}
                        value={draft}
                        onChange={(event) =>
                          setBlockRenames({ ...blockRenames, [item.id]: event.target.value })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="kids-button"
                      disabled={!draft.trim() || draft.trim() === item.name}
                      onClick={() =>
                        authorBlock(() =>
                          renameStudioProcedure(history, activeActorId, item.id, draft.trim()),
                        )
                      }
                    >
                      {copy.renameBlock}
                    </button>
                    {blockToDelete === item.id ? (
                      <div role="group" aria-label={`${copy.deleteBlock}: ${item.name}`}>
                        <p>
                          {copy.blockInUse} {uses} {copy.times}.
                        </p>
                        <button
                          type="button"
                          className="kids-button"
                          onClick={() =>
                            authorBlock(() =>
                              deleteStudioProcedure(history, activeActorId, item.id, "inline"),
                            )
                          }
                        >
                          {copy.inlineAndDelete}
                        </button>
                        <button
                          type="button"
                          className="kids-button"
                          onClick={() => setBlockToDelete(null)}
                        >
                          {copy.keepBlock}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="kids-button"
                        onClick={() =>
                          uses > 0
                            ? setBlockToDelete(item.id)
                            : authorBlock(() =>
                                deleteStudioProcedure(history, activeActorId, item.id, "refuse"),
                              )
                        }
                      >
                        {copy.deleteBlock}: {item.name}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="kids-button"
              data-kids-block="if"
              onClick={() =>
                add({
                  type: "if",
                  condition: STUDIO_EDGE_CONDITION,
                  then: [{ type: "move", steps: 40 }],
                })
              }
            >
              + {copy.ifTouchEdge}
            </button>
            <button
              type="button"
              className="kids-button"
              data-kids-block="waitUntil"
              onClick={() => add({ type: "waitUntil", condition: STUDIO_EDGE_CONDITION })}
            >
              + {copy.waitUntilEdge}
            </button>
            <label>
              {copy.stop}{" "}
              <select
                aria-label={copy.stop}
                value={stopScope}
                onChange={(event) =>
                  setStopScope(event.target.value as "script" | "actor" | "scene")
                }
              >
                <option value="script">{copy.stopScript}</option>
                <option value="actor">{copy.stopActor}</option>
                <option value="scene">{copy.stopScene}</option>
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              data-kids-block="stop"
              onClick={() => add({ type: "stop", scope: stopScope })}
            >
              + {copy.stop}
            </button>
            <label>
              {copy.askChoicePrompt}{" "}
              <select
                value={choicePromptId}
                onChange={(event) => setChoicePromptId(event.target.value as ChoicePromptId)}
              >
                {CHOICE_PROMPT_IDS.map((id) => (
                  <option key={id} value={id}>
                    {CHOICE_CATALOG[id].prompt[locale]}
                  </option>
                ))}
              </select>
            </label>
            {history.current.variables?.length ? (
              <p className="kids-note">
                {copy.askChoiceVariable}:{" "}
                {history.current.variables.find((item) => item.id === selectedVariableId)?.name}
              </p>
            ) : null}
            <button
              type="button"
              className="kids-button"
              disabled={!history.current.variables?.length}
              data-kids-block="askChoice"
              onClick={() =>
                add({ type: "askChoice", promptId: choicePromptId, variableId: selectedVariableId })
              }
            >
              + {copy.askChoice}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={(script?.statements.length ?? 0) < groupCount}
              onClick={() => groupLast("if", STUDIO_EDGE_CONDITION)}
            >
              {copy.groupIfTouchEdge}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={(script?.statements.length ?? 0) < groupCount}
              data-kids-block="repeatUntil"
              onClick={() => groupLast("repeatUntil", STUDIO_EDGE_CONDITION)}
            >
              {copy.groupUntilEdge}
            </button>
            <label>
              {copy.senseKey}{" "}
              <select
                value={senseKey}
                onChange={(event) =>
                  setSenseKey(event.target.value as (typeof STUDIO_KEYS)[number])
                }
              >
                {STUDIO_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </label>
            <div role="group" aria-label={copy.heldKeys}>
              <strong>{copy.heldKeys}</strong>
              {STUDIO_KEYS.map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={heldKeys.includes(key)}
                    onChange={(event) =>
                      setHeldKeys(
                        event.target.checked
                          ? [...heldKeys, key]
                          : heldKeys.filter((item) => item !== key),
                      )
                    }
                  />{" "}
                  {key}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="kids-button"
              onClick={() =>
                add({
                  type: "if",
                  condition: { type: "keyDown", key: senseKey },
                  then: [{ type: "move", steps: 40 }],
                })
              }
            >
              + {copy.ifKeyDown}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() =>
                add({
                  type: "if",
                  condition: { type: "mouseDown" },
                  then: [{ type: "move", steps: 40 }],
                })
              }
            >
              + {copy.ifMouseDown}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={(script?.statements.length ?? 0) < groupCount}
              onClick={() => groupLast("if", { type: "keyDown", key: senseKey })}
            >
              {copy.groupIfKeyDown}
            </button>
            <label>
              {copy.timerSeconds}{" "}
              <select
                value={timerSeconds}
                onChange={(event) => setTimerSeconds(Number(event.target.value))}
              >
                {[1, 2, 3, 5, 10].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={(script?.statements.length ?? 0) < groupCount}
              onClick={() =>
                groupLast("repeatUntil", {
                  type: "greaterThan",
                  left: { type: "timer" },
                  right: { type: "numericLiteral", value: timerSeconds },
                } as Expression)
              }
            >
              {copy.groupUntilTimer}
            </button>
            <div role="group" aria-label={copy.compoundTitle} className="kids-studio-compound">
              <strong>{copy.compoundTitle}</strong>
              {(
                [
                  [copy.compoundFirst, compoundA, setCompoundA],
                  [copy.compoundSecond, compoundB, setCompoundB],
                ] as const
              ).map(([label, value, setValue], index) => (
                <label key={label}>
                  {label}{" "}
                  <select
                    value={value}
                    disabled={index === 1 && compoundJoin === "none"}
                    onChange={(event) => setValue(event.target.value as ConditionPreset)}
                  >
                    <option value="key">{copy.presetKey}</option>
                    <option value="mouse">{copy.presetMouse}</option>
                    <option value="edge">{copy.presetEdge}</option>
                    {otherActors.length > 0 ? (
                      <option value="touch">{copy.presetTouch}</option>
                    ) : null}
                    <option value="timer">{copy.presetTimer}</option>
                  </select>
                </label>
              ))}
              <label>
                {copy.compoundJoin}{" "}
                <select
                  value={compoundJoin}
                  onChange={(event) => setCompoundJoin(event.target.value as typeof compoundJoin)}
                >
                  <option value="and">{copy.compoundAnd}</option>
                  <option value="or">{copy.compoundOr}</option>
                  <option value="none">{copy.compoundNone}</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={compoundNot}
                  onChange={(event) => setCompoundNot(event.target.checked)}
                />
                {copy.compoundNot}
              </label>
              <button
                type="button"
                className="kids-button"
                data-testid="compound-if"
                disabled={compoundCondition() === null}
                onClick={() => {
                  const joined = compoundCondition();
                  if (joined)
                    add({ type: "if", condition: joined, then: [{ type: "move", steps: 40 }] });
                }}
              >
                + {copy.compoundAdd}:{" "}
                {compoundCondition()
                  ? expressionLabel(compoundCondition()!, history.current, locale)
                  : ""}{" "}
                → {copy.thenMove}
              </button>
              <button
                type="button"
                className="kids-button"
                data-testid="compound-wait-until"
                disabled={compoundCondition() === null}
                onClick={() => {
                  const joined = compoundCondition();
                  if (joined) add({ type: "waitUntil", condition: joined });
                }}
              >
                + {copy.waitUntil}:{" "}
                {compoundCondition()
                  ? expressionLabel(compoundCondition()!, history.current, locale)
                  : ""}
              </button>
              <button
                type="button"
                className="kids-button"
                disabled={
                  compoundCondition() === null || (script?.statements.length ?? 0) < groupCount
                }
                onClick={() => {
                  const joined = compoundCondition();
                  if (joined) groupLast("if", joined);
                }}
              >
                {copy.compoundGroup}
              </button>
              {oriSuggestions ? (
                <>
                  <button
                    type="button"
                    className="kids-button"
                    disabled={!script || script.statements.length >= 60}
                    onClick={askOriCompound}
                  >
                    {locale === "es"
                      ? "Pedirle a Ori una combinación"
                      : "Ask Ori for a combination"}
                  </button>
                  {compoundOri && compoundReview ? (
                    <div className="kids-ori-proposal" data-testid="ori-compound-proposal">
                      <p>{explainOriCompound(compoundOri.join, locale)}</p>
                      <p className="kids-note">
                        {locale === "es"
                          ? "Idea de Ori: todavía no está en tu programa. Revisá el bloque antes de decidir."
                          : "Ori's idea is not in your program yet. Review the block before deciding."}
                      </p>
                      <strong>
                        + {copy.compoundAdd}:{" "}
                        {expressionLabel(
                          (
                            oriCompoundStatement(compoundOri.join) as Extract<
                              Statement,
                              { type: "if" }
                            >
                          ).condition,
                          history.current,
                          locale,
                        )}{" "}
                        → {copy.thenMove}
                      </strong>
                      <div>
                        <button
                          type="button"
                          className="kids-button kids-primary"
                          onClick={() => decideOriCompound("accept")}
                        >
                          {copy.use}
                        </button>
                        <button
                          type="button"
                          className="kids-button"
                          onClick={() => decideOriCompound("change")}
                        >
                          {copy.change}
                        </button>
                        <button
                          type="button"
                          className="kids-button"
                          onClick={() => decideOriCompound("reject")}
                        >
                          {copy.reject}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
            {penEnabled ? (
              <div role="group" aria-label={copy.penTitle}>
                <strong id={studioCategoryId("pen")} tabIndex={-1}>
                  {copy.penTitle}
                </strong>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="penDown"
                  onClick={() => add({ type: "penDown" })}
                >
                  + {copy.penDown}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="penUp"
                  onClick={() => add({ type: "penUp" })}
                >
                  + {copy.penUp}
                </button>
                <label>
                  {copy.penColor}{" "}
                  <select
                    value={penColor}
                    onChange={(event) => setPenColor(event.target.value as PenColor)}
                  >
                    {PEN_COLORS.map((color) => (
                      <option key={color} value={color}>
                        {copy.penColors[color]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="setPenColor"
                  onClick={() => add({ type: "setPenColor", color: penColor })}
                >
                  + {copy.penColor}
                </button>
                <label>
                  {copy.penSize}{" "}
                  <select
                    value={penSize}
                    onChange={(event) => setPenSize(Number(event.target.value))}
                  >
                    {STUDIO_PEN_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="setPenSize"
                  onClick={() => add({ type: "setPenSize", size: penSize })}
                >
                  + {copy.penSize}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="clearPen"
                  onClick={() => add({ type: "clearPen" })}
                >
                  + {copy.clearPen}
                </button>
              </div>
            ) : null}
            {musicEnabled ? (
              <div role="group" aria-label={copy.musicTitle}>
                <strong id={studioCategoryId("music")} tabIndex={-1}>
                  {copy.musicTitle}
                </strong>
                <label>
                  {copy.noteLabel}{" "}
                  <select
                    value={musicNote}
                    onChange={(event) => setMusicNote(Number(event.target.value))}
                  >
                    {STUDIO_NOTES.map((note) => (
                      <option key={note} value={note}>
                        {noteName(note, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {copy.beatsLabel}{" "}
                  <select
                    value={musicBeats}
                    onChange={(event) => setMusicBeats(Number(event.target.value) as MusicBeats)}
                  >
                    {MUSIC_BEATS.map((beats) => (
                      <option key={beats} value={beats}>
                        {beats}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="playNote"
                  onClick={() => add({ type: "playNote", note: musicNote, beats: musicBeats })}
                >
                  + {copy.playNote}
                </button>
                <label>
                  {copy.playDrum}{" "}
                  <select
                    value={musicDrum}
                    onChange={(event) => setMusicDrum(event.target.value as MusicDrum)}
                  >
                    {MUSIC_DRUMS.map((drum) => (
                      <option key={drum} value={drum}>
                        {copy.drums[drum]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="playDrum"
                  onClick={() => add({ type: "playDrum", drum: musicDrum, beats: musicBeats })}
                >
                  + {copy.playDrum}
                </button>
                <label>
                  {copy.setInstrument}{" "}
                  <select
                    value={musicInstrument}
                    onChange={(event) => setMusicInstrument(event.target.value as MusicInstrument)}
                  >
                    {MUSIC_INSTRUMENTS.map((instrument) => (
                      <option key={instrument} value={instrument}>
                        {copy.instruments[instrument]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="setInstrument"
                  onClick={() => add({ type: "setInstrument", instrument: musicInstrument })}
                >
                  + {copy.setInstrument}
                </button>
                <label>
                  {copy.setTempo}{" "}
                  <select
                    value={musicTempo}
                    onChange={(event) => setMusicTempo(Number(event.target.value))}
                  >
                    {STUDIO_TEMPOS.map((bpm) => (
                      <option key={bpm} value={bpm}>
                        {bpm}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="setTempo"
                  onClick={() => add({ type: "setTempo", bpm: musicTempo })}
                >
                  + {copy.setTempo}
                </button>
                <label>
                  {copy.setPitch}{" "}
                  <select
                    value={musicPitch}
                    onChange={(event) => setMusicPitch(Number(event.target.value))}
                  >
                    {STUDIO_PITCHES.map((semitones) => (
                      <option key={semitones} value={semitones}>
                        {semitones}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="setPitch"
                  onClick={() => add({ type: "setPitch", semitones: musicPitch })}
                >
                  + {copy.setPitch}
                </button>
                <label>
                  {copy.setPan}{" "}
                  <select
                    value={musicPan}
                    onChange={(event) => setMusicPan(Number(event.target.value))}
                  >
                    {STUDIO_PANS.map((pan) => (
                      <option key={pan} value={pan}>
                        {pan}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="setPan"
                  onClick={() => add({ type: "setPan", pan: musicPan })}
                >
                  + {copy.setPan}
                </button>
              </div>
            ) : null}
            {targetActorId ? (
              <>
                <label>
                  {copy.touchActor}{" "}
                  <select
                    value={targetActorId}
                    onChange={(event) => setSensorTargetId(event.target.value)}
                  >
                    {otherActors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "if",
                      condition: { type: "touchingActor", actorId: targetActorId },
                      then: [{ type: "move", steps: 40 }],
                    })
                  }
                >
                  + {copy.ifTouchActor}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  disabled={(script?.statements.length ?? 0) < groupCount}
                  onClick={() => groupLast("if", { type: "touchingActor", actorId: targetActorId })}
                >
                  {copy.groupIfTouchActor}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  disabled={(script?.statements.length ?? 0) < groupCount}
                  onClick={() =>
                    groupLast("repeatUntil", { type: "touchingActor", actorId: targetActorId })
                  }
                >
                  {copy.groupUntilActor}
                </button>
              </>
            ) : null}
            <label>
              {copy.message}{" "}
              <select
                value={eventMessage}
                onChange={(event) =>
                  setEventMessage(event.target.value as (typeof STUDIO_MESSAGES)[number])
                }
              >
                {STUDIO_MESSAGES.map((message) => (
                  <option key={message} value={message}>
                    {message}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              data-kids-block="broadcast"
              onClick={() => add({ type: "broadcast", message: eventMessage })}
            >
              + {copy.message}
            </button>
            <h3 id={studioCategoryId("data")} tabIndex={-1}>
              {copy.paletteData}
            </h3>
            <label>
              {copy.dataName}{" "}
              <input
                type="text"
                maxLength={STUDIO_NAME_MAX_LENGTH}
                value={dataName}
                onChange={(event) => setDataName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={!dataName.trim() || (history.current.variables?.length ?? 0) >= 3}
              onClick={() => createData("variable")}
            >
              + {copy.newVariable}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={!dataName.trim() || (history.current.lists?.length ?? 0) >= 3}
              onClick={() => createData("list")}
            >
              + {copy.newList}
            </button>
            <label>
              {copy.number}{" "}
              <input
                type="number"
                min={-100}
                max={100}
                step={1}
                value={dataValue}
                onChange={(event) => setDataValue(Number(event.target.value))}
              />
            </label>
            {history.current.variables?.length ? (
              <>
                <label>
                  {copy.variable}{" "}
                  <select
                    value={
                      history.current.variables.some((item) => item.id === variableId)
                        ? variableId
                        : history.current.variables[0]!.id
                    }
                    onChange={(event) => setVariableId(event.target.value)}
                  >
                    {history.current.variables.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={!Number.isInteger(dataValue) || Math.abs(dataValue) > 100}
                  data-kids-block="setVariable"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId,
                      value: { type: "numericLiteral", value: dataValue },
                    })
                  }
                >
                  + {copy.setVariable}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: { type: "xPosition" },
                    })
                  }
                >
                  + {copy.saveX}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: { type: "yPosition" },
                    })
                  }
                >
                  + {copy.saveY}
                </button>
                {targetActorId ? (
                  <>
                    <label>
                      {copy.distanceTarget}{" "}
                      <select
                        value={targetActorId}
                        onChange={(event) => setSensorTargetId(event.target.value)}
                      >
                        {otherActors.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="kids-button"
                      onClick={() =>
                        add({
                          type: "setVariable",
                          variableId: selectedVariableId,
                          value: { type: "distanceToActor", actorId: targetActorId },
                        })
                      }
                    >
                      + {copy.saveDistance}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: { type: "timer" },
                    })
                  }
                >
                  + {copy.saveTimer}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: { type: "mouseX" },
                    })
                  }
                >
                  + {copy.saveMouseX}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: { type: "mouseY" },
                    })
                  }
                >
                  + {copy.saveMouseY}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  disabled={!Number.isInteger(dataValue) || Math.abs(dataValue) > 100}
                  data-kids-block="changeVariable"
                  onClick={() =>
                    add({
                      type: "changeVariable",
                      variableId,
                      delta: { type: "numericLiteral", value: dataValue },
                    })
                  }
                >
                  + {copy.changeVariable}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="showVariable"
                  onClick={() => add({ type: "showVariable", variableId: selectedVariableId })}
                >
                  + {copy.showVariable}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  data-kids-block="hideVariable"
                  onClick={() => add({ type: "hideVariable", variableId: selectedVariableId })}
                >
                  + {copy.hideVariable}
                </button>
                <label>
                  {copy.randomMin}{" "}
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step={randomDecimal ? 0.1 : 1}
                    value={randomMin}
                    onChange={(event) => setRandomMin(Number(event.target.value))}
                  />
                </label>
                <label>
                  {copy.randomMax}{" "}
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    step={randomDecimal ? 0.1 : 1}
                    value={randomMax}
                    onChange={(event) => setRandomMax(Number(event.target.value))}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={randomDecimal}
                    onChange={(event) => setRandomDecimal(event.target.checked)}
                  />
                  {copy.randomDecimal}
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    (randomDecimal
                      ? Math.abs(randomMin * 10 - Math.round(randomMin * 10)) > 1e-9 ||
                        Math.abs(randomMax * 10 - Math.round(randomMax * 10)) > 1e-9
                      : !Number.isInteger(randomMin) || !Number.isInteger(randomMax)) ||
                    Math.abs(randomMin) > 100 ||
                    Math.abs(randomMax) > 100 ||
                    randomMin > randomMax
                  }
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId,
                      value: {
                        type: randomDecimal ? "random" : "randomInteger",
                        min: { type: "numericLiteral", value: randomMin },
                        max: { type: "numericLiteral", value: randomMax },
                      },
                    })
                  }
                >
                  + {copy.setRandom}
                </button>
                <label>
                  {copy.sourceVariable}{" "}
                  <select
                    value={
                      history.current.variables.some((item) => item.id === sourceVariableId)
                        ? sourceVariableId
                        : history.current.variables[0]!.id
                    }
                    onChange={(event) => setSourceVariableId(event.target.value)}
                  >
                    {history.current.variables.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {copy.mathOperator}{" "}
                  <select
                    value={mathOperator}
                    onChange={(event) => setMathOperator(event.target.value as typeof mathOperator)}
                  >
                    <option value="add">+</option>
                    <option value="subtract">−</option>
                    <option value="multiply">×</option>
                    <option value="divide">÷</option>
                    <option value="modulo">{locale === "es" ? "resto" : "mod"}</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    !Number.isInteger(dataValue) ||
                    Math.abs(dataValue) > 100 ||
                    ((mathOperator === "divide" || mathOperator === "modulo") && dataValue === 0)
                  }
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: calculation(),
                    })
                  }
                >
                  + {copy.calculate}
                </button>
                <label>
                  {copy.mathFunction}{" "}
                  <select
                    value={mathFn}
                    onChange={(event) => setMathFn(event.target.value as typeof mathFn)}
                  >
                    <option value="abs">{copy.fnAbs}</option>
                    <option value="round">{copy.fnRound}</option>
                    <option value="floor">{copy.fnFloor}</option>
                    <option value="ceiling">{copy.fnCeiling}</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId: selectedVariableId,
                      value: {
                        type: "mathFunction",
                        function: mathFn,
                        value: { type: "variable", variableId: selectedSourceVariableId },
                      },
                    })
                  }
                >
                  + {copy.applyFunction}
                </button>
                <label>
                  {copy.compareOperator}{" "}
                  <select
                    value={compareOperator}
                    onChange={(event) =>
                      setCompareOperator(event.target.value as typeof compareOperator)
                    }
                  >
                    <option value="greaterThan">&gt;</option>
                    <option value="lessThan">&lt;</option>
                    <option value="equals">=</option>
                    <option value="lessOrEqual">&le;</option>
                    <option value="greaterOrEqual">&ge;</option>
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={compareCalculation}
                    onChange={(event) => setCompareCalculation(event.target.checked)}
                  />
                  {copy.compareCalculation}
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    !Number.isInteger(dataValue) ||
                    Math.abs(dataValue) > 100 ||
                    (compareCalculation &&
                      (mathOperator === "divide" || mathOperator === "modulo") &&
                      dataValue === 0)
                  }
                  onClick={() =>
                    add({
                      type: "if",
                      condition: condition(),
                      then: [{ type: "move", steps: 40 }],
                    })
                  }
                >
                  + {copy.ifLabel} {expressionLabel(condition(), history.current)} → {copy.thenMove}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    (script?.statements.length ?? 0) < groupCount ||
                    !Number.isInteger(dataValue) ||
                    Math.abs(dataValue) > 100 ||
                    (compareCalculation &&
                      (mathOperator === "divide" || mathOperator === "modulo") &&
                      dataValue === 0)
                  }
                  onClick={() => groupLast("if")}
                >
                  {copy.groupIf}
                </button>
              </>
            ) : null}
            {history.current.lists?.length ? (
              <>
                <label>
                  {copy.list}{" "}
                  <select
                    value={
                      history.current.lists.some((item) => item.id === listId)
                        ? listId
                        : history.current.lists[0]!.id
                    }
                    onChange={(event) => setListId(event.target.value)}
                  >
                    {history.current.lists.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={!Number.isInteger(dataValue) || Math.abs(dataValue) > 100}
                  data-kids-block="listAdd"
                  onClick={() =>
                    add({
                      type: "listAdd",
                      listId,
                      value: { type: "numericLiteral", value: dataValue },
                    })
                  }
                >
                  + {copy.listAdd}
                </button>
                <label>
                  {copy.listIndex}{" "}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={listIndex}
                    onChange={(event) => setListIndex(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={!Number.isInteger(listIndex) || listIndex < 1 || listIndex > 10}
                  data-kids-block="listRemoveAt"
                  onClick={() =>
                    add({
                      type: "listRemoveAt",
                      listId,
                      index: { type: "numericLiteral", value: listIndex },
                    })
                  }
                >
                  + {copy.listRemove}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    !Number.isInteger(listIndex) ||
                    listIndex < 1 ||
                    listIndex > 10 ||
                    !Number.isInteger(dataValue) ||
                    Math.abs(dataValue) > 100
                  }
                  data-kids-block="listInsertAt"
                  onClick={() =>
                    add({
                      type: "listInsertAt",
                      listId,
                      index: { type: "numericLiteral", value: listIndex },
                      value: { type: "numericLiteral", value: dataValue },
                    })
                  }
                >
                  + {copy.listInsert}
                </button>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    !Number.isInteger(listIndex) ||
                    listIndex < 1 ||
                    listIndex > 10 ||
                    !Number.isInteger(dataValue) ||
                    Math.abs(dataValue) > 100
                  }
                  data-kids-block="listReplaceAt"
                  onClick={() =>
                    add({
                      type: "listReplaceAt",
                      listId,
                      index: { type: "numericLiteral", value: listIndex },
                      value: { type: "numericLiteral", value: dataValue },
                    })
                  }
                >
                  + {copy.listReplace}
                </button>
                {history.current.variables?.length ? (
                  <>
                    <button
                      type="button"
                      className="kids-button"
                      disabled={!Number.isInteger(listIndex) || listIndex < 1 || listIndex > 10}
                      onClick={() =>
                        add({
                          type: "setVariable",
                          variableId,
                          value: {
                            type: "listItem",
                            listId,
                            index: { type: "numericLiteral", value: listIndex },
                          },
                        })
                      }
                    >
                      + {copy.listRead}
                    </button>
                    <button
                      type="button"
                      className="kids-button"
                      onClick={() =>
                        add({
                          type: "setVariable",
                          variableId,
                          value: { type: "listLength", listId },
                        })
                      }
                    >
                      + {copy.listLength}
                    </button>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
          {oriSuggestions ? (
            <div className="kids-studio-ori">
              <div className="kids-ori-stage">
                <KidsSprite slot="ori" expression={oriExpression} talking={Boolean(oriIdea)} />
              </div>
              <button
                type="button"
                className="kids-button kids-ori-action"
                data-ori-state={oriMotion}
                data-ori-paused={!oriPageVisible}
                disabled={oriBusy}
                onClick={() => void askOri()}
              >
                <span aria-hidden="true">
                  <OriFace expression={oriExpression} />
                </span>
                <span>{copy.idea}</span>
              </button>
              <StudioIntentPicker
                locale={locale}
                intents={ORI_STUDIO_INTENTS.filter(
                  (intent) =>
                    oriIntentsWithin({
                      ...pacedPolicy,
                      maxProposalBlocks: Math.min(
                        pacedPolicy.maxProposalBlocks,
                        ageBand ? bandProfile(ageBand).oriMaxBlocks : 8,
                      ),
                    }).includes(intent) &&
                    (musicEnabled || !["melody", "rhythm", "cheer"].includes(intent)),
                )}
                disabled={oriBusy}
                onPick={startIntent}
              />
              {intentPlan ? (
                <div className="kids-ori-proposal" data-testid="intent-card">
                  <p>
                    {locale === "es"
                      ? `Ori propone ${intentPlan.statements.length} bloques para lo que querés lograr.`
                      : `Ori suggests ${intentPlan.statements.length} blocks for your goal.`}
                  </p>
                  {intentPlan.preview ? (
                    <p className="kids-note" data-testid="ori-evidence">
                      {copy.evidenceNow} ({intentPlan.preview.from.x}, {intentPlan.preview.from.y})
                      · {intentPlan.preview.stepsBefore} {copy.evidenceBlocks}. {copy.evidenceWith}{" "}
                      ({intentPlan.preview.to.x}, {intentPlan.preview.to.y}) ·{" "}
                      {intentPlan.preview.stepsAfter} {copy.evidenceBlocks}.
                      {intentPlan.preview.outcome !== "completed" ? ` ${copy.evidenceStops}` : ""}
                    </p>
                  ) : null}
                  <div>
                    {intentPlan.statements.some((statement) =>
                      ["playSound", "playNote", "playDrum"].includes(statement.type),
                    ) ? (
                      <button type="button" className="kids-button" onClick={listenToIdea}>
                        {locale === "es" ? "Escuchar la idea" : "Listen to the idea"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="kids-button kids-primary"
                      onClick={() => decideIntent("accept")}
                    >
                      {copy.use}
                    </button>
                    <button
                      type="button"
                      className="kids-button"
                      onClick={() => decideIntent("reject")}
                    >
                      {copy.reject}
                    </button>
                  </div>
                </div>
              ) : null}
              {!oriBusy && oriMessage && !oriIdea ? (
                <p role="status" className="kids-note">
                  {oriMessage}
                </p>
              ) : null}
              {oriBusy ? (
                <p role="status" className="kids-note">
                  {locale === "es" ? "Ori está pensando..." : "Ori is thinking..."}
                </p>
              ) : null}
              {oriIdea ? (
                <div className="kids-ori-proposal">
                  <p>{oriMessage || copy.ideaText}</p>
                  {oriPreview ? (
                    <p className="kids-note" data-testid="ori-evidence">
                      {copy.evidenceNow} ({oriPreview.from.x}, {oriPreview.from.y}) ·{" "}
                      {oriPreview.stepsBefore} {copy.evidenceBlocks}. {copy.evidenceWith} (
                      {oriPreview.to.x}, {oriPreview.to.y}) · {oriPreview.stepsAfter}{" "}
                      {copy.evidenceBlocks}.
                      {oriPreview.outcome !== "completed" ? ` ${copy.evidenceStops}` : ""}
                    </p>
                  ) : null}
                  <strong>
                    {proposedStatement?.type === "move"
                      ? `+ ${copy.move} ${proposedStatement.steps / 40}`
                      : proposedStatement?.type === "turn"
                        ? `+ ${proposedStatement.degrees < 0 ? copy.turnLeft : copy.turnRight}`
                        : proposedStatement?.type === "callProcedure"
                          ? `+ ${blockLabel(proposedStatement)}`
                          : ""}
                  </strong>
                  <div>
                    <button
                      type="button"
                      className="kids-button kids-primary"
                      onClick={() => decideOri("accept")}
                    >
                      {copy.use}
                    </button>
                    {canChangeIdea ? (
                      <button
                        type="button"
                        className="kids-button"
                        onClick={() => decideOri("change")}
                      >
                        {copy.change}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="kids-button"
                      onClick={() => decideOri("reject")}
                    >
                      {copy.reject}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <h2>{copy.code}</h2>
          <div className="kids-code-languages" role="group" aria-label={copy.code}>
            {codeTabs.map((tab) => {
              const item = tab === "node" ? "typescript" : tab;
              return (
                <button
                  type="button"
                  key={tab}
                  aria-pressed={shownLanguage === item}
                  onClick={() => setLanguage(item)}
                >
                  {item === "agorix"
                    ? "Agorix Code"
                    : item === "python"
                      ? "Python"
                      : item === "java"
                        ? "Java"
                        : "TypeScript"}
                </button>
              );
            })}
            {ageBand === "6-8" ? (
              <button
                type="button"
                aria-expanded={showMoreLanguages}
                onClick={() => setShowMoreLanguages(!showMoreLanguages)}
              >
                {showMoreLanguages ? copy.fewerLanguages : copy.moreLanguages}
              </button>
            ) : null}
          </div>
          <pre className="kids-code-strip" tabIndex={0} aria-label={copy.code}>
            {currentLine ? (
              <>
                {code.slice(0, currentLine.start)}
                <mark className="kids-code-current" data-testid="code-current">
                  {code.slice(currentLine.start, currentLine.end)}
                </mark>
                {code.slice(currentLine.end)}
              </>
            ) : (
              code
            )}
          </pre>
        </div>
      </div>
      {error ? (
        <p role="alert" className="kids-note">
          {copy.saveError}
        </p>
      ) : null}
      {exportingMedia ? (
        <ExportMediaDialog
          locale={locale}
          onConfirm={() => {
            downloadScene(true);
            setExportingMedia(false);
          }}
          onCancel={() => setExportingMedia(false)}
        />
      ) : null}
    </section>
  );
}
