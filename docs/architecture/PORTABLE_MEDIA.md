# Portable images in `.agorix`

The v1 `.agorix` envelope remains the default and stays readable. A v2 envelope is emitted only when a project contains embedded PNG/WebP costume or backdrop images **and** the caller supplies `includeMedia: true` after an explicit adult decision. Without that option, export rejects a project containing inline media. It never silently uploads or bundles child-added art.

V2 keeps the canonical program and project metadata. In the file, an image asset's short `source` is `embedded:<asset-id>`; the top-level `media` object maps that asset ID to its data URL. Import verifies exact references and rehydrates sources for the local project. The import rejects missing or extra media, sound media, malformed data, non-PNG/WebP content, more than 12 images, images of 60 KB or more, and files over the existing 1 MiB envelope limit. V1 still rejects inline image sources.

The image bytes stay out of program statements, Ori requests, runtime evidence and account sync. UI integration in Escena libre must provide the adult opt-in at export time and show a clear choice to export without media or cancel; it must not treat the child-controlled `customImages` flag as export consent. See `docs/safety/CHILD_SAFETY_PRIVACY.md`.
