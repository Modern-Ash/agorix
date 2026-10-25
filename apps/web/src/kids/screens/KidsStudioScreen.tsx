import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from "react";
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
import { ProjectStore } from "@agorix/persistence";
import { runMultiActorProgram, type MultiActorRunResult, type RuntimeEvent } from "@agorix/runtime";
import {
  acceptProposal,
  modifyProposal,
  rejectProposal,
  type ProgramProposal,
} from "@agorix/proposals";
import { validateOriStudioProposal } from "@agorix/ori-agent";
import type { Expression, ProjectProgram, Statement } from "@agorix/program-model";
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
import {
  addStudioActor,
  addStudioList,
  addStudioVariable,
  STUDIO_EDGE_CONDITION,
  appendStudioStatement,
  creativeForStudio,
  removeStudioStatement,
  setStudioTrigger,
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
  selectStudioArt,
  updateStudioArt,
} from "../kidsStudioProjects.js";
import { requestStudioOri } from "../kidsStudioOriRemote.js";
import { useOriPageVisible } from "../kidsOriMotion.js";
import { KidsBackdrop, KidsSprite } from "./KidsArt.js";
import { KidsDrawArt } from "./KidsDrawArt.js";

interface Props {
  readonly id: string;
  readonly locale: Locale;
  readonly onBack: () => void;
  readonly oriSuggestions: boolean;
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
    growShrink: "Cambiar tamaño",
    groupUntilEdge: "Repetir hasta tocar el borde",
    groupUntilActor: "Repetir hasta tocar al personaje",
    saveDistance: "Guardar distancia",
    distanceTarget: "Distancia al personaje",
    dataName: "Nombre",
    number: "Número",
    watchers: "Datos al jugar",
    paletteLooks: "Apariencia y tiempo",
    paletteMotion: "Movimiento",
    paletteMedia: "Disfraces, fondos y sonidos",
    paletteLogic: "Eventos y control",
    paletteData: "Variables y listas",
    event: "Cuando",
    onPlay: "Al jugar",
    onTap: "Al tocar este personaje",
    tapHint: "Tocá el personaje en el escenario después de Jugar.",
    remove: "Quitar bloque",
    undo: "Deshacer",
    redo: "Rehacer",
    code: "Código",
    idea: "Pedirle una idea a Ori",
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
    growShrink: "Change size",
    groupUntilEdge: "Repeat until at the edge",
    groupUntilActor: "Repeat until touching the character",
    saveDistance: "Save distance",
    distanceTarget: "Distance to character",
    dataName: "Name",
    number: "Number",
    watchers: "Data after Play",
    paletteLooks: "Looks and time",
    paletteMotion: "Motion",
    paletteMedia: "Costumes, backdrops and sounds",
    paletteLogic: "Events and control",
    paletteData: "Variables and lists",
    event: "When",
    onPlay: "When played",
    onTap: "When this character is tapped",
    tapHint: "Tap the character on the stage after Play.",
    remove: "Remove block",
    undo: "Undo",
    redo: "Redo",
    code: "Code",
    idea: "Ask Ori for an idea",
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
  if (value.type === "randomInteger")
    return `🎲(${expressionLabel(value.min, program)}, ${expressionLabel(value.max, program)})`;
  const operators: Partial<Record<Expression["type"], string>> = {
    add: "+",
    subtract: "−",
    multiply: "×",
    divide: "÷",
    modulo: "mod",
    greaterThan: ">",
    lessThan: "<",
    equals: "=",
  };
  if ("left" in value && "right" in value && operators[value.type])
    return `(${expressionLabel(value.left, program)} ${operators[value.type]} ${expressionLabel(value.right, program)})`;
  return "?";
}

