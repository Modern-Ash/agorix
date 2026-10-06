# Built-in asset library

Agorix Web ships a small, offline, no-account library so a learner can make a playful scene
without AI (issue #297). It follows the "choose a sprite / choose a backdrop" idea from Scratch.

- **Where**: [apps/web/src/assetLibrary.ts](../../apps/web/src/assetLibrary.ts).
- **Kinds**: `actor` (a sprite look, drawn as a glyph) and `backdrop` (flat colour plus a few
  code-native SVG shapes drawn by `StageView`). Nothing is fetched and no binary file is bundled.
- **Metadata**: `id`, localized `name` (en/es), `kind`, `width`, `height`, `tags`, and `glyph` for
  actors.
- **Persistence**: a project stores only the asset `id` — `metadata.actors.items[].costume` and
  `metadata.actors.backdrop` — which round-trips through local storage and `.agorix` export/import.
  Unknown ids fall back to the default, so a project made with a newer library still opens.
- **Adding an asset**: append an entry with a unique lowercase-kebab id (`^[a-z][a-z0-9-]{0,31}$`),
  give it names in both locales, and (backdrops) add its look in `BackdropArt`/`App.css`. Never
  rename or reuse an id.
- **Not included yet**: uploads, painting, sounds (see #301).
