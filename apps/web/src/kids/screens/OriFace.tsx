import type { OriExpression } from "../kidsOriExpression.js";

const STROKE = {
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

function Eyes({ expression }: { readonly expression: OriExpression }) {
  switch (expression) {
    case "happy":
    case "celebrate":
      return (
        <g className="kids-ori-eyes">
          <path d="M8.5 14 Q11 10 13.5 14" {...STROKE} />
          <path d="M18.5 14 Q21 10 23.5 14" {...STROKE} />
        </g>
      );
    case "encourage":
      return (
        <g className="kids-ori-eyes">
          <circle cx="11" cy="13" r="2.1" fill="currentColor" />
          <path d="M18.5 13 Q21 16 23.5 13" {...STROKE} />
        </g>
      );
    case "curious":
      return (
        <g className="kids-ori-eyes">
          <circle cx="11" cy="13" r="2.8" fill="currentColor" />
          <circle cx="21" cy="13" r="1.7" fill="currentColor" />
          <path d="M18 8.5 L24 7.5" {...STROKE} strokeWidth={1.6} />
        </g>
      );
    case "thinking":
      return (
        <g className="kids-ori-eyes">
          <circle cx="12" cy="11.5" r="1.9" fill="currentColor" />
          <circle cx="22" cy="11.5" r="1.9" fill="currentColor" />
        </g>
      );
    default:
      return (
        <g className="kids-ori-eyes">
          <circle cx="11" cy="13" r="2.1" fill="currentColor" />
          <circle cx="21" cy="13" r="2.1" fill="currentColor" />
        </g>
      );
  }
}

function Mouth({ expression }: { readonly expression: OriExpression }) {
  switch (expression) {
    case "celebrate":
      return <path d="M10 19 Q16 29 22 19 Z" fill="currentColor" stroke="none" />;
    case "happy":
      return <path d="M10.5 19.5 Q16 26 21.5 19.5" {...STROKE} />;
    case "encourage":
      return <path d="M11.5 20 Q16 25 20.5 20" {...STROKE} />;
    case "curious":
      return <path d="M13 21.5 Q16 20 19.5 22" {...STROKE} />;
    case "thinking":
      return <path d="M13 21.5 H19" {...STROKE} />;
    default:
      return <path d="M12 20.5 Q16 23.5 20 20.5" {...STROKE} />;
  }
}

/** Decorative: the state it shows is always also written in the text next to it. */
export function OriFace({ expression }: { readonly expression: OriExpression }) {
  return (
    <svg
      className="kids-ori-face"
      data-ori-expression={expression}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <g className="kids-ori-head">
        <Eyes expression={expression} />
        <Mouth expression={expression} />
      </g>
      {expression === "thinking" ? (
        <g className="kids-ori-dots" fill="currentColor">
          <circle cx="21" cy="4.5" r="1.3" />
          <circle cx="25" cy="3.5" r="1.3" />
          <circle cx="29" cy="4.5" r="1.3" />
        </g>
      ) : null}
      {expression === "celebrate" ? (
        <g className="kids-ori-sparkles" fill="#ffd666">
          <path d="M5 4 L6 6.5 L8.5 7.5 L6 8.5 L5 11 L4 8.5 L1.5 7.5 L4 6.5 Z" />
          <path d="M27 2 L27.8 4 L29.8 4.8 L27.8 5.6 L27 7.6 L26.2 5.6 L24.2 4.8 L26.2 4 Z" />
        </g>
      ) : null}
    </svg>
  );
}
