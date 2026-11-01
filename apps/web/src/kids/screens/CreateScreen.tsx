import { useEffect, useState, type ChangeEvent } from "react";
import { KIDS_AVATARS, KIDS_WORLDS, type KidsAvatar, type KidsWorld } from "../kidsState.js";
import { addKidsCustom, loadKidsCustom, type KidsCustomKind } from "../kidsCustom.js";
import { KidsImageError, processKidsImage } from "../kidsImage.js";
import { useKidsFlag } from "../kidsFlags.js";
import type { KidsAvatarRef, KidsWorldRef } from "../kidsProjects.js";
import { KidsBackdrop, KidsSprite, builtinWorld, emojiSlot } from "./KidsArt.js";
import { kidsTable, type KidsText } from "../useKidsText.js";
import { KIDS_WORLD_STYLES } from "../worlds.js";
import type { Locale } from "../../i18n.js";
import { ListenButton } from "./ListenButton.js";
import { KidsDrawArt } from "./KidsDrawArt.js";
import { loadCreateSelection, saveCreateSelection, studioStart } from "../kidsCreateSelection.js";
import {
  KIDS_GALLERY_BACKDROPS,
  KIDS_GALLERY_CATEGORIES,
  KIDS_GALLERY_CHARACTERS,
  galleryBackdropName,
  galleryCategoryName,
  galleryCharacterName,
  type KidsGalleryBackdropId,
  type KidsGalleryCategory,
  type KidsGalleryCharacterId,
} from "../kidsGallery.js";

interface Props {
  readonly t: KidsText;
  readonly locale: Locale;
  readonly avatar: KidsAvatar;
  readonly world: KidsWorld;
  readonly readAloud?: boolean;
  readonly onAvatar: (avatar: KidsAvatar) => void;
  readonly onWorld: (world: KidsWorld) => void;
  readonly onStart: (world: KidsWorldRef, avatar: KidsAvatarRef) => void;
  readonly onStudio: (
    characterId: KidsGalleryCharacterId,
    backdropId: KidsGalleryBackdropId,
    /** Open the drawing canvas right away, for the child's own character or backdrop. */
    draw?: "costume" | "backdrop",
    upload?: { readonly kind: "costume" | "backdrop"; readonly dataUrl: string },
  ) => boolean;
}

