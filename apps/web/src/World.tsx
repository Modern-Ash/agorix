import type { Position } from "@agorix/runtime";

interface WorldProps {
  readonly spritePosition: Position;
  readonly spriteHeading: number;
  readonly goal: Position;
  readonly goalRadius: number;
}

const VIEW_MIN = -10;
const VIEW_MAX = 40;
const VIEW_SIZE = VIEW_MAX - VIEW_MIN;

/** Deterministic, framework-neutral SVG render of `@agorix/stage` state. World is a dominant surface (AC-011), never optional chrome. */
export function World({ spritePosition, spriteHeading, goal, goalRadius }: WorldProps) {
  return (
    <svg
      data-testid="world"
      viewBox={`${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`}
      role="img"
      aria-label="Mission world"
      className="world-panel"
    >
      <rect x={VIEW_MIN} y={VIEW_MIN} width={VIEW_SIZE} height={VIEW_SIZE} className="world-background" />
      <circle
        data-testid="goal"
        cx={goal.x}
        cy={goal.y}
        r={goalRadius}
        className="world-goal"
      />
      <g
        data-testid="sprite"
        transform={`translate(${spritePosition.x}, ${spritePosition.y}) rotate(${spriteHeading})`}
      >
        <polygon points="-2,-2 3,0 -2,2" className="world-sprite" />
      </g>
    </svg>
  );
}
