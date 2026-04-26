import { API_URL } from "./env";
import { getSession } from "./auth";

/**
 * Call the Sleepier web API. Adds the x-user-id header from the current session.
 */
export async function apiGet<T>(path: string): Promise<T> {
  if (!API_URL) throw new Error("API_URL is not configured");
  const session = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "x-user-id": session?.user_id ?? "",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  if (!API_URL) throw new Error("API_URL is not configured");
  const session = getSession();
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": session?.user_id ?? "",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}
