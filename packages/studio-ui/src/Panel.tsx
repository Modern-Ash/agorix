import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { StudioUiLocale } from "./i18n.js";
import { PANEL_COPY } from "./panelCopy.js";
import {
  ZOOM_DEFAULT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  loadPanelLayout,
  reducePanelLayout,
  savePanelLayout,
  zoomOf,
  type PanelLayoutAction,
  type PanelLayoutState,
} from "./panelLayout.js";

export type PanelLayoutController = {
  readonly state: PanelLayoutState;
  readonly dispatch: (action: PanelLayoutAction) => void;
  readonly locale: StudioUiLocale;
};

const PanelLayoutContext = createContext<PanelLayoutController | undefined>(undefined);

/** Layout state for a group of panels; persisted per device under `scope`. */
export function usePanelLayoutController(
  scope: string,
  locale: StudioUiLocale = "es",
): PanelLayoutController {
  const [state, dispatch] = useReducer(reducePanelLayout, scope, loadPanelLayout);
  const hydrated = useRef(false);
  useEffect(() => {
    // Skip the first run so the initial (just loaded) state is not rewritten.
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    savePanelLayout(scope, state);
  }, [scope, state]);
  return useMemo(() => ({ state, dispatch, locale }), [state, dispatch, locale]);
}

/** The work area: a maximized panel fills this box, not the browser window. */
export function PanelWorkArea({
  controller,
  className,
  children,
}: {
  readonly controller: PanelLayoutController;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <PanelLayoutContext.Provider value={controller}>
      <div
        className={`agx-panel-workarea${className === undefined ? "" : ` ${className}`}`}
        data-maximized={controller.state.maximized ?? ""}
      >
        {children}
      </div>
    </PanelLayoutContext.Provider>
  );
}

function usePanelLayout(override?: PanelLayoutController): PanelLayoutController {
  const context = useContext(PanelLayoutContext);
  const controller = override ?? context;
  if (controller === undefined) {
    throw new Error("<Panel> must be rendered inside <PanelWorkArea>.");
  }
  return controller;
}

export type PanelProps = {
  readonly controller?: PanelLayoutController;
  readonly id: string;
  readonly title: string;
  readonly accent?: string;
  readonly zoomable?: boolean;
  readonly minimizable?: boolean;
  readonly maximizable?: boolean;
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
};

