import type { OriExpression } from "../kidsOriExpression.js";

const LINE = {
  stroke: "#3b2a7a",
  strokeWidth: 3.2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  fill: "none",
} as const;

/** Where the pupils look, per expression: x and y in the eye, in drawing units. */
const GAZE: Record<OriExpression, { readonly x: number; readonly y: number }> = {
  neutral: { x: 0, y: 0 },
  curious: { x: 2.4, y: -1.2 },
  thinking: { x: 2.8, y: -3 },
  happy: { x: 0, y: 0.4 },
  celebrate: { x: 0, y: -0.4 },
  encourage: { x: 0, y: 0.6 },
};

function Brows({ expression }: { readonly expression: OriExpression }) {
  switch (expression) {
    case "curious":
      return (
        <g className="kids-ori-brows">
          <path d="M33 40 Q41 36 49 40" {...LINE} />
          <path d="M71 33 Q80 28 89 35" {...LINE} />
        </g>
      );
    case "thinking":
      return (
        <g className="kids-ori-brows">
          <path d="M33 39 Q41 36 49 38" {...LINE} />
          <path d="M71 38 Q79 35 87 38" {...LINE} />
        </g>
      );
    case "encourage":
      return (
        <g className="kids-ori-brows">
          <path d="M33 37 Q41 40 49 38" {...LINE} />
          <path d="M71 38 Q79 40 87 37" {...LINE} />
        </g>
      );
    case "happy":
    case "celebrate":
      return (
        <g className="kids-ori-brows">
          <path d="M33 36 Q41 31 49 36" {...LINE} />
          <path d="M71 36 Q79 31 87 36" {...LINE} />
        </g>
      );
    default:
      return (
        <g className="kids-ori-brows">
          <path d="M34 37 Q41 34 48 37" {...LINE} strokeWidth={2.6} />
          <path d="M72 37 Q79 34 86 37" {...LINE} strokeWidth={2.6} />
        </g>
      );
  }
}

function Eye({
  cx,
  expression,
  wink,
}: {
  readonly cx: number;
  readonly expression: OriExpression;
  readonly wink?: boolean;
}) {
  const gaze = GAZE[expression];
  if (wink)
    return (
      <g className="kids-ori-eye kids-ori-wink">
        <path d={`M${cx - 8} 50 Q${cx} 57 ${cx + 8} 50`} {...LINE} />
      </g>
    );
  if (expression === "happy" || expression === "celebrate")
    return (
      <g className="kids-ori-eye">
        <path d={`M${cx - 9} 52 Q${cx} 41 ${cx + 9} 52`} {...LINE} />
      </g>
    );
  return (
    <g className="kids-ori-eye">
      <ellipse
        cx={cx}
        cy="50"
        rx="9"
        ry={expression === "curious" && cx > 60 ? 7 : 10}
        fill="#fff"
      />
      <g className="kids-ori-pupil" style={{ transform: `translate(${gaze.x}px, ${gaze.y}px)` }}>
        <circle cx={cx} cy="50.5" r="5.2" fill="#2d1f66" />
        <circle cx={cx + 1.8} cy="48" r="1.7" fill="#fff" />
      </g>
    </g>
  );
}

function Mouth({ expression }: { readonly expression: OriExpression }) {
  switch (expression) {
    case "celebrate":
      return (
        <g className="kids-ori-mouth">
          <path
            d="M42 66 Q60 90 78 66 Z"
            fill="#3b2a7a"
            stroke="#3b2a7a"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M49 76 Q60 84 71 76 Q60 72 49 76 Z" fill="#ef627d" />
        </g>
      );
    case "happy":
      return (
        <g className="kids-ori-mouth">
          <path d="M44 67 Q60 84 76 67" {...LINE} />
        </g>
      );
    case "encourage":
      return (
        <g className="kids-ori-mouth">
          <path d="M46 69 Q60 79 74 69" {...LINE} />
        </g>
      );
    case "curious":
      return (
        <g className="kids-ori-mouth">
          <ellipse cx="62" cy="70" rx="5" ry="5.5" fill="#3b2a7a" />
        </g>
      );
    case "thinking":
      return (
        <g className="kids-ori-mouth">
          <path d="M50 72 Q58 70 68 73" {...LINE} />
        </g>
      );
    default:
      return (
        <g className="kids-ori-mouth">
          <path d="M48 69 Q60 77 72 69" {...LINE} />
        </g>
      );
  }
}

