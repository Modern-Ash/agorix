# @agorix/art-document

The document a child's costume or backdrop is drawn in (`docs/product/SCRATCH_PARITY_DESIGNS.md`,
section 1): a bounded, serialisable, versioned list of shapes, rendered to SVG by one pure function,
plus the sanitiser every imported SVG goes through. No DOM, no browser API, no UI: the editor, the
rasteriser and the proposal that lets Ori suggest a variation come in later slices.

- `validateArtDocument`: strict shape, closed palette and widths, whole-number coordinates, caps.
- `renderArtDocumentSvg`: the only way a document becomes markup; every value in it is a validated
  number, a palette colour or escaped text.
- `describeArtDocument`: a text description for screen readers, built from the shape list.
- `sanitizeSvg`: untrusted SVG in, a re-serialised safe subset out, or a clear refusal. Nothing is
  passed through: scripts, event handlers, links, styles, external references and entities are
  refused, and what is kept is rebuilt from an allow-list.
