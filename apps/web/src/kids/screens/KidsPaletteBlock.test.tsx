import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KidsPaletteBlock } from "./KidsPaletteBlock.js";

describe("KidsPaletteBlock (issue #817)", () => {
  it("renders add actions as buttons that keep the plus only in the accessible name", () => {
    const html = renderToStaticMarkup(
      <KidsPaletteBlock
        tone="looks"
        actions={[
          { label: "Decir", onAdd: () => {} },
          { label: "Pensar", onAdd: () => {} },
        ]}
      />,
    );
    expect(html).toContain('class="kids-palette-tool kids-palette-tool-looks"');
    expect(html).toContain('data-kids-palette-tool="looks"');
    expect(html).toContain('<span class="kids-visually-hidden">+ </span>');
    expect(html).toContain('data-kids-add="true"');
    expect(html).toContain('data-kids-add-label="Decir"');
    expect(html).toContain(">Decir</button>");
    expect(html).toContain(">Pensar</button>");
    expect(html).not.toContain('aria-label="+ Decir"');
  });

  it("keeps closed value slots inside the block and marks disabled actions", () => {
    const html = renderToStaticMarkup(
      <KidsPaletteBlock
        tone="motion"
        actions={[{ label: "Mover", onAdd: () => {}, disabled: true }]}
      >
        <select aria-label="Mover" defaultValue={1}>
          <option value={1}>1</option>
        </select>
      </KidsPaletteBlock>,
    );
    expect(html).toContain('data-kids-palette-tool="motion"');
    expect(html).toContain('class="kids-palette-tool-slots"');
    expect(html).toContain('aria-label="Mover"');
    expect(html).toContain("disabled");
  });

  it("keeps preview and group tools in the block without making them drag controls", () => {
    const html = renderToStaticMarkup(
      <KidsPaletteBlock
        tone="sound"
        actions={[
          { label: "Sonar", onAdd: () => {} },
          { label: "▶ Sonar", kind: "tool", onAdd: () => {} },
        ]}
      >
        <select aria-label="Sonar" defaultValue="kids:pop">
          <option value="kids:pop">Pop</option>
        </select>
      </KidsPaletteBlock>,
    );
    expect(html).toContain('data-kids-palette-tool="sound"');
    expect(html).toContain('data-kids-palette-action="add"');
    expect(html).toContain('data-kids-palette-action="tool"');
    expect(html).toContain('data-kids-add="true"');
    expect(html).not.toContain('data-kids-add-label="▶ Sonar"');
    expect(html).not.toContain("+ ▶ Sonar");
    expect(html.match(/kids-visually-hidden/g)).toHaveLength(1);
  });
});
