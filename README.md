# Japanese Cards (jpcards)

A monorepo for a Japanese learning web app: AI-assisted vocabulary cards, study history, and authentication. The stack is a **React** single-page app, a **Hono** API intended for **Cloudflare Workers** (D1, R2, static assets), and shared TypeScript types.

## Repository layout

| Package | Description |
|--------|-------------|
| `packages/frontend` | Vite + React + Tailwind UI |
| `packages/backend` | Hono API, Drizzle ORM (D1), Better Auth, integrations (LLM, TTS, image) |
| `packages/shared` | Shared type definitions |

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [pnpm](https://pnpm.io/) 8+

## Install

From the repository root:

```bash
pnpm install
```

## Environment variables

Copy the backend template and fill in the values:

```bash
cp packages/backend/.env.template packages/backend/.env
```

`packages/backend/.env.template` documents:

- **Better Auth** — `BETTER_AUTH_SECRET`
- **Chat / LLM** — `CHAT_API_KEY`, `CHAT_API_ENDPOINT`
- **Volcengine** (image) — `VOLC_API_AK`, `VOLC_API_SK`
- **MiniMax** (TTS) — `MINIMAX_*`
- **Cloudflare** — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`
- **R2 (S3-compatible)** — `S3_*`, `S3_PUBLIC_URL`

The Worker `Env` bindings (D1 `DB`, R2, `ASSETS`) are defined in `packages/backend/src/types.ts` for deployed or Wrangler-based runs.

## Scripts

**Root**

| Command | Purpose |
|---------|---------|
| `pnpm format` | Format with [dprint](https://dprint.dev/) |
| `pnpm format:check` | Check formatting |

**Frontend** (`packages/frontend`)

| Command | Purpose |
|---------|---------|
| `pnpm --filter @jpcards/frontend dev` | Vite dev server (proxies `/api` to `http://localhost:8000`) |
| `pnpm --filter @jpcards/frontend build` | Production build |
| `pnpm --filter @jpcards/frontend lint` | ESLint |

**Backend** (`packages/backend`)

| Command | Purpose |
|---------|---------|
| `pnpm --filter @jpcards/backend test` | Vitest |
| `pnpm --filter @jpcards/backend build` | TypeScript compile + asset prep |
| `pnpm --filter @jpcards/backend db:push` | Drizzle push to configured database |
| `pnpm --filter @jpcards/backend db:studio` | Drizzle Studio |

## Local development

1. Install dependencies and configure `packages/backend/.env`.
2. Run the API so it listens on **port 8000** (the Vite dev proxy expects this). With Cloudflare Workers, that usually means `wrangler dev` (or your own adapter) with the correct bindings and port.
3. In another terminal, start the frontend:

   ```bash
   pnpm --filter @jpcards/frontend dev
   ```

Open the URL printed by Vite (typically `http://localhost:5173`). Authenticated routes include Explore, History, Friends, and Settings; login and sign-up are public.

## License

ISC (see root `package.json`).

## Links

- [Issues](https://github.com/nick-ChenZe/jpcards/issues)
- [Repository](https://github.com/nick-ChenZe/jpcards)