function characterOfActor(id: string): KidsGalleryCharacterId {
  const suffix = id.split("-").at(-1);
  return isGalleryCharacterId(suffix) ? suffix : "nova";
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

export function KidsStudioScreen({ id, locale, onBack, oriSuggestions }: Props) {
  const copy = COPY[locale];
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
  const [waitSeconds, setWaitSeconds] = useState(1);
  const [volume, setVolume] = useState(100);
  const [volumeChange, setVolumeChange] = useState(-10);
  const [eventKey, setEventKey] = useState<(typeof STUDIO_KEYS)[number]>("Space");
  const [eventMessage, setEventMessage] = useState<(typeof STUDIO_MESSAGES)[number]>("vamos");
  const [repeatCount, setRepeatCount] = useState(3);
  const [groupCount, setGroupCount] = useState(2);
  const [sourceVariableId, setSourceVariableId] = useState("studio-var-1");
  const [mathOperator, setMathOperator] = useState<
    "add" | "subtract" | "multiply" | "divide" | "modulo"
  >("add");
  const [compareOperator, setCompareOperator] = useState<"greaterThan" | "lessThan" | "equals">(
    "greaterThan",
  );
  const [compareCalculation, setCompareCalculation] = useState(false);
  const [sensorTargetId, setSensorTargetId] = useState("");
  const [dataName, setDataName] = useState("");
  const [dataValue, setDataValue] = useState(1);
  const [mathFn, setMathFn] = useState<"abs" | "round" | "floor" | "ceiling">("round");
  const [variableId, setVariableId] = useState("studio-var-1");
  const [listId, setListId] = useState("studio-list-1");
  const [listIndex, setListIndex] = useState(1);
  const [randomMin, setRandomMin] = useState(1);
  const [randomMax, setRandomMax] = useState(6);
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [events, setEvents] = useState<readonly RuntimeEvent[]>([{ type: "start" }]);
  const [frame, setFrame] = useState<number | null>(null);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [oriIdea, setOriIdea] = useState<ProgramProposal | null>(null);
  const [oriMessage, setOriMessage] = useState("");
  const [oriBusy, setOriBusy] = useState(false);
  const oriPageVisible = useOriPageVisible();
  const [error, setError] = useState(false);
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
  const proposedStatement =
    proposedOperation?.type === "appendStatement" ? proposedOperation.statement : null;
  const oriMotion = oriBusy
    ? "thinking"
    : oriIdea
      ? "proposal"
      : oriMessage
        ? "fallback"
        : run
          ? "observing"
          : "idle";
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
  const code =
    language === "python"
      ? projectPython(history.current).text
      : language === "typescript"
        ? projectProgram(history.current).code
        : projectAgorixCode(history.current).text;

  function fireKey(key: string) {
    if (!run || !STUDIO_KEYS.includes(key as (typeof STUDIO_KEYS)[number])) return;
    const nextEvents: readonly RuntimeEvent[] = [...events, { type: "keyPressed", key }];
    setRun(runMultiActorProgram(history.current, creative, { events: nextEvents }));
    setEvents(nextEvents);
    setFrame(null);
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
      setOriMessage("");
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

  function blockLabel(statement: Statement): string {
    switch (statement.type) {
      case "move":
        return `${statement.steps < 0 ? copy.moveBackward : copy.move} ${Math.abs(statement.steps) / 40}`;
      case "goTo":
        return `${copy.goTo}: ${statement.x}, ${statement.y}`;
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
      case "repeatUntil":
        return `${copy.repeatUntil} ${expressionLabel(statement.condition, history.current, locale)}`;
      case "if":
        return `${copy.ifLabel} ${expressionLabel(statement.condition, history.current, locale)}`;
      default:
        return "";
    }
  }

  function nestedBlocks(statements: readonly Statement[], key: string) {
    return (
      <ol className="kids-studio-nested-blocks">
        {statements.map((item, index) => (
          <li key={`${key}-${index}`}>
            {blockLabel(item)}
            {item.type === "repeat" || item.type === "repeatUntil"
              ? nestedBlocks(item.body, `${key}-${index}`)
              : null}
            {item.type === "if" ? nestedBlocks(item.then, `${key}-${index}`) : null}
            {item.type === "if" && item.else ? (
              <>
                <strong>{copy.elseLabel}</strong>
                {nestedBlocks(item.else, `${key}-${index}-else`)}
              </>
            ) : null}
          </li>
        ))}
      </ol>
    );
  }

  function groupLast(type: "repeat" | "repeatUntil" | "if", overrideCondition?: Expression) {
    try {
      persist(
        wrapStudioTail(
          history,
          activeActorId,
          groupCount,
          type === "repeat"
            ? { type, times: repeatCount as 2 | 3 | 5 }
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

  function play() {
    try {
      const result = runMultiActorProgram(history.current, creative);
      setRun(result);
      setEvents([{ type: "start" }]);
      setFrame(null);
      stopKidsSounds();
      let soundsPlayed = 0;
      for (const entry of result.trace) {
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
    setRun(runMultiActorProgram(history.current, creative, { events: nextEvents }));
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
      if (decision === "accept") {
        persist(
          recordCanonicalTransaction(history, {
            label: "Ori studio idea",
            after: acceptProposal(history.current, review).program,
          }).history,
        );
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

  return (
    <section className="kids-screen kids-studio" aria-label={copy.title}>
      <header className="kids-studio-header">
        <button type="button" className="kids-button" onClick={onBack}>
          {copy.back}
        </button>
        <h1>{copy.title}</h1>
        <div>
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
      <div className="kids-studio-layout">
        <div className="kids-studio-stage-column">
          <h2>{copy.stage}</h2>
          <KidsBackdrop
            world={{ kind: "gallery", id: stageBackdrop }}
            imageOverride={stageArt}
            className="kids-studio-stage"
            role="group"
            label={copy.stage}
          >
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
          <div className="kids-run-controls">
            <button type="button" className="kids-button kids-primary" onClick={play}>
              {copy.run}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={!run || (frame !== null && frame >= run.frames.length - 1)}
              onClick={() => setFrame(frame === null ? 0 : frame + 1)}
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
            <ol>
              {script?.statements.map((statement, index) => (
                <li key={`${script.id}-${index}`} className="kids-program-block">
                  <span>{blockLabel(statement)}</span>
                  {statement.type === "repeat" || statement.type === "repeatUntil"
                    ? nestedBlocks(statement.body, `${script.id}-${index}`)
                    : null}
                  {statement.type === "if"
                    ? nestedBlocks(statement.then, `${script.id}-${index}`)
                    : null}
                  {statement.type === "if" && statement.else ? (
                    <>
                      <strong>{copy.elseLabel}</strong>
                      {nestedBlocks(statement.else, `${script.id}-${index}-else`)}
                    </>
                  ) : null}
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
            </ol>
            {script?.statements.length === 0 ? <p className="kids-note">{copy.noBlocks}</p> : null}
          </div>
          <div className="kids-studio-palette">
            <h3>{copy.paletteLooks}</h3>
            <label>
              {copy.say} / {copy.think}
              <input
                type="text"
                maxLength={80}
                value={bubbleText}
                onChange={(event) => setBubbleText(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={!bubbleText.trim()}
              onClick={() => add({ type: "say", text: bubbleText.trim() })}
            >
              + {copy.say}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={!bubbleText.trim()}
              onClick={() => add({ type: "think", text: bubbleText.trim() })}
            >
              + {copy.think}
            </button>
            <button type="button" className="kids-button" onClick={() => add({ type: "show" })}>
              + {copy.show}
            </button>
            <button type="button" className="kids-button" onClick={() => add({ type: "hide" })}>
              + {copy.hide}
            </button>
            <label>
              {copy.size}{" "}
              <select
                value={spriteSize}
                onChange={(event) => setSpriteSize(Number(event.target.value))}
              >
                {[50, 75, 100, 125, 150].map((size) => (
                  <option key={size} value={size}>
                    {size}%
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "setSize", size: spriteSize })}
            >
              + {copy.size}
            </button>
            <label>
              {copy.growShrink}{" "}
              <select
                value={sizeDelta}
                onChange={(event) => setSizeDelta(Number(event.target.value))}
              >
                {[-50, -25, 25, 50].map((delta) => (
                  <option key={delta} value={delta}>
                    {delta > 0 ? "+" : ""}
                    {delta}%
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "changeSize", delta: sizeDelta })}
            >
              + {copy.growShrink}
            </button>
            <label>
              {copy.wait}{" "}
              <select
                value={waitSeconds}
                onChange={(event) => setWaitSeconds(Number(event.target.value))}
              >
                {[0.5, 1, 2, 3].map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "wait", seconds: waitSeconds })}
            >
              + {copy.wait}
            </button>
            <h3>{copy.paletteMotion}</h3>
            <label>
              {copy.move}{" "}
              <select
                value={moveCells}
                onChange={(event) => setMoveCells(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "move", steps: moveCells * 40 })}
            >
              + {copy.move}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "move", steps: -moveCells * 40 })}
            >
              + {copy.moveBackward}
            </button>
            <label>
              {copy.xCoordinate}{" "}
              <input
                type="number"
                min={0}
                max={320}
                step={1}
                value={targetX}
                onChange={(event) => setTargetX(Number(event.target.value))}
              />
            </label>
            <label>
              {copy.yCoordinate}{" "}
              <input
                type="number"
                min={-100}
                max={120}
                step={1}
                value={targetY}
                onChange={(event) => setTargetY(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={
                !Number.isInteger(targetX) ||
                targetX < 0 ||
                targetX > 320 ||
                !Number.isInteger(targetY) ||
                targetY < -100 ||
                targetY > 120
              }
              onClick={() => add({ type: "goTo", x: targetX, y: targetY })}
            >
              + {copy.goTo}
            </button>
            <label>
              {copy.turnAmount}{" "}
              <select
                value={turnAmount}
                onChange={(event) => setTurnAmount(Number(event.target.value))}
              >
                {[45, 90, 180].map((degrees) => (
                  <option key={degrees} value={degrees}>
                    {degrees}°
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "turn", degrees: -turnAmount })}
            >
              + {copy.turnLeft}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "turn", degrees: turnAmount })}
            >
              + {copy.turnRight}
            </button>
            <label>
              {copy.pointDirection}{" "}
              <select
                value={pointDegrees}
                onChange={(event) => setPointDegrees(Number(event.target.value))}
              >
                {directionOptions.map((item) => (
                  <option key={item.degrees} value={item.degrees}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "pointInDirection", degrees: pointDegrees })}
            >
              + {copy.pointDirection}
            </button>
            {pointTarget ? (
              <>
                <label>
                  {copy.pointTowards}{" "}
                  <select
                    value={pointTarget.id}
                    onChange={(event) => setPointTargetId(event.target.value)}
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
                  onClick={() => add({ type: "pointTowards", actorId: pointTarget.id })}
                >
                  + {copy.pointTowards}
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "bounceOnEdge" })}
            >
              + {copy.bounceOnEdge}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "goToLayer", layer: "front" })}
            >
              + {copy.layerFront}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "goToLayer", layer: "back" })}
            >
              + {copy.layerBack}
            </button>
            <h3>{copy.paletteMedia}</h3>
            <label>
              {copy.costume}{" "}
              <select
                value={newCostume}
                onChange={(event) => setNewCostume(event.target.value as KidsGalleryCharacterId)}
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
              onClick={() => add({ type: "switchCostume", costumeId: `costume:${newCostume}` })}
            >
              + {copy.costume}
            </button>
            <label>
              {copy.switchBackdrop}{" "}
              <select
                value={newBackdrop}
                onChange={(event) => setNewBackdrop(event.target.value as KidsGalleryBackdropId)}
              >
                {KIDS_GALLERY_BACKDROPS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {galleryBackdropName(item.id, locale)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "switchBackdrop", backdropId: `backdrop:${newBackdrop}` })}
            >
              + {copy.switchBackdrop}
            </button>
            <label>
              {copy.sound}{" "}
              <select
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
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() =>
                void playKidsSound(newSound, {
                  kind: "gallery",
                  id: characterOfActor(activeActorId),
                })
              }
            >
              ▶ {copy.sound}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "playSound", soundId: newSound })}
            >
              + {copy.sound}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "stopSounds" })}
            >
              + {copy.stopSounds}
            </button>
            <label>
              {copy.volume}{" "}
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={!Number.isInteger(volume) || volume < 0 || volume > 100}
              onClick={() => add({ type: "setVolume", volume })}
            >
              + {copy.setVolume}
            </button>
            <label>
              {copy.volumeChange}{" "}
              <input
                type="number"
                min={-100}
                max={100}
                step={1}
                value={volumeChange}
                onChange={(event) => setVolumeChange(Number(event.target.value))}
              />
            </label>
            <button
              type="button"
              className="kids-button"
              disabled={!Number.isInteger(volumeChange) || Math.abs(volumeChange) > 100}
              onClick={() => add({ type: "changeVolume", delta: volumeChange })}
            >
              + {copy.changeVolume}
            </button>
            <h3>{copy.paletteLogic}</h3>
            <label>
              {copy.repeat}{" "}
              <select
                value={repeatCount}
                onChange={(event) => setRepeatCount(Number(event.target.value))}
              >
                {[2, 3, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="kids-button"
              onClick={() =>
                add({ type: "repeat", count: repeatCount, body: [{ type: "move", steps: 40 }] })
              }
            >
              + {copy.repeat} → {copy.thenMove}
            </button>
            <label>
              {copy.groupCount}{" "}
              <select
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
            <button
              type="button"
              className="kids-button"
              disabled={(script?.statements.length ?? 0) < groupCount}
              onClick={() => groupLast("repeat")}
            >
              {copy.groupRepeat}
            </button>
            <button
              type="button"
              className="kids-button"
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
              disabled={(script?.statements.length ?? 0) < groupCount}
              onClick={() => groupLast("if", STUDIO_EDGE_CONDITION)}
            >
              {copy.groupIfTouchEdge}
            </button>
            <button
              type="button"
              className="kids-button"
              disabled={(script?.statements.length ?? 0) < groupCount}
              onClick={() => groupLast("repeatUntil", STUDIO_EDGE_CONDITION)}
            >
              {copy.groupUntilEdge}
            </button>
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
              onClick={() => add({ type: "broadcast", message: eventMessage })}
            >
              + {copy.message}
            </button>
            <h3>{copy.paletteData}</h3>
            <label>
              {copy.dataName}{" "}
              <input
                type="text"
                maxLength={20}
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
                  disabled={!Number.isInteger(dataValue) || Math.abs(dataValue) > 100}
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
                  onClick={() => add({ type: "showVariable", variableId: selectedVariableId })}
                >
                  + {copy.showVariable}
                </button>
                <button
                  type="button"
                  className="kids-button"
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
                    step={1}
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
                    step={1}
                    value={randomMax}
                    onChange={(event) => setRandomMax(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="kids-button"
                  disabled={
                    !Number.isInteger(randomMin) ||
                    !Number.isInteger(randomMax) ||
                    Math.abs(randomMin) > 100 ||
                    Math.abs(randomMax) > 100 ||
                    randomMin > randomMax
                  }
                  onClick={() =>
                    add({
                      type: "setVariable",
                      variableId,
                      value: {
                        type: "randomInteger",
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
              <button
                type="button"
                className="kids-button kids-ori-action"
                data-ori-state={oriMotion}
                data-ori-paused={!oriPageVisible}
                disabled={oriBusy}
                onClick={() => void askOri()}
              >
                <KidsSprite slot="ori" />
                <span>{copy.idea}</span>
              </button>
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
                  <strong>
                    {proposedStatement?.type === "move"
                      ? `+ ${copy.move} ${proposedStatement.steps / 40}`
                      : proposedStatement?.type === "turn"
                        ? `+ ${proposedStatement.degrees < 0 ? copy.turnLeft : copy.turnRight}`
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
                    <button
                      type="button"
                      className="kids-button"
                      onClick={() => decideOri("change")}
                    >
                      {copy.change}
                    </button>
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
            {(["agorix", "python", "typescript"] as const).map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={language === item}
                onClick={() => setLanguage(item)}
              >
                {item === "agorix" ? "Agorix Code" : item === "python" ? "Python" : "TypeScript"}
              </button>
            ))}
          </div>
          <pre className="kids-code-strip" tabIndex={0} aria-label={copy.code}>
            {code}
          </pre>
        </div>
      </div>
      {error ? (
        <p role="alert" className="kids-note">
          {copy.saveError}
        </p>
      ) : null}
    </section>
  );
}