export function Panel({
  controller,
  id,
  title,
  accent = "#5B6475",
  zoomable = false,
  minimizable = false,
  maximizable = false,
  actions,
  className,
  children,
}: PanelProps) {
  const { state, dispatch, locale } = usePanelLayout(controller);
  const copy = PANEL_COPY[locale];
  const minimized = state.minimized.includes(id);
  const maximized = state.maximized === id;
  const zoom = zoomOf(state, id);
  const size = state.sizes[id];
  const maximizeButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const toggleMaximize = useCallback(() => {
    if (state.maximized !== id) {
      returnFocus.current = document.activeElement as HTMLElement | null;
    }
    dispatch({ type: "toggleMaximize", id });
  }, [dispatch, id, state.maximized]);

  // Esc restores a maximized panel. The listener is on the document so focus anywhere works,
  // and nothing is trapped: Tab still leaves the panel.
  useEffect(() => {
    if (!maximized) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch({ type: "restoreMaximized" });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [maximized, dispatch]);

  // Hand focus back to wherever it was before maximizing once the panel is restored.
  const wasMaximized = useRef(false);
  useEffect(() => {
    if (wasMaximized.current && !maximized) {
      const target = returnFocus.current ?? maximizeButton.current;
      target?.focus();
      returnFocus.current = null;
    }
    wasMaximized.current = maximized;
  }, [maximized]);

  const style: CSSProperties = {
    ["--panel-accent" as string]: accent,
    ...(size !== undefined && !maximized ? { flexBasis: size, flexGrow: 0 } : {}),
  };

  return (
    <section
      className={`agx-panel${maximized ? " agx-panel--maximized" : ""}${className === undefined ? "" : ` ${className}`}`}
      style={style}
      hidden={minimized}
      aria-labelledby={`agx-panel-title-${id}`}
      data-panel-id={id}
    >
      <header className="agx-panel-header">
        <span className="agx-panel-dot" aria-hidden="true" />
        <h2 id={`agx-panel-title-${id}`} className="agx-panel-title">
          {title}
        </h2>
        {actions === undefined ? null : <div className="agx-panel-actions">{actions}</div>}
        {zoomable ? (
          <div className="agx-panel-zoom" role="group">
            <button
              type="button"
              aria-label={copy.zoomOut(title)}
              disabled={zoom <= ZOOM_MIN}
              onClick={() => dispatch({ type: "zoomBy", id, delta: -ZOOM_STEP })}
            >
              <span aria-hidden="true">−</span>
            </button>
            <button
              type="button"
              className="agx-panel-zoom-value"
              aria-label={copy.zoomReset(title)}
              onClick={() => dispatch({ type: "zoomReset", id })}
            >
              {zoom} %
            </button>
            <button
              type="button"
              aria-label={copy.zoomIn(title)}
              disabled={zoom >= ZOOM_MAX}
              onClick={() => dispatch({ type: "zoomBy", id, delta: ZOOM_STEP })}
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
        ) : null}
        {minimizable ? (
          <button
            type="button"
            className="agx-panel-button"
            aria-label={copy.minimize(title)}
            onClick={() => dispatch({ type: "minimize", id })}
          >
            <span aria-hidden="true">–</span>
          </button>
        ) : null}
        {maximizable ? (
          <button
            ref={maximizeButton}
            type="button"
            className="agx-panel-button"
            aria-label={maximized ? copy.restoreSize(title) : copy.maximize(title)}
            aria-pressed={maximized}
            onClick={toggleMaximize}
          >
            <span aria-hidden="true">{maximized ? "❐" : "□"}</span>
          </button>
        ) : null}
      </header>
      <div
        className="agx-panel-body"
        style={
          zoomable && zoom !== ZOOM_DEFAULT ? ({ zoom: zoom / 100 } as CSSProperties) : undefined
        }
      >
        {children}
      </div>
    </section>
  );
}

/** Chips for minimized panels; one tap restores a panel to its slot. */
export function PanelDock({
  panels,
  controller,
}: {
  readonly controller?: PanelLayoutController;
  readonly panels: readonly {
    readonly id: string;
    readonly title: string;
    readonly accent?: string;
  }[];
}) {
  const { state, dispatch, locale } = usePanelLayout(controller);
  const copy = PANEL_COPY[locale];
  const items = panels.filter((panel) => state.minimized.includes(panel.id));
  if (items.length === 0) return null;
  return (
    <nav className="agx-panel-dock" aria-label={copy.dock}>
      {items.map((panel) => (
        <button
          key={panel.id}
          type="button"
          className="agx-panel-chip"
          aria-label={copy.restoreFromDock(panel.title)}
          style={{ ["--panel-accent" as string]: panel.accent ?? "#5B6475" }}
          onClick={() => dispatch({ type: "restore", id: panel.id })}
        >
          <span className="agx-panel-dot" aria-hidden="true" />
          {panel.title}
        </button>
      ))}
    </nav>
  );
}

const DIVIDER_STEP = 16;

/** Draggable (pointer) and keyboard-resizable divider that resizes panel `id`. */
export function PanelDivider({
  id,
  title,
  orientation = "vertical",
  size,
  direction = 1,
}: {
  readonly id: string;
  readonly title: string;
  /** "vertical" divider sits between side-by-side panels and changes width. */
  readonly orientation?: "vertical" | "horizontal";
  /** Current size in px of the panel being resized (its measured size when unset in state). */
  readonly size: () => number;
  /** 1 when growing the panel means dragging toward the end; -1 for the opposite. */
  readonly direction?: 1 | -1;
}) {
  const { dispatch, locale } = usePanelLayout();
  const copy = PANEL_COPY[locale];
  const drag = useRef<{ start: number; base: number } | undefined>(undefined);
  const axis = orientation === "vertical" ? "clientX" : "clientY";

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { start: event[axis], base: size() };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === undefined) return;
    const delta = (event[axis] - drag.current.start) * direction;
    dispatch({ type: "setSize", id, size: drag.current.base + delta });
  };
  const onPointerUp = () => {
    drag.current = undefined;
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const grow = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
    const shrink = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
    if (event.key !== grow && event.key !== shrink) return;
    event.preventDefault();
    const step = (event.key === grow ? DIVIDER_STEP : -DIVIDER_STEP) * direction;
    dispatch({ type: "setSize", id, size: size() + step });
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={orientation}
      aria-label={copy.resize(title)}
      className={`agx-panel-divider agx-panel-divider--${orientation}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  );
}
