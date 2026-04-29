import { API_URL, DESKTOP_API_KEY } from "./env";
import { getSession } from "./auth";

function apiHeaders(): Record<string, string> {
  const session = getSession();
  const headers: Record<string, string> = {
    "x-user-id": session?.user_id ?? "",
  };
  if (DESKTOP_API_KEY) {
    headers["x-desktop-api-key"] = DESKTOP_API_KEY;
  }
  return headers;
}

/**
 * Call the AutoGM web API. Adds auth headers from the current session.
 */
export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new Error("API_URL is not configured");
  const res = await fetch(`${API_URL}${path}`, {
    headers: apiHeaders(),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error("API_URL is not configured");
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...apiHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}
