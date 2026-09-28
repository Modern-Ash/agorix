import type { NodeTextMapping } from "@agorix/code-generator";

interface CodePanelProps {
  readonly code: string;
  readonly mapping: NodeTextMapping;
  readonly highlightedNodeId: string | null;
}

/** Code is continuously visible (AGENTS.md invariant) — never hidden behind a toggle or panel collapse. */
export function CodePanel({ code, mapping, highlightedNodeId }: CodePanelProps) {
  const range = highlightedNodeId !== null ? mapping[highlightedNodeId] : undefined;
  const before = range !== undefined ? code.slice(0, range.start) : code;
  const highlighted = range !== undefined ? code.slice(range.start, range.end) : "";
  const after = range !== undefined ? code.slice(range.end) : "";

  return (
    <pre data-testid="code-panel" className="code-panel">
      <code>
        {before}
        {range !== undefined ? (
          <mark data-testid="code-highlight">{highlighted}</mark>
        ) : null}
        {after}
      </code>
    </pre>
  );
}
