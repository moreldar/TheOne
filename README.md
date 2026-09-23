# MemoryCanvas

AI photo gift platform MVP: upload a photo → pick an AI illustration style →
get an instant watermarked AI preview → approve → order it printed on
physical products (canvas prints, mugs) shipped as a gift.

This is a **generate-before-you-pay** funnel. One AI generation is reusable
across multiple physical products in the same cart.

## Decisions baked into this scaffold

These were called out in the spec as "decide upfront" items:

- **Object storage**: Cloudflare R2 by default (S3-compatible API). The
  storage client (`src/lib/storage`) is a thin wrapper over
  `@aws-sdk/client-s3`, so switching to AWS S3 is just env vars
  (`STORAGE_PROVIDER=s3`, `STORAGE_ENDPOINT`, `STORAGE_REGION`) — no code
  changes.
- **Database host**: any managed Postgres works (Neon, Supabase, RDS) —
  everything goes through `DATABASE_URL` and Prisma.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- PostgreSQL via Prisma ORM
- BullMQ + Redis for async AI generation jobs (standalone worker process)
- Auth.js (NextAuth v5) with guest checkout supported
- Stripe Checkout Sessions + webhooks
- S3-compatible object storage behind a CDN
- Vitest for unit tests

## Provider abstraction

Four external integrations are stubbed behind clean interfaces so real
providers can be wired in later without touching call sites:

| Interface | File | Default | Also available | Still stubbed |
|---|---|---|---|---|
| `GenerationProvider` | `src/lib/providers/generation` | `mockProvider` (watermarks whatever you upload, no real transformation) | `geminiProvider` (Gemini "Nano Banana" — needs billing enabled, free tier's image quota is 0) or `replicateProvider` (any open-source image-editing model hosted on Replicate, e.g. Qwen-Image-Edit — no billing account needed, pay-per-run) — both do **real image-to-image editing** | self-hosted Qwen-Image-Edit (the spec's original primary choice — `replicateProvider` runs the same open-source model hosted, without a GPU server) |
| `ModerationProvider` | `src/lib/providers/moderation` | `passthroughProvider` (always approves, logs a TODO) | — | AWS Rekognition or Hive |
| `FulfillmentProvider` | `src/lib/providers/fulfillment` | `stubFulfillmentProvider` (logs + marks accepted) | — | Printful |
| `NotificationProvider` | `src/lib/providers/notification` | `consoleNotificationProvider` (logs instead of sending) | — | Resend or Postmark |

Each still-stubbed file has a `TODO(real-integration)` comment describing
exactly what to change. Provider selection is via env var
(`GENERATION_PROVIDER`, `MODERATION_PROVIDER`, `FULFILLMENT_PROVIDER`,
`NOTIFICATION_PROVIDER`), so swapping providers never requires touching
calling code.

## Getting started

You need Node.js 20+, Postgres, and Redis. `docker-compose.yml` in this
repo gives you the latter two with one command — see the Windows
quickstart below if you're starting from a completely bare machine.

```bash
docker compose up -d   # Postgres + Redis, matches .env.example out of the box

cp .env.example .env
# set STORAGE_PROVIDER="local" to skip needing R2/S3 credentials (see below)

pnpm install
pnpm prisma:migrate   # creates tables
pnpm prisma:seed      # seeds ~12 styles + 2 products

pnpm dev              # web app on :3000
pnpm worker:dev        # generation worker, separate process — required for
                        # generations to actually complete
```

Open `http://localhost:3000`.

If `pnpm install` ever stops with `ERR_PNPM_IGNORED_BUILDS`, run
`pnpm approve-builds --all --yes` once and retry — `pnpm-workspace.yaml`
in this repo already pre-approves Prisma's and sharp's native build
scripts, but very old pnpm versions may not read that file and need the
one-time manual approval instead.

### Windows quickstart (PowerShell, starting from nothing)

```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install Docker.DockerDesktop
```

