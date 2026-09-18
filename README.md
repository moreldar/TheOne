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

| Interface | File | Stub today | Wire in later |
|---|---|---|---|
| `GenerationProvider` | `src/lib/providers/generation` | `mockProvider` (returns the source image, tinted, as a fake "generation") | self-hosted Qwen-Image-Edit (primary), Gemini/Nano Banana image API (fallback) |
| `ModerationProvider` | `src/lib/providers/moderation` | `passthroughProvider` (always approves, logs a TODO) | AWS Rekognition or Hive |
| `FulfillmentProvider` | `src/lib/providers/fulfillment` | `stubFulfillmentProvider` (logs + marks accepted) | Printful |
| `NotificationProvider` | `src/lib/providers/notification` | `consoleNotificationProvider` (logs instead of sending) | Resend or Postmark |

Each stub file has a `TODO(real-integration)` comment describing exactly
what to change. Provider selection is via env var (`GENERATION_PROVIDER`,
`MODERATION_PROVIDER`, `FULFILLMENT_PROVIDER`, `NOTIFICATION_PROVIDER`), so
swapping providers never requires touching calling code.

## Getting started

```bash
cp .env.example .env
# fill in DATABASE_URL, REDIS_URL, storage + Stripe keys (test keys are fine)

pnpm install
pnpm prisma:migrate   # creates tables
pnpm prisma:seed      # seeds ~12 styles + 2 products

pnpm dev              # web app on :3000
pnpm worker:dev        # generation worker, separate process
```

You need a local (or hosted) Postgres and Redis reachable at
`DATABASE_URL` / `REDIS_URL`. For local dev:

```bash
redis-server &
# createdb memorycanvas, or point DATABASE_URL at a hosted instance
```

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
