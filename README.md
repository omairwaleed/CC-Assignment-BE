# craft-crew-be

NestJS + Prisma + Supabase backend. Follows the same structure/conventions as SFL-BE.

## Stack

- **NestJS 11** — HTTP layer, DI, guards
- **Prisma 7** with `@prisma/adapter-pg` — Postgres access (Supabase DB)
- **Supabase Auth** (`@supabase/supabase-js`, service-role key) — token verification + password login
- **Swagger** — served at `/api-docs`

## Setup

1. Install dependencies:

   ```
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in the Supabase values:

   ```
   DATABASE_URL=...   # pooled (pgbouncer) connection — used at runtime
   DIRECT_URL=...      # direct connection — used by prisma migrate / db push
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   PORT=3000
   ```

3. Generate the Prisma client:

   ```
   npm run prisma:generate
   ```

4. Push the schema to the database:

   ```
   npm run prisma:push
   ```

5. Start the dev server:

   ```
   npm run start:dev
   ```

- API docs: https://cc-assignment-be.onrender.com/api-docs

## Data model

| Entity          | Fields                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `Doctor`        | id, name                                                                                              |
| `Appointment`   | id, patientName, doctorId, startsAt, **endsAt**, status, reason, createdAt, updatedAt                  |
| `ImagingStudy`  | id, appointmentId, modality, description, dicomFilePath                                                |

Appointment status: `scheduled`, `checked_in`, `completed`, `cancelled` (Prisma enum `AppointmentStatus`).

## Auth

- `POST /auth/login` — `{ email, password }` → Supabase session (`accessToken`, `refreshToken`, `user`).
- `GET /auth/me` — returns the authenticated user (requires `Authorization: Bearer <accessToken>`).
- `SupabaseAuthGuard` — verifies the bearer token (or `access-token` cookie) via `supabase.auth.getUser()` and attaches `req.authUser`.

All `doctors`, `appointments`, and `imaging-studies` routes are behind `SupabaseAuthGuard`.
