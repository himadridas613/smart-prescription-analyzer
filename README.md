<<<<<<< HEAD
# MediScan AI — Smart Prescription Analyzer

An AI-powered healthcare SaaS that reads handwritten and printed prescriptions, extracts
structured medicine data with a vision-language model, and flags dosage risks, duplicate
therapies, and drug–drug interactions before they reach the patient.

![Tech stack](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![TanStack Start](https://img.shields.io/badge/TanStack%20Start-SSR-red) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ecf8e) ![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Prescription OCR** — upload images (camera, drag & drop) or PDFs; a vision model extracts patient/doctor names, medicines, dosage, frequency, duration, and instructions.
- **Safety analysis** — duplicate-therapy detection, drug–drug interaction warnings, dosage risk notes, overall risk level, and a confidence score.
- **Reports** — save, print, download, and securely share reports via expiring view-only links.
- **Upload history** — searchable history with processing status and one-click re-analysis.
- **Role-based dashboards** — User, Doctor, Pharmacist, and Admin panels with route-level RBAC.
- **Admin suite** — analytics, user/role management, OCR & AI monitoring, system logs.
- **Auth** — email + password with OTP email verification, Google OAuth, forgot/reset password, optional email 2FA with backup codes.
- **Notification center** — analysis progress, shares, and security alerts.

## Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Framer Motion, TanStack Router/Query/Start (SSR) |
| Backend   | TanStack Start server functions, Supabase (Postgres, Auth, Storage, Edge Functions) |
| AI        | OpenRouter (OpenAI-compatible API) with a vision model — `google/gemini-2.5-flash` by default (free tier) |
| Database  | PostgreSQL with RLS migrations in `supabase/migrations` |

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js 22+)
- A free [Supabase](https://supabase.com/) project
- A free [OpenRouter](https://openrouter.ai/) API key

### Setup

```sh
git clone https://github.com/your-username/smart-prescription-analyzer.git
cd smart-prescription-analyzer

# 1. Configure environment
cp .env.example .env
#    fill in SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY and OPENROUTER_API_KEY

# 2. Install dependencies (regenerates the lockfile)
bun install

# 3. Database
#    In Supabase -> SQL Editor, run the migrations in supabase/migrations in order.

# 4. Auth providers (optional but recommended)
#    Supabase -> Authentication -> Providers -> Enable Google OAuth,
#    and add your site URL + redirect URLs to Authentication -> URL Configuration.

# 5. Run
bun run dev
```

Open http://localhost:5173.

### Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start the dev server |
| `bun run build` | Production build (Nitro) |
| `bun run preview` | Preview the production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Environment variables

See [.env.example](.env.example). Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`,
`OPENROUTER_API_KEY`) are never exposed to the browser.

## Project structure

```
src/
  router/            # Routes (landing, auth, dashboards, admin)
  components/        # UI components (shadcn/ui) and feature components
  integrations/
    auth/            # Google OAuth via Supabase Auth
    supabase/        # Supabase clients + auth middleware
  lib/               # Server functions (analysis, reports, sharing, admin)
supabase/migrations/ # Database schema
```

## Security notes

- Row Level Security (RLS) on all user tables; admin operations use the service-role key server-side only.
- Protected routes enforced by a server auth middleware, not just the client.
- Share links use unguessable tokens with expiry; view-only.

## Disclaimer

This tool assists with prescription review and is **not** a substitute for professional
medical advice, diagnosis, or treatment. Always confirm medication decisions with a
qualified doctor or pharmacist.

## License

[MIT](LICENSE)
=======
# smart-prescription-analyzer
AI-powered Smart Prescription Analyzer built with React, Supabase, PostgreSQL, and Gemini Vision to extract handwritten prescription data, generate intelligent medicine reports, and securely manage healthcare records.
>>>>>>> 83dcbe90b78c0fc9310ead67b4b21e2d01d63e9f
