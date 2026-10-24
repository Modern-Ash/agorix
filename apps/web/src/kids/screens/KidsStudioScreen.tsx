import { useEffect, useMemo, useRef, useState } from "react";
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
import { playKidsSound } from "../kidsSoundPlayer.js";
import {
  addStudioActor,
  addStudioList,
  addStudioVariable,
  appendStudioStatement,
  creativeForStudio,
  removeStudioStatement,
  setStudioTrigger,
  studioActorId,
  type StudioStatement,
} from "../kidsStudioModel.js";
import { listStudioProjects, saveStudioProject, setStudioBackdrop } from "../kidsStudioProjects.js";
import { requestStudioOri } from "../kidsStudioOriRemote.js";
import { useOriPageVisible } from "../kidsOriMotion.js";
import { KidsBackdrop, KidsSprite } from "./KidsArt.js";

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
    turnLeft: "Girar a la izquierda",
    turnRight: "Girar a la derecha",
    costume: "Cambiar disfraz",
    switchBackdrop: "Cambiar fondo",
    sound: "Sonar",
    say: "Decir",
    think: "Pensar",
    show: "Mostrar",
    hide: "Esconder",
    size: "Tamaño",
    wait: "Esperar",
    repeat: "Repetir",
    ifScore: "Si variable >",
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
    listAdd: "Agregar número",
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
    saveError: "No pudimos guardar esta escena. Probá de nuevo.",
    chooseActor: "Elegí un personaje",
    noBlocks: "Agregá un bloque para ver qué hace este personaje.",
    stage: "Escenario",
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
    turnLeft: "Turn left",
    turnRight: "Turn right",
    costume: "Switch costume",
    switchBackdrop: "Switch backdrop",
    sound: "Sound",
    say: "Say",
    think: "Think",
    show: "Show",
    hide: "Hide",
    size: "Size",
    wait: "Wait",
    repeat: "Repeat",
    ifScore: "If variable >",
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
    listAdd: "Add number",
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
    saveError: "We couldn't save this scene. Try again.",
    chooseActor: "Choose a character",
    noBlocks: "Add a block to see what this character does.",
    stage: "Stage",
  },
} as const;

