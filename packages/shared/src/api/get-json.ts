import { BROWSER_HEADERS } from '../browser-headers'

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    throw new Error(`GET ${url} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