/**
 * Ori as a small character (issue #600, made livelier): a body that breathes and floats, eyes that
 * blink and look around, a mouth that talks, and a face that changes with what really happened.
 * Decorative: the state it shows is always also written in the text next to it. Reduced motion
 * keeps every expression and removes every movement.
 */
export function OriFace({
  expression,
  talking = false,
}: {
  readonly expression: OriExpression;
  readonly talking?: boolean;
}) {
  return (
    <svg
      className="kids-ori-face"
      data-ori-expression={expression}
      data-ori-talking={talking ? "true" : undefined}
      viewBox="0 0 120 120"
      width="120"
      height="120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="kids-ori-body" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#9b7df0" />
          <stop offset="1" stopColor="#5a3fb0" />
        </radialGradient>
      </defs>
      <ellipse
        className="kids-ori-shadow"
        cx="60"
        cy="112"
        rx="26"
        ry="5"
        fill="#2a1c5e"
        opacity="0.18"
      />
      <g className="kids-ori-float">
        <g className="kids-ori-body">
          <path
            className="kids-ori-antenna"
            d="M60 17 Q58 8 64 3"
            stroke="#5a3fb0"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle className="kids-ori-bulb" cx="64" cy="4" r="4.4" fill="#ffd666" />
          <ellipse cx="60" cy="62" rx="46" ry="44" fill="url(#kids-ori-body)" />
          <ellipse cx="60" cy="63" rx="36" ry="31" fill="#f6f2ff" />
          <circle className="kids-ori-cheek" cx="30" cy="64" r="6" fill="#ef9fb4" opacity="0.7" />
          <circle className="kids-ori-cheek" cx="90" cy="64" r="6" fill="#ef9fb4" opacity="0.7" />
          <Brows expression={expression} />
          <g className="kids-ori-eyes">
            <Eye cx={41} expression={expression} />
            <Eye cx={79} expression={expression} wink={expression === "encourage"} />
          </g>
          <Mouth expression={expression} />
        </g>
        {expression === "thinking" ? (
          <g className="kids-ori-dots" fill="#7356c5">
            <circle cx="92" cy="22" r="4" />
            <circle cx="102" cy="14" r="4.6" />
            <circle cx="113" cy="8" r="5.2" />
          </g>
        ) : null}
        {expression === "curious" ? (
          <text
            className="kids-ori-mark"
            x="96"
            y="26"
            fontSize="30"
            fontWeight="800"
            fill="#7356c5"
          >
            ?
          </text>
        ) : null}
        {expression === "celebrate" ? (
          <g className="kids-ori-sparkles">
            <path fill="#ffd666" d="M12 18 L15 26 L23 29 L15 32 L12 40 L9 32 L1 29 L9 26 Z" />
            <path
              fill="#ef627d"
              d="M104 14 L106 20 L112 22 L106 24 L104 30 L102 24 L96 22 L102 20 Z"
            />
            <path fill="#61b992" d="M98 84 L100 89 L105 91 L100 93 L98 98 L96 93 L91 91 L96 89 Z" />
            <circle fill="#548de4" cx="16" cy="86" r="3.4" />
            <circle fill="#ffb14a" cx="108" cy="52" r="3" />
          </g>
        ) : null}
        {expression === "encourage" ? (
          <g className="kids-ori-heart">
            <path
              fill="#ef627d"
              d="M100 24 q-5 -9 -11 -2 q-5 7 11 17 q16 -10 11 -17 q-6 -7 -11 2 z"
              transform="scale(0.8) translate(24 4)"
            />
          </g>
        ) : null}
      </g>
    </svg>
  );
}