const STUDIO_KEYS = ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"] as const;
const STUDIO_MESSAGES = ["hola", "vamos", "listo"] as const;
type StudioEvent = "greenFlag" | "onActorClicked" | "onKeyPressed" | "onMessage";

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
  const [bubbleText, setBubbleText] = useState(locale === "es" ? "¡Hola!" : "Hello!");
  const [spriteSize, setSpriteSize] = useState(100);
  const [waitSeconds, setWaitSeconds] = useState(1);
  const [eventKey, setEventKey] = useState<(typeof STUDIO_KEYS)[number]>("Space");
  const [eventMessage, setEventMessage] = useState<(typeof STUDIO_MESSAGES)[number]>("vamos");
  const [repeatCount, setRepeatCount] = useState(3);
  const [dataName, setDataName] = useState("");
  const [dataValue, setDataValue] = useState(1);
  const [variableId, setVariableId] = useState("studio-var-1");
  const [listId, setListId] = useState("studio-list-1");
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [events, setEvents] = useState<readonly RuntimeEvent[]>([{ type: "start" }]);
  const [frame, setFrame] = useState<number | null>(null);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [oriIdea, setOriIdea] = useState<ProgramProposal | null>(null);
  const [oriMessage, setOriMessage] = useState("");
  const [oriBusy, setOriBusy] = useState(false);
  const oriPageVisible = useOriPageVisible();
  const [error, setError] = useState(false);
  const creative = useMemo(
    () => creativeForStudio(history.current, backdropId, locale),
    [history.current, backdropId, locale],
  );
  const actor = creative.actors?.find((item) => item.id === activeActorId) ?? creative.actors?.[0];
  const script = history.current.scripts.find((item) => actor?.scripts?.includes(item.id));
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
  const shownStage = selectedFrame?.stage ?? run?.stage ?? creative.stage;
  const stageBackdrop = backdropOfStage(shownStage?.backdropId, backdropId);
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
      for (const entry of result.trace
        .filter((item) => item.statementType === "playSound")
        .slice(0, 4)) {
        const owner = creative.actors?.find((item) => item.id === entry.actorId);
        if (owner)
          void playKidsSound(entry.worldAfter.sounds?.activeSoundIds.at(-1) ?? "kids:pop", {
            kind: "gallery",
            id: characterOfActor(owner.id),
          });
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
              const x = final?.world.sprite.x ?? item.x;
              const y = final?.world.sprite.y ?? item.y;
              const sprite = final?.world.sprite;
              if (sprite?.visible === false) return null;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="kids-studio-stage-actor"
                  style={{
                    left: `${Math.max(4, Math.min(90, 8 + x / 4))}%`,
                    top: `${Math.max(8, Math.min(82, 40 + y / 3))}%`,
                  }}
                  aria-label={`${copy.chooseActor}: ${item.name} ${item.id}`}
                  aria-pressed={activeActorId === item.id}
                  onClick={() => tapActor(item.id)}
                >
                  <span
                    className="kids-studio-stage-costume"
                    style={{ transform: `scale(${(sprite?.size ?? 100) / 100})` }}
                  >
                    <KidsSprite slot={{ kind: "gallery", id: characterId }} label={item.name} />
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
          {history.current.variables?.length || history.current.lists?.length ? (
            <div className="kids-studio-watchers" aria-label={copy.watchers}>
              <h3>{copy.watchers}</h3>
              {history.current.variables?.map((item) => (
                <p key={item.id}>
                  {item.name}:{" "}
                  {shownActors?.find((entry) => entry.id === activeActorId)?.world.variables?.[
                    item.id
                  ]?.value ?? item.initialValue}
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
                  <span>
                    {statement.type === "move"
                      ? `${copy.move} ${statement.steps / 40}`
                      : statement.type === "turn"
                        ? statement.degrees < 0
                          ? copy.turnLeft
                          : copy.turnRight
                        : statement.type === "switchCostume"
                          ? `${copy.costume}: ${galleryCharacterName(characterOfCostume(statement.costumeId, "nova"), locale)}`
                          : statement.type === "switchBackdrop"
                            ? `${copy.switchBackdrop}: ${galleryBackdropName(backdropOfStage(statement.backdropId, backdropId), locale)}`
                            : statement.type === "playSound"
                              ? `${copy.sound}: ${KIDS_SOUNDS.find((item) => item.id === statement.soundId)?.[locale] ?? ""}`
                              : statement.type === "say" || statement.type === "think"
                                ? `${statement.type === "say" ? copy.say : copy.think}: ${statement.text}`
                                : statement.type === "show"
                                  ? copy.show
                                  : statement.type === "hide"
                                    ? copy.hide
                                    : statement.type === "setSize"
                                      ? `${copy.size}: ${statement.size}%`
                                      : statement.type === "wait"
                                        ? `${copy.wait}: ${statement.seconds}s`
                                        : statement.type === "broadcast"
                                          ? `${copy.message}: ${statement.message}`
                                          : statement.type === "setVariable" ||
                                              statement.type === "changeVariable"
                                            ? `${statement.type === "setVariable" ? copy.setVariable : copy.changeVariable}: ${history.current.variables?.find((item) => item.id === statement.variableId)?.name} ${statement.type === "setVariable" ? (statement.value.type === "numericLiteral" ? statement.value.value : "") : statement.delta.type === "numericLiteral" ? statement.delta.value : ""}`
                                            : statement.type === "listAdd"
                                              ? `${copy.listAdd}: ${history.current.lists?.find((item) => item.id === statement.listId)?.name} ${statement.value.type === "numericLiteral" ? statement.value.value : ""}`
                                              : statement.type === "repeat"
                                                ? `${copy.repeat} ${statement.count} → ${statement.body[0]?.type ?? ""}`
                                                : statement.type === "if"
                                                  ? `${copy.ifScore} ${statement.condition.type === "greaterThan" && statement.condition.right.type === "numericLiteral" ? statement.condition.right.value : ""} → ${copy.thenMove}`
                                                  : ""}
                  </span>
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
              onClick={() => add({ type: "turn", degrees: -90 })}
            >
              + {copy.turnLeft}
            </button>
            <button
              type="button"
              className="kids-button"
              onClick={() => add({ type: "turn", degrees: 90 })}
            >
              + {copy.turnRight}
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
                  disabled={!Number.isInteger(dataValue) || Math.abs(dataValue) > 100}
                  onClick={() =>
                    add({
                      type: "if",
                      condition: {
                        type: "greaterThan",
                        left: { type: "variable", variableId },
                        right: { type: "numericLiteral", value: dataValue },
                      },
                      then: [{ type: "move", steps: 40 }],
                    })
                  }
                >
                  + {copy.ifScore} {dataValue} → {copy.thenMove}
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
          <pre className="kids-code-strip">{code}</pre>
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