Close and reopen PowerShell after each install so `PATH` picks up the new
tools (`node -v`, `git --version`, `docker --version` should all work).
Docker Desktop needs to actually be launched once (it may prompt to enable
WSL2 — accept that, it's a one-time setup) before `docker` commands work.

```powershell
git clone https://github.com/moreldar/TheOne.git
cd TheOne
npm install -g pnpm
docker compose up -d
copy .env.example .env
```

Then edit `.env` in a text editor and set `STORAGE_PROVIDER="local"`.
Continue with the `pnpm install` / `pnpm prisma:migrate` / `pnpm prisma:seed`
/ `pnpm dev` steps above (run `pnpm worker:dev` in a second PowerShell
window, not `&`, since Windows doesn't background jobs the same way).

### Testing the funnel without cloud storage or a Stripe account

Set `STORAGE_PROVIDER="local"` in `.env` and the app writes uploads and
generated images straight into `public/uploads` / `public/generations`
instead of calling S3 — no R2/AWS credentials needed. This is dev/test only
(see `src/lib/storage/localProvider.ts`); switch it back to `"r2"` or
`"s3"` before deploying.

With `GENERATION_PROVIDER=mock` (the default) and local storage, you can
walk the entire upload → style → generate → preview → cart flow with zero
external accounts.

Real Stripe Checkout needs a Stripe account (`STRIPE_SECRET_KEY`), since
that call goes to Stripe's API. Until you have one, **the cart page shows
a "Use the test checkout" link** (visible whenever `NODE_ENV !== "production"`,
which is always true under `next dev`) that takes you to `/checkout/test` —
a plain form collecting a shipping address, no payment step. Submitting it
runs the exact same order-creation code path as a real Stripe webhook
(`src/lib/orders/createOrderFromCart.ts`, shared by both):  it creates a
real `PAID` → `IN_PRODUCTION` order, clears the cart, fires the
`order_confirmed`/`order_in_production` notifications, and hands off to
the `FulfillmentProvider` — then lands you on the real order-status page.
This route 404s in any real production build/deploy (Next.js forces
`NODE_ENV=production` there regardless of `.env`), so it's not something
you can accidentally ship live.

Stripe webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## Funnel overview

1. **Upload & consent** — `/upload`. Consent + 18+ age-gate checkboxes are
   mandatory before the file is accepted. Upload goes to object storage;
   an `Upload` row is created with `moderationStatus = PENDING`.
2. **Style selection** — `/styles/[uploadId]`. Curated styles only (seeded
   in `prisma/seed.ts`), plus an optional 150-character note.
3. **Generation** — enqueues a BullMQ job. The worker (`src/worker`) calls
   the active `GenerationProvider`, retries up to 3 times with exponential
   backoff, and writes the result back to the `Generation` row. The
   frontend polls `GET /api/generations/[id]`.
4. **Preview & approval** — `/generate/[generationId]`. Shows a
   watermarked, downscaled preview only. The print-master image is never
   exposed pre-purchase. Regeneration is capped by `FREE_GENERATION_CAP`
   per guest session/IP (`src/lib/rateLimit.ts`), after which email capture
   is required.
5. **Product selection & cart** — `/cart`. One generation can back
   multiple cart items (canvas print, mug, ...).
6. **Checkout** — Stripe Checkout Session, guest-friendly, collects
   shipping address. `POST /api/webhooks/stripe` handles
   `checkout.session.completed` idempotently (unique constraint on the
   Stripe session id) and creates `Order` + `OrderItem` rows, then hands
   off to the `FulfillmentProvider`.
7. **Order status & email** — `/orders/[orderId]` (guest access via a
   signed token in the confirmation email, or account order history).
   `NotificationProvider` stub fires on order confirmed / in production /
   shipped.
8. **Admin** — `/admin` (allow-listed via `ADMIN_EMAILS`). Moderation
   queue, order list, style/product CRUD.

## Analytics

Funnel events are tracked via `src/lib/analytics/track.ts`, which today
just logs to console + writes an `AnalyticsEvent` row. Swap the body of
`track()` for a real analytics tool later; call sites don't change.

## Tests

```bash
pnpm test
```

Covers the `Generation` and `Order` status state machines
(`src/lib/stateMachines`) and Stripe webhook idempotency.

## What's intentionally NOT built yet

- Real calls to Qwen/Gemini, Printful, Rekognition/Hive, Resend/Postmark,
  live Stripe keys — all stubbed behind the interfaces above.
- Open-ended AI prompt box — styles are curated/admin-managed only.
- Polished admin UI — functional only.
