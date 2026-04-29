# AutoGM

Fantasy football automation tool built on top of the [Sleeper](https://sleeper.com) platform. Monorepo powered by pnpm workspaces and Turborepo.

## Structure

```
apps/desktop    Electron + Next.js desktop app (Nextron)
apps/mobile     React Native mobile app (Expo)
apps/web        Next.js landing page + KTC/ADP API
packages/shared TypeScript library shared between apps
```

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 10
- **PostgreSQL** (desktop and web API, for KTC/ADP features)
- **Google Chrome** (desktop login uses `playwright-core` which requires a locally installed browser; set `PW_CHANNEL=chrome` or `PW_CHANNEL=chromium`)

## Setup

```bash
pnpm install
```

**Important:** `@autogm/shared` must be built before running any app:

```bash
pnpm --filter @autogm/shared build
```

This happens automatically via Turbo when using `pnpm dev`, but direct commands like `pnpm --filter autogm-mobile dev` require it to be built first.

### Environment variables

**Desktop** — create `apps/desktop/.env`:

```env
API_URL=http://localhost:3100   # URL of the web API (serves KTC/ADP/opponent data)
ALLOWLIST_URL=https://example.com/allowlist.json
DESKTOP_API_KEY=your-shared-secret  # must match the web API's DESKTOP_API_KEY
LOG_LEVEL=info          # debug | info | warn | error
LOGIN_URL=              # optional, defaults to https://sleeper.com/login
PW_CHANNEL=chrome       # browser channel for playwright-core (chrome, chromium, msedge)
```

> `DATABASE_URL` is **not** needed in the desktop `.env`. The desktop app calls the web API via `API_URL` for KTC/ADP/opponent data.

**Web API** — create `apps/web/.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/autogm
ALLOWLIST_URL=https://example.com/allowlist.json
DESKTOP_API_KEY=your-shared-secret  # must match the desktop's DESKTOP_API_KEY
```

**Mobile** — set in your Expo environment or `app.json`:

```env
EXPO_PUBLIC_ALLOWLIST_URL=https://example.com/allowlist.json
```

If `ALLOWLIST_URL` / `EXPO_PUBLIC_ALLOWLIST_URL` is not set, all users are allowed.

`DATABASE_URL` is only required when using KTC/ADP features. Desktop and web start without it.

`ALLOWLIST_URL` must return `{ "allowed_user_ids": ["123", ...] }`.

## Development

```bash
# All apps
pnpm dev

# Desktop only
pnpm dev:desktop

# Mobile only
pnpm dev:mobile

# Web only
pnpm dev:web
```

## Commands

```bash
pnpm typecheck       # tsc --noEmit across all packages
pnpm test            # vitest in shared
pnpm lint            # eslint across all packages
pnpm build           # production build for all packages
```

### Desktop build

```bash
pnpm --filter autogm-desktop build
```

Output goes to `apps/desktop/dist/`.

### Web build

```bash
pnpm --filter autogm-web build
```

### Mobile build

Mobile builds are handled through Expo / EAS:

```bash
pnpm --filter autogm-mobile dev        # start Expo dev server
pnpm --filter autogm-mobile typecheck  # type-check mobile code
```

### Shared package

```bash
pnpm --filter @autogm/shared build     # compile to dist/
pnpm --filter @autogm/shared test      # run vitest
pnpm --filter @autogm/shared typecheck # tsc --noEmit
```

## Architecture notes

- **Shared package** exports types, GraphQL queries, auth context, API helpers, DB query modules, `CURRENT_SEASON`, and `randomId()`.
- **Desktop main process** handles IPC with auth guards (`requireAccess()`), lazy DB imports, mutation idempotency, and dedicated mutation routes.
- **Desktop preload** exposes a whitelisted `window.ipc.invoke()` API (no open channel access).
- **Desktop session** persists encrypted via `electron safeStorage` (with `enc:`/`plain:` prefix) and restores after `app.whenReady()`.
- **Mobile** uses `expo-secure-store` for token persistence, `AsyncStorage` for poll storage and operation idempotency, and guards app routes with allowlist access checks.
- **Mobile league cache** fetches leagues once at the app level and shares across all tabs.
- **Web** serves a static landing page with download links and server-side API routes for KTC/ADP data (requires `x-user-id` header validated against allowlist).
