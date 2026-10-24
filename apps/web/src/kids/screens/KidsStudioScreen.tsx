import { useMemo, useState } from "react";
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
import { runMultiActorProgram, type MultiActorRunResult } from "@agorix/runtime";
import {
  acceptProposal,
  createProgramProposal,
  createProposalReview,
  modifyProposal,
  rejectProposal,
  type ProgramProposal,
} from "@agorix/proposals";
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
  appendStudioStatement,
  creativeForStudio,
  removeStudioStatement,
  studioActorId,
  type StudioStatement,
} from "../kidsStudioModel.js";
import { listStudioProjects, saveStudioProject, setStudioBackdrop } from "../kidsStudioProjects.js";
import { KidsBackdrop, KidsSprite } from "./KidsArt.js";

interface Props {
  readonly id: string;
  readonly locale: Locale;
  readonly onBack: () => void;
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
    remove: "Quitar bloque",
    undo: "Deshacer",
    redo: "Rehacer",
    code: "Código",
    idea: "Pedirle una idea a Ori",
    ideaText: "Ori propone mover este personaje una casilla. Mirá el cambio y decidí.",
    use: "Usar idea",
    change: "Cambiar a dos casillas",
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
    remove: "Remove block",
    undo: "Undo",
    redo: "Redo",
    code: "Code",
    idea: "Ask Ori for an idea",
    ideaText: "Ori suggests moving this character one cell. Inspect the change and decide.",
    use: "Use idea",
    change: "Change to two cells",
    reject: "Don't use",
    facts: "What really happened",
    saveError: "We couldn't save this scene. Try again.",
    chooseActor: "Choose a character",
    noBlocks: "Add a block to see what this character does.",
    stage: "Stage",
  },
} as const;

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

export function KidsStudioScreen({ id, locale, onBack }: Props) {
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
  const [run, setRun] = useState<MultiActorRunResult | null>(null);
  const [frame, setFrame] = useState<number | null>(null);
  const [language, setLanguage] = useState<"agorix" | "python" | "typescript">("agorix");
  const [oriIdea, setOriIdea] = useState<ProgramProposal | null>(null);
  const [error, setError] = useState(false);
  const creative = useMemo(
    () => creativeForStudio(history.current, backdropId, locale),
    [history.current, backdropId, locale],
  );
  const actor = creative.actors?.find((item) => item.id === activeActorId) ?? creative.actors?.[0];
  const script = history.current.scripts.find((item) => actor?.scripts?.includes(item.id));
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
      setFrame(null);
      setOriIdea(null);
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
      setFrame(null);
      setOriIdea(null);
      setError(false);
    } catch {
      setError(true);
    }
  }

  function play() {
    try {
      const result = runMultiActorProgram(history.current, creative);
      setRun(result);
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

  function askOri() {
    if (!actor || !script) return;
    const scriptIndex = history.current.scripts.findIndex((item) => item.id === script.id);
    const proposal = createProgramProposal({
      id: `ori-studio-${scriptIndex}-${script.statements.length}`,
      baseProgram: history.current,
      source: { kind: "learning-companion", capability: "builder" },
      purpose: locale === "es" ? "Una idea para tu escena" : "An idea for your scene",
      rationale: copy.ideaText,
      affectedActorIds: [actor.id],
      affectedScriptIds: [script.id],
      affectedNodeIds: [`scripts[${scriptIndex}]/statements[${script.statements.length}]`],
      operations: [
        { type: "appendStatement", scriptIndex, statement: { type: "move", steps: 40 } },
      ],
    });
    try {
      createProposalReview(history.current, proposal, creative);
      setOriIdea(proposal);
    } catch {
      setError(true);
    }
  }

  function decideOri(decision: "accept" | "change" | "reject") {
    if (!oriIdea) return;
    try {
      const review = createProposalReview(history.current, oriIdea, creative);
      if (decision === "reject") {
        rejectProposal(history.current, review);
        setOriIdea(null);
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
        scripts[operation.scriptIndex] = {
          ...target,
          statements: [...target.statements, { type: "move", steps: 80 }],
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
                  onClick={() => selectActor(item.id)}
                >
                  <KidsSprite slot={{ kind: "gallery", id: characterId }} label={item.name} />
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
              ? `${run.trace.length} ${locale === "es" ? "bloques ejecutados" : "blocks executed"}`
              : "—"}
          </p>
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
            <div className="kids-start-block">▶ {locale === "es" ? "Al jugar" : "When played"}</div>
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
          </div>
          <div className="kids-studio-ori">
            <button type="button" className="kids-button" onClick={askOri}>
              {copy.idea}
            </button>
            {oriIdea ? (
              <div className="kids-ori-proposal">
                <p>{copy.ideaText}</p>
                <strong>+ {copy.move} 1</strong>
                <div>
                  <button
                    type="button"
                    className="kids-button kids-primary"
                    onClick={() => decideOri("accept")}
                  >
                    {copy.use}
                  </button>
                  <button type="button" className="kids-button" onClick={() => decideOri("change")}>
                    {copy.change}
                  </button>
                  <button type="button" className="kids-button" onClick={() => decideOri("reject")}>
                    {copy.reject}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
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
