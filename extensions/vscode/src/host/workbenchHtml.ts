import { WORKBENCH_CSS } from "@agorix/studio-ui/src/styles.js";

/** Pure HTML builder so the CSP can be asserted without a VS Code runtime. */
export function workbenchHtml(token: string, cspSource: string, scriptUri: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${token}'; script-src 'nonce-${token}' ${cspSource};" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agorix Workbench</title><style nonce="${token}">${WORKBENCH_CSS}</style></head>
<body><div id="root"></div><script nonce="${token}" src="${scriptUri}"></script></body></html>`;
}
