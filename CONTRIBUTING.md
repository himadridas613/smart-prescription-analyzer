# Contributing

Thanks for your interest in contributing to the Smart Prescription Analyzer!

## Getting started

1. Fork the repository and clone your fork.
2. Copy `.env.example` to `.env` and fill in your Supabase and OpenRouter keys.
3. Install dependencies with `bun install` (or `npm install`).
4. Apply the database migrations in `supabase/migrations` to your Supabase project.
5. Run `bun run dev` and open http://localhost:5173.

## Guidelines

- Follow the existing code style (`bun run lint` / `bun run format`).
- Do not commit `.env` files, secrets, or generated lockfile edits unrelated to dependency changes.
- This is a medical-adjacent tool: never invent analysis results and always surface model uncertainty.

## Pull requests

- Keep changes focused; one feature or fix per PR.
- Describe what you changed and why, and note any required setup steps.
