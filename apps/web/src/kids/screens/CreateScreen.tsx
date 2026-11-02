import { useEffect, useState, type ChangeEvent } from "react";
import type { KidsAvatar, KidsWorld } from "../kidsState.js";
import { KidsImageError, processKidsImage } from "../kidsImage.js";
import { useKidsFlag } from "../kidsFlags.js";
import type { KidsAvatarRef, KidsWorldRef } from "../kidsProjects.js";
import { KidsBackdrop, KidsSprite, builtinWorld, emojiSlot } from "./KidsArt.js";
import type { KidsText } from "../useKidsText.js";
import type { Locale } from "../../i18n.js";
import { ListenButton } from "./ListenButton.js";
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
  readonly onStudio: (
    characterId: KidsGalleryCharacterId,
    backdropId: KidsGalleryBackdropId,
    /** Open the drawing canvas right away, for the child's own character or backdrop. */
    draw?: "costume" | "backdrop",
    upload?: { readonly kind: "costume" | "backdrop"; readonly dataUrl: string },
  ) => boolean;
}

export function CreateScreen({ t, locale, avatar, world, readAloud = true, onStudio }: Props) {
  const customEnabled = useKidsFlag("customImages");
  const [imageMessage, setImageMessage] = useState("");
  // One selection for everything Crear can make; it is remembered on this device.
  const [saved] = useState(() => loadCreateSelection());
  // The explorer of a single-character world and the character of Escena libre are two choices:
  // both stay marked, and picking one never unmarks the other.
  const [chosenAvatar] = useState<KidsAvatarRef>(() =>
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
  const finishScene = () => onStudio(selectedScene.characterId, selectedScene.backdropId);

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
        <button type="button" className="kids-button kids-primary" onClick={finishScene}>
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
      <div
        className="kids-create-next"
        aria-label={locale === "es" ? "Continuar creación" : "Continue creating"}
      >
        <span className="kids-create-next-selection" aria-live="polite">
          {galleryCharacterName(selectedScene.characterId, locale)} ·{" "}
          {galleryBackdropName(selectedScene.backdropId, locale)}
        </span>
        <button
          type="button"
          className="kids-button kids-primary kids-create-advance"
          onClick={() => (step < 3 ? setStep(step === 1 ? 2 : 3) : finishScene())}
        >
          {step === 1
            ? locale === "es"
              ? "Continuar: elegir fondo"
              : "Continue: choose backdrop"
            : step === 2
              ? locale === "es"
                ? "Continuar: revisar escena"
                : "Continue: review scene"
              : locale === "es"
                ? "Finalizar y abrir escena"
                : "Finish and open scene"}
        </button>
        <button
          type="button"
          className="kids-button kids-primary kids-create-finish"
          onClick={finishScene}
        >
          {locale === "es" ? "Finalizar y abrir escena" : "Finish and open scene"}
        </button>
      </div>
      <div className="kids-create-step" data-create-step="1">
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
            <KidsSprite slot={{ kind: "gallery", id: selectedScene.characterId }} />
            <span>
              {locale === "es" ? "Personaje" : "Character"}:{" "}
              {galleryCharacterName(selectedScene.characterId, locale)}
            </span>
          </div>
          <div>
            <KidsBackdrop
              world={{ kind: "gallery", id: selectedScene.backdropId }}
              className="kids-create-selection-backdrop"
            />
            <span>
              {locale === "es" ? "Fondo" : "Backdrop"}:{" "}
              {galleryBackdropName(selectedScene.backdropId, locale)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