export function CreateScreen({
  t,
  locale,
  avatar,
  world,
  readAloud = true,
  onAvatar,
  onWorld,
  onStart,
  onStudio,
}: Props) {
  const worlds = kidsTable(locale, "worlds");
  const customEnabled = useKidsFlag("customImages");
  // With scenes as the one way to create, the old single-explorer entry is gone (#1134).
  const freeToScene = useKidsFlag("freeToScene");
  const [custom, setCustom] = useState(() => loadKidsCustom());
  const [imageMessage, setImageMessage] = useState("");
  const [drawingKind, setDrawingKind] = useState<KidsCustomKind | null>(null);
  // One selection for everything Crear can make; it is remembered on this device.
  const [saved] = useState(() => loadCreateSelection());
  // The explorer of a single-character world and the character of Escena libre are two choices:
  // both stay marked, and picking one never unmarks the other.
  const [chosenAvatar, setChosenAvatar] = useState<KidsAvatarRef>(() =>
    saved && saved.avatar.kind !== "gallery" ? saved.avatar : emojiSlot(avatar),
  );
  const [sceneCharacter, setSceneCharacter] = useState<KidsGalleryCharacterId>(
    () => saved?.scene ?? "nova",
  );
  const [chosenWorld, setChosenWorld] = useState<KidsWorldRef>(
    () => saved?.world ?? builtinWorld(world),
  );
  useEffect(() => {
    saveCreateSelection({ avatar: chosenAvatar, world: chosenWorld, scene: sceneCharacter });
  }, [chosenAvatar, chosenWorld, sceneCharacter]);
  // Phone: Crear is a three-step flow (character, backdrop, create); wide screens show it all (#1111).
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [characterCategory, setCharacterCategory] = useState<KidsGalleryCategory>("all");
  const [backdropCategory, setBackdropCategory] = useState<KidsGalleryCategory>("all");
  const [characterSearch, setCharacterSearch] = useState("");
  const [backdropSearch, setBackdropSearch] = useState("");

  const visibleCharacters = KIDS_GALLERY_CHARACTERS.filter(
    (item) =>
      (characterCategory === "all" || item.category === characterCategory) &&
      galleryCharacterName(item.id, locale)
        .toLocaleLowerCase(locale)
        .includes(characterSearch.toLocaleLowerCase(locale)),
  );
  const visibleBackdrops = KIDS_GALLERY_BACKDROPS.filter(
    (item) =>
      (backdropCategory === "all" || item.category === backdropCategory) &&
      galleryBackdropName(item.id, locale)
        .toLocaleLowerCase(locale)
        .includes(backdropSearch.toLocaleLowerCase(locale)),
  );
  const selectedScene = studioStart({
    avatar: chosenAvatar,
    world: chosenWorld,
    scene: sceneCharacter,
  });

  async function addImage(kind: KidsCustomKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = addKidsCustom(kind, await processKidsImage(file));
      if (!result.ok) {
        setImageMessage(
          t(
            result.reason === "limit"
              ? "customLimit"
              : result.reason === "invalidImage"
                ? "imageErrorType"
                : "imageErrorQuota",
          ),
        );
        return;
      }
      setCustom(loadKidsCustom());
      if (kind === "explorer") setChosenAvatar({ kind: "custom", id: result.item.id });
      else setChosenWorld({ kind: "custom", id: result.item.id });
      setImageMessage(t("imageSaved"));
    } catch (error) {
      const code = error instanceof KidsImageError ? error.code : "decodeFailed";
      setImageMessage(
        t(
          code === "unsupportedType"
            ? "imageErrorType"
            : code === "tooLarge"
              ? "imageErrorSize"
              : code === "outputTooLarge"
                ? "imageErrorOutput"
                : "imageErrorDecode",
        ),
      );
    } finally {
      event.target.value = "";
    }
  }

  async function uploadSceneImage(
    kind: "costume" | "backdrop",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processKidsImage(file);
      if (
        !onStudio(selectedScene.characterId, selectedScene.backdropId, undefined, { kind, dataUrl })
      )
        setImageMessage(t("imageErrorQuota"));
    } catch (error) {
      const code = error instanceof KidsImageError ? error.code : "decodeFailed";
      setImageMessage(
        t(
          code === "unsupportedType"
            ? "imageErrorType"
            : code === "tooLarge"
              ? "imageErrorSize"
              : code === "outputTooLarge"
                ? "imageErrorOutput"
                : "imageErrorDecode",
        ),
      );
    } finally {
      event.target.value = "";
    }
  }

  function saveDrawing(kind: KidsCustomKind, dataUrl: string) {
    const result = addKidsCustom(kind, dataUrl);
    if (!result.ok) {
      setImageMessage(
        t(
          result.reason === "limit"
            ? "customLimit"
            : result.reason === "invalidImage"
              ? "imageErrorOutput"
              : "imageErrorQuota",
        ),
      );
      return;
    }
    setCustom(loadKidsCustom());
    if (kind === "explorer") setChosenAvatar({ kind: "custom", id: result.item.id });
    else setChosenWorld({ kind: "custom", id: result.item.id });
    setImageMessage(t("imageSaved"));
    setDrawingKind(null);
  }
  return (
    <section
      className="kids-screen kids-create"
      aria-labelledby="kids-create-title"
      data-step={step}
    >
      <h1 id="kids-create-title">{t("create")}</h1>
      <ListenButton t={t} locale={locale} enabled={readAloud} text={t("createNote")} />
      <p className="kids-note">{t("createNote")}</p>
      <div className="kids-studio-entry">
        <div>
          <h2>{locale === "es" ? "Escena libre" : "Free scene"}</h2>
          <p>
            {locale === "es"
              ? "Creá con varios personajes y todos los bloques. Cada personaje puede tener su propio programa."
              : "Create with several characters and every block. Each can have its own program."}
          </p>
        </div>
        <button
          type="button"
          className="kids-button kids-primary"
          onClick={() => {
            onStudio(selectedScene.characterId, selectedScene.backdropId);
          }}
        >
          {locale === "es" ? "Crear escena" : "Create scene"}
        </button>
        <p className="kids-note kids-create-ready" data-testid="studio-ready">
          {locale === "es" ? "¡Todo listo!" : "All set!"}{" "}
          {galleryCharacterName(selectedScene.characterId, locale)} {locale === "es" ? "en" : "in"}{" "}
          {galleryBackdropName(selectedScene.backdropId, locale)} ·{" "}
          {locale === "es" ? "Listo para programar" : "Ready to program"}
        </p>
        <p className="kids-note" data-testid="studio-start-note">
          {locale === "es"
            ? `La escena empieza con ${galleryCharacterName(selectedScene.characterId, locale)}.`
            : `The scene starts with ${galleryCharacterName(selectedScene.characterId, locale)}.`}
        </p>
      </div>
      <nav
        className="kids-create-steps"
        aria-label={locale === "es" ? "Pasos para crear" : "Steps to create"}
      >
        {([1, 2, 3] as const).map((number) => (
          <button
            key={number}
            type="button"
            className="kids-button"
            aria-current={step === number ? "step" : undefined}
            onClick={() => setStep(number)}
          >
            {number} ·{" "}
            {number === 1
              ? locale === "es"
                ? "Personaje"
                : "Character"
              : number === 2
                ? locale === "es"
                  ? "Fondo"
                  : "Backdrop"
                : locale === "es"
                  ? "¡Crear!"
                  : "Create!"}
          </button>
        ))}
      </nav>
      <div className="kids-create-step" data-create-step="1">
        <div hidden={freeToScene}>
          <h2>{t("createChar")}</h2>
          <div className="kids-create-choices">
            {KIDS_AVATARS.map((candidate) => (
              <button
                type="button"
                key={candidate}
                className="kids-button"
                aria-label={`${t("createChar")}: ${candidate}`}
                aria-pressed={chosenAvatar.kind === "emoji" && chosenAvatar.value === candidate}
                onClick={() => {
                  setChosenAvatar(emojiSlot(candidate));
                  onAvatar(candidate);
                }}
              >
                <KidsSprite slot={emojiSlot(candidate)} fallback={candidate} />
              </button>
            ))}
            {customEnabled &&
              custom
                .filter((item) => item.kind === "explorer")
                .map((item) => (
                  <button
                    type="button"
                    className="kids-button kids-custom-choice"
                    key={item.id}
                    aria-label={`${t("customExplorer")} ${item.id.slice(7)}`}
                    aria-pressed={chosenAvatar.kind === "custom" && chosenAvatar.id === item.id}
                    onClick={() => setChosenAvatar({ kind: "custom", id: item.id })}
                  >
                    <KidsSprite
                      slot={{ kind: "custom", id: item.id }}
                      label={t("customExplorer")}
                    />
                  </button>
                ))}
            {customEnabled ? (
              <label className="kids-button kids-image-file kids-create-upload">
                {t("addCustomExplorer")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={t("addCustomExplorer")}
                  onChange={(event) => void addImage("explorer", event)}
                />
              </label>
            ) : null}
            {customEnabled ? (
              <button
                type="button"
                className="kids-button kids-create-upload"
                onClick={() => setDrawingKind("explorer")}
              >
                {locale === "es" ? "Dibujar explorador" : "Draw character"}
              </button>
            ) : null}
          </div>
          {drawingKind === "explorer" ? (
            <KidsDrawArt
              kind="explorer"
              locale={locale}
              onSave={(dataUrl) => saveDrawing("explorer", dataUrl)}
              onCancel={() => setDrawingKind(null)}
              onError={() => setImageMessage(t("imageErrorOutput"))}
            />
          ) : null}
        </div>
        <div className="kids-gallery-head">
          <h3>{locale === "es" ? "Personajes para Escena libre" : "Characters for Free scene"}</h3>
          <input
            type="search"
            aria-label={locale === "es" ? "Buscar personaje" : "Search character"}
            placeholder={locale === "es" ? "Buscar personaje" : "Search character"}
            value={characterSearch}
            onChange={(event) => setCharacterSearch(event.target.value)}
          />
        </div>
        <div
          className="kids-gallery-filters"
          role="group"
          aria-label={locale === "es" ? "Categorías de personajes" : "Character categories"}
        >
          {KIDS_GALLERY_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className="kids-button"
              aria-pressed={characterCategory === category}
              onClick={() => setCharacterCategory(category)}
            >
              {galleryCategoryName(category, locale)}
            </button>
          ))}
        </div>
        <div
          className="kids-gallery-grid"
          aria-label={locale === "es" ? "Personajes incluidos" : "Included characters"}
        >
          {visibleCharacters.map((item) => (
            <button
              key={item.id}
              type="button"
              className="kids-button kids-gallery-card"
              aria-label={galleryCharacterName(item.id, locale)}
              aria-pressed={sceneCharacter === item.id}
              onClick={() => setSceneCharacter(item.id)}
            >
              <KidsSprite
                slot={{ kind: "gallery", id: item.id }}
                label={galleryCharacterName(item.id, locale)}
              />
              <span>{galleryCharacterName(item.id, locale)}</span>
            </button>
          ))}
        </div>
        {customEnabled ? (
          <label className="kids-button kids-image-file kids-create-upload">
            {locale === "es" ? "Subir mi propio personaje" : "Upload my own character"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={locale === "es" ? "Subir mi propio personaje" : "Upload my own character"}
              onChange={(event) => void uploadSceneImage("costume", event)}
            />
          </label>
        ) : null}
        {customEnabled ? (
          <button
            type="button"
            className="kids-button kids-create-upload"
            onClick={() => onStudio(selectedScene.characterId, selectedScene.backdropId, "costume")}
          >
            {locale === "es" ? "Dibujar mi propio personaje" : "Draw my own character"}
          </button>
        ) : null}
      </div>
      <div className="kids-create-step" data-create-step="2">
        <div hidden={freeToScene}>
          <h2>{t("createBg")}</h2>
          <div className="kids-create-worlds">
            {KIDS_WORLDS.map((candidate) => (
              <button
                type="button"
                key={candidate}
                className="kids-button"
                aria-pressed={chosenWorld.kind === "builtin" && chosenWorld.value === candidate}
                style={{ background: KIDS_WORLD_STYLES[candidate].tint }}
                onClick={() => {
                  setChosenWorld(builtinWorld(candidate));
                  onWorld(candidate);
                }}
              >
                <KidsBackdrop
                  world={builtinWorld(candidate)}
                  fallbackBackground="transparent"
                  className="kids-world-glyph"
                >
                  {KIDS_WORLD_STYLES[candidate].character}
                </KidsBackdrop>{" "}
                {worlds[candidate]}
              </button>
            ))}
            {customEnabled &&
              custom
                .filter((item) => item.kind === "backdrop")
                .map((item) => (
                  <button
                    type="button"
                    className="kids-button kids-custom-world"
                    key={item.id}
                    aria-label={`${t("customBackdrop")} ${item.id.slice(7)}`}
                    aria-pressed={chosenWorld.kind === "custom" && chosenWorld.id === item.id}
                    onClick={() => setChosenWorld({ kind: "custom", id: item.id })}
                  >
                    <KidsBackdrop
                      world={{ kind: "custom", id: item.id }}
                      className="kids-custom-world-thumb"
                    />
                    {t("customBackdrop")} {item.id.slice(7)}
                  </button>
                ))}
            {customEnabled ? (
              <label className="kids-button kids-image-file kids-create-upload">
                {t("addCustomBackdrop")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label={t("addCustomBackdrop")}
                  onChange={(event) => void addImage("backdrop", event)}
                />
              </label>
            ) : null}
            {customEnabled ? (
              <button
                type="button"
                className="kids-button kids-create-upload"
                onClick={() => setDrawingKind("backdrop")}
              >
                {locale === "es" ? "Dibujar fondo" : "Draw backdrop"}
              </button>
            ) : null}
          </div>
          {drawingKind === "backdrop" ? (
            <KidsDrawArt
              kind="backdrop"
              locale={locale}
              onSave={(dataUrl) => saveDrawing("backdrop", dataUrl)}
              onCancel={() => setDrawingKind(null)}
              onError={() => setImageMessage(t("imageErrorOutput"))}
            />
          ) : null}
        </div>
        <div className="kids-gallery-head">
          <h3>{locale === "es" ? "Galería de fondos" : "Backdrop gallery"}</h3>
          <input
            type="search"
            aria-label={locale === "es" ? "Buscar fondo" : "Search backdrop"}
            placeholder={locale === "es" ? "Buscar fondo" : "Search backdrop"}
            value={backdropSearch}
            onChange={(event) => setBackdropSearch(event.target.value)}
          />
        </div>
        <div
          className="kids-gallery-filters"
          role="group"
          aria-label={locale === "es" ? "Categorías de fondos" : "Backdrop categories"}
        >
          {KIDS_GALLERY_CATEGORIES.filter((category) => category !== "animals").map((category) => (
            <button
              key={category}
              type="button"
              className="kids-button"
              aria-pressed={backdropCategory === category}
              onClick={() => setBackdropCategory(category)}
            >
              {galleryCategoryName(category, locale)}
            </button>
          ))}
        </div>
        <div
          className="kids-gallery-grid kids-gallery-backdrops"
          aria-label={locale === "es" ? "Fondos incluidos" : "Included backdrops"}
        >
          {visibleBackdrops.map((item) => (
            <button
              key={item.id}
              type="button"
              className="kids-button kids-gallery-card"
              aria-label={galleryBackdropName(item.id, locale)}
              aria-pressed={chosenWorld.kind === "gallery" && chosenWorld.id === item.id}
              onClick={() => setChosenWorld({ kind: "gallery", id: item.id })}
            >
              <KidsBackdrop
                world={{ kind: "gallery", id: item.id }}
                className="kids-gallery-backdrop-thumb"
              />
              <span>{galleryBackdropName(item.id, locale)}</span>
            </button>
          ))}
        </div>
        {customEnabled ? (
          <label className="kids-button kids-image-file kids-create-upload">
            {locale === "es" ? "Subir mi propio fondo" : "Upload my own backdrop"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label={locale === "es" ? "Subir mi propio fondo" : "Upload my own backdrop"}
              onChange={(event) => void uploadSceneImage("backdrop", event)}
            />
          </label>
        ) : null}
        {customEnabled ? (
          <button
            type="button"
            className="kids-button kids-create-upload"
            onClick={() =>
              onStudio(selectedScene.characterId, selectedScene.backdropId, "backdrop")
            }
          >
            {locale === "es" ? "Dibujar mi propio fondo" : "Draw my own backdrop"}
          </button>
        ) : null}
      </div>
      <div className="kids-create-step" data-create-step="3">
        {customEnabled ? <p className="kids-note">{t("imagesStay")}</p> : null}
        <p role="status" className="kids-note">
          {imageMessage}
        </p>
        <div
          className="kids-create-selection"
          aria-label={locale === "es" ? "Tu elección" : "Your selection"}
        >
          <div>
            <KidsSprite
              slot={freeToScene ? { kind: "gallery", id: selectedScene.characterId } : chosenAvatar}
            />
            <span>
              {locale === "es" ? "Personaje" : "Character"}:{" "}
              {freeToScene
                ? galleryCharacterName(selectedScene.characterId, locale)
                : chosenAvatar.kind === "gallery"
                  ? galleryCharacterName(chosenAvatar.id, locale)
                  : chosenAvatar.kind === "emoji"
                    ? chosenAvatar.value
                    : t("customExplorer")}
            </span>
          </div>
          <div>
            <KidsBackdrop
              world={freeToScene ? { kind: "gallery", id: selectedScene.backdropId } : chosenWorld}
              className="kids-create-selection-backdrop"
            />
            <span>
              {locale === "es" ? "Fondo" : "Backdrop"}:{" "}
              {freeToScene
                ? galleryBackdropName(selectedScene.backdropId, locale)
                : chosenWorld.kind === "gallery"
                  ? galleryBackdropName(chosenWorld.id, locale)
                  : chosenWorld.kind === "builtin"
                    ? worlds[chosenWorld.value]
                    : t("customBackdrop")}
            </span>
          </div>
        </div>
        {freeToScene ? null : (
          <>
            <p className="kids-note" data-testid="free-project-note">
              {locale === "es"
                ? "¡Crear! abre un explorador solo, con pocos bloques y una meta opcional. Para todos los bloques, usá Escena libre."
                : "Create! opens a single explorer with a few blocks and an optional goal. For every block, use Free scene."}
            </p>
            <button
              type="button"
              className="kids-button kids-primary kids-create-start"
              onClick={() =>
                onStart(
                  customEnabled || chosenWorld.kind !== "custom"
                    ? chosenWorld
                    : builtinWorld(world),
                  customEnabled || chosenAvatar.kind !== "custom"
                    ? chosenAvatar
                    : emojiSlot(avatar),
                )
              }
            >
              {t("createStart")}
            </button>
          </>
        )}
      </div>
      <div className="kids-create-next">
        {step < 3 ? (
          <button
            type="button"
            className="kids-button kids-primary"
            onClick={() => setStep(step === 1 ? 2 : 3)}
          >
            {locale === "es" ? "Seguir" : "Next"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
