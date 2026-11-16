import type { ActorView, AssetView } from "@agorix/studio-protocol";
import type { StudioUiCopy } from "./i18n.js";
import { imageForAsset, imageForId } from "./visualArt.js";

export function SceneLibrary({
  copy,
  actors,
  assets,
  selectedActorId,
  backdropId,
  onSelectActor,
  onCostume,
  onBackdrop,
  onCreateActor,
}: {
  readonly copy: StudioUiCopy;
  readonly actors: readonly ActorView[];
  readonly assets: readonly AssetView[];
  readonly selectedActorId: string | undefined;
  readonly backdropId: string | undefined;
  readonly onSelectActor: (id: string) => void;
  readonly onCostume: (actorId: string, costumeId: string) => void;
  readonly onBackdrop: (backdropId: string) => void;
  readonly onCreateActor?: (name: string) => void;
}) {
  const selected = actors.find((actor) => actor.id === selectedActorId) ?? actors[0];
  const costumes = assets.filter((asset) => asset.kind === "costume");
  const backdrops = assets.filter((asset) => asset.kind === "backdrop");
  const preview = (asset: AssetView) => {
    const image = imageForAsset(asset);
    return image === undefined ? (
      <span aria-hidden="true">{asset.name.slice(0, 1)}</span>
    ) : (
      <img src={image} alt="" />
    );
  };
  return (
    <div className="scene-library" aria-label={copy.libraryScene}>
      <section aria-label={copy.sceneActors}>
        <h3>{copy.sceneActors}</h3>
        {onCreateActor === undefined ? null : (
          <form
            className="scene-create-actor"
            onSubmit={(event) => {
              event.preventDefault();
              const input = event.currentTarget.querySelector("input");
              const name = input?.value.trim() ?? "";
              if (name.length === 0) return;
              onCreateActor(name);
              if (input !== null) input.value = "";
            }}
          >
            <input aria-label={copy.sceneActorName} maxLength={80} />
            <button type="submit">{copy.sceneCreateActor}</button>
          </form>
        )}
        <div className="scene-library-grid scene-actors">
          {actors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              aria-pressed={actor.id === selected?.id}
              onClick={() => onSelectActor(actor.id)}
              title={actor.name}
            >
              {imageForId(actor.costumeId, assets) === undefined ? (
                <span aria-hidden="true">{actor.name.slice(0, 1)}</span>
              ) : (
                <img src={imageForId(actor.costumeId, assets)} alt="" />
              )}
              <span>{actor.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section aria-label={copy.sceneCostumes}>
        <h3>
          {copy.sceneCostumes}
          {selected === undefined ? "" : ` · ${selected.name}`}
        </h3>
        <div className="scene-library-grid">
          {costumes.map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={selected === undefined}
              aria-pressed={asset.id === selected?.costumeId}
              aria-label={`${copy.sceneSelectCostume}: ${asset.name}`}
              onClick={() => {
                if (selected !== undefined) onCostume(selected.id, asset.id);
              }}
            >
              {preview(asset)}
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section aria-label={copy.sceneBackdrops}>
        <h3>{copy.sceneBackdrops}</h3>
        <div className="scene-library-grid">
          {backdrops.map((asset) => (
            <button
              key={asset.id}
              type="button"
              aria-pressed={asset.id === backdropId}
              aria-label={`${copy.sceneSelectBackdrop}: ${asset.name}`}
              onClick={() => onBackdrop(asset.id)}
            >
              {preview(asset)}
              <span>{asset.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
