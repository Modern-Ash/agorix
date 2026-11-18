import { blockIdForNode } from "@agorix/block-editor";
import type { HostMessage } from "@agorix/studio-protocol";

type Frame = Extract<HostMessage, { type: "stageFrame" }>["frame"];

export interface ValuePoint {
  readonly frameIndex: number;
  readonly step: number;
  readonly value: number;
}

export interface DebugSnapshot {
  readonly frameIndex: number;
  readonly step: number;
  readonly values: Readonly<Record<string, number>>;
  readonly history: Readonly<Record<string, readonly ValuePoint[]>>;
}

export interface DebugAdvance {
  readonly snapshot: DebugSnapshot;
  readonly changedVariableIds: readonly string[];
  readonly breakpointBlockId?: string;
}

/** Records only runtime values; breakpoints and watches never mutate the program. */
export function advanceDebugSession(
  previous: DebugSnapshot | undefined,
  frame: Frame,
  breakpointBlockIds: ReadonlySet<string>,
): DebugAdvance {
  if (previous !== undefined && previous.frameIndex === frame.frameIndex)
    return { snapshot: previous, changedVariableIds: [] };
  const earlier =
    previous !== undefined && frame.frameIndex > previous.frameIndex ? previous : undefined;
  const values = Object.fromEntries(
    (frame.state.variables ?? []).map(({ id, value }) => [id, value]),
  );
  const history: Record<string, readonly ValuePoint[]> = {};
  const changedVariableIds: string[] = [];
  for (const [id, value] of Object.entries(values)) {
    const oldValue = earlier?.values[id];
    const oldHistory = earlier?.history[id] ?? [];
    const changed = oldValue !== undefined && oldValue !== value;
    if (changed) changedVariableIds.push(id);
    history[id] =
      oldValue === undefined || changed
        ? [...oldHistory, { frameIndex: frame.frameIndex, step: frame.step, value }]
        : oldHistory;
  }
  const blockId =
    frame.highlightedNodeId === undefined ? undefined : blockIdForNode(frame.highlightedNodeId);
  const breakpointBlockId =
    blockId !== undefined &&
    breakpointBlockIds.has(blockId) &&
    (earlier === undefined ||
      earlier.step !== frame.step ||
      (earlier.frameIndex === 0 && frame.frameIndex === 1))
      ? blockId
      : undefined;
  return {
    snapshot: { frameIndex: frame.frameIndex, step: frame.step, values, history },
    changedVariableIds,
    ...(breakpointBlockId === undefined ? {} : { breakpointBlockId }),
  };
}
