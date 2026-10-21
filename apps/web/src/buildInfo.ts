/**
 * Build identity shown in the app menu and served as `/version.json` (issue #342). Values are
 * injected by Vite (`define`) from package.json and the `GIT_SHA` build argument; outside Vite
 * (unit tests) the build reports itself as a development build.
 */
declare const __AGORIX_VERSION__: string | undefined;
declare const __AGORIX_SHA__: string | undefined;

export interface BuildInfo {
  readonly version: string;
  readonly sha: string;
}

export const BUILD_INFO: BuildInfo = {
  version: typeof __AGORIX_VERSION__ === "string" ? __AGORIX_VERSION__ : "dev",
  sha: typeof __AGORIX_SHA__ === "string" ? __AGORIX_SHA__ : "dev",
};

export function formatBuildInfo(info: BuildInfo): string {
  if (info.version === "dev") return "dev";
  const version = `v${info.version}`;
  return info.sha === "dev" || info.sha === "unknown"
    ? version
    : `${version} · ${info.sha.slice(0, 7)}`;
}
