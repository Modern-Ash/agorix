import { withAgorixSessionQueue } from "../../accounts/sessionRequestQueue.js";

async function post(
  path: string,
  fetchImpl: typeof fetch,
  body = "{}",
  timeoutMs = 10000,
): Promise<Response | null> {
  return withAgorixSessionQueue(async () => {
    try {
      return await fetchImpl(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "x-agorix-request": "1" },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return null;
    }
  });
}

/** The server selects the one authorized project; the browser cannot nominate one. */
export async function oriKidsPilotProject(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const response = await post("/api/tutor/ori/pilot/project", fetchImpl);
  if (!response?.ok) return null;
  try {
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const value = raw as Record<string, unknown>;
    return Object.keys(value).length === 1 &&
      typeof value["projectId"] === "string" &&
      value["projectId"].length > 0 &&
      value["projectId"].length <= 128
      ? value["projectId"]
      : null;
  } catch {
    return null;
  }
}

export async function recordOriKidsPilotRun(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const response = await post("/api/tutor/ori/evidence/run", fetchImpl);
  return response?.ok ?? false;
}

export async function requestOriKidsPilotHint(
  fetchImpl: typeof fetch = fetch,
  expectedLevel?: number,
): Promise<{ readonly level: number; readonly text: string } | null> {
  const response = await post(
    "/api/tutor/ori/evidence/hint",
    fetchImpl,
    expectedLevel === undefined ? "{}" : JSON.stringify({ expectedLevel }),
    2500,
  );
  if (!response?.ok) return null;
  try {
    const raw: unknown = await response.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const hint = raw as Record<string, unknown>;
    return Object.keys(hint).sort().join() === "level,text" &&
      Number.isSafeInteger(hint["level"]) &&
      Number(hint["level"]) >= 1 &&
      Number(hint["level"]) <= 5 &&
      typeof hint["text"] === "string" &&
      hint["text"].length > 0 &&
      hint["text"].length <= 1000
      ? { level: Number(hint["level"]), text: hint["text"] }
      : null;
  } catch {
    return null;
  }
}
