# Sleepier

Fantasy football automation tool built on top of the [Sleeper](https://sleeper.com) platform. Monorepo powered by pnpm workspaces and Turborepo.

## Structure

```
apps/desktop    Electron + Next.js desktop app (Nextron)
apps/mobile     React Native mobile app (Expo)
packages/shared TypeScript library shared between apps
```

## Prerequisites

- **Node.js** >= 18
- **pnpm** >= 10
- **PostgreSQL** (desktop only, for KTC/ADP features)
- **Playwright** Chromium (installed automatically for desktop login flow)

## Setup

```bash
pnpm install
```

### Environment variables

Create `apps/desktop/.env`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/sleepier
ALLOWLIST_URL=https://example.com/allowlist.json
LOG_LEVEL=info          # debug | info | warn | error
LOGIN_URL=              # optional, defaults to https://sleeper.com/login
PW_CHANNEL=             # optional, chrome or chromium for Playwright
```

`DATABASE_URL` is only required when using KTC/ADP features. The app starts without it.

`ALLOWLIST_URL` must return `{ "allowed_user_ids": ["123", ...] }`.

## Development

```bash
# All apps
pnpm dev

# Desktop only
pnpm dev:desktop

# Mobile only
pnpm dev:mobile
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
pnpm --filter sleepier-desktop build
```

Output goes to `apps/desktop/dist/`.

### Shared package

```bash
pnpm --filter @sleepier/shared build     # compile to dist/
pnpm --filter @sleepier/shared test      # run vitest
pnpm --filter @sleepier/shared typecheck # tsc --noEmit
```

## Architecture notes

- **Shared package** exports types, GraphQL queries, auth context, API helpers, and the `CURRENT_SEASON` constant.
- **Desktop main process** handles IPC with auth guards (`requireAccess()`), lazy DB imports, and mutation idempotency.
- **Desktop preload** exposes a whitelisted `window.ipc.invoke()` API (no open channel access).
- **Desktop session** persists to `electron-store` and restores on app restart.
- **Mobile auth** uses `expo-secure-store` for token persistence and guards app routes with `useAuth()`.
