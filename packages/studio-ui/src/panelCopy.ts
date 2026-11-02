import type { StudioUiLocale } from "./i18n.js";

export const PANEL_COPY = {
  en: {
    minimize: (title: string) => `Minimize ${title}`,
    maximize: (title: string) => `Maximize ${title}`,
    restoreSize: (title: string) => `Restore ${title}`,
    restoreFromDock: (title: string) => `Restore ${title} from the dock`,
    zoomOut: (title: string) => `Zoom out ${title}`,
    zoomIn: (title: string) => `Zoom in ${title}`,
    zoomReset: (title: string) => `Reset zoom of ${title} to 100%`,
    dock: "Minimized panels",
    resize: (title: string) => `Resize ${title}`,
  },
  es: {
    minimize: (title: string) => `Minimizar ${title}`,
    maximize: (title: string) => `Maximizar ${title}`,
    restoreSize: (title: string) => `Restaurar ${title}`,
    restoreFromDock: (title: string) => `Restaurar ${title} desde la barra`,
    zoomOut: (title: string) => `Alejar ${title}`,
    zoomIn: (title: string) => `Acercar ${title}`,
    zoomReset: (title: string) => `Volver ${title} al 100 %`,
    dock: "Paneles minimizados",
    resize: (title: string) => `Cambiar el tamaño de ${title}`,
  },
} as const satisfies Record<StudioUiLocale, unknown>;
