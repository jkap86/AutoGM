import Store from 'electron-store'

type CacheEntry = {
  data: unknown
  updated_at: number
}

type CacheStore = {
  entries: { [key: string]: CacheEntry }
}

const store = new Store<CacheStore>({
  name: 'cache',
  defaults: { entries: {} },
})

// Note: JSON.stringify is not deterministic for objects with different key
// orders. Vars are typically simple flat objects so this is fine in practice.
function makeKey(key: unknown[]): string {
  return JSON.stringify(key)
}

export async function cached<T>(
  key: unknown[],
  ttlMs: number,
  load: () => Promise<T>
): Promise<T> {
  const k = makeKey(key)
  // NOTE: do not use `store.get('entries.${k}')` here — electron-store uses
  // dot-prop, and our keys contain brackets/quotes from JSON.stringify, which
  // dot-prop misinterprets as array-index syntax. Read the whole map instead.
  const entries = store.get('entries')
  const hit = entries[k]

  if (hit && hit.updated_at > Date.now() - ttlMs) {
    return hit.data as T
  }

  const data = await load()
  store.set('entries', {
    ...store.get('entries'),
    [k]: { data, updated_at: Date.now() },
  })
  return data
}

export function invalidate(keyPrefix: unknown[]) {
  // Strip the closing bracket so the prefix matches any longer key array.
  const prefix = makeKey(keyPrefix).slice(0, -1)
  const entries = store.get('entries')
  const next = Object.fromEntries(
    Object.entries(entries).filter(([k]) => !k.startsWith(prefix))
  )
  store.set('entries', next)
}

export function clearCache() {
  store.set('entries', {})
}
