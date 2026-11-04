## Smart Prescription Analyzer — Build Plan

The current project is a blank TanStack Start template (only the placeholder `/` route exists). There is no existing UI, auth, database, or AI wiring to preserve — I'll build the full app from the template. Given the scope (auth + OTP + RBAC + uploads + Gemini OCR + reports + sharing + 4 dashboards + 2FA + notifications + landing page), this needs to ship in phases.

### Phase 1 — Foundation (this turn)
1. Enable **Supabase Cloud** — required for auth, DB, storage, edge functions.
2. Provision an **OpenRouter API key** (`OPENROUTER_API_KEY`) for Gemini Vision OCR (`google/gemini-2.5-flash` image understanding via chat completions with a vision-capable model).
3. **Design system** in `src/styles.css` — white + blue gradient, glassmorphism tokens, healthcare SaaS look, dark mode.
4. **Landing page** at `/` — Hero, Features, How It Works, Benefits, Testimonials, Pricing, FAQ, Contact, Footer with Framer Motion.
5. **Auth pages** at `/auth` — Email signup (with role selector: user/doctor/pharmacist), login, Google OAuth, forgot password, `/reset-password`, email OTP verification screen (resend after 60s, 10-min expiry — Supabase built-in email OTP).
6. **Database schema** (single migration):
   - `profiles` (id → auth.users, full_name, avatar_url, email_verified)
   - `app_role` enum (`user`, `doctor`, `pharmacist`, `admin`) + `user_roles` table + `has_role()` security-definer fn
   - `prescriptions` (upload metadata, storage path, status)
   - `reports` (JSON: patient, doctor, medicines[], warnings[], interactions[], duplicates[], summary, risk_level, confidence)
   - `shared_reports` (token, expires_at, report_id)
   - `notifications`, `upload_history`, `system_logs`
   - Storage bucket `prescriptions` (private, RLS by owner)
   - RLS + GRANTs on every table; admin promotion only via admin.
7. **Protected `_authenticated` layout** + role-gated sub-layouts.
8. **User dashboard skeleton** with upload page wired to Gemini Vision (server function → AI Gateway → JSON extraction with Zod validation → save report).
9. **Report view page** with medicine cards, risk indicators, warnings, share button, print/PDF.

### Phase 2 (follow-up turns)
- Doctor, Pharmacist, Admin dashboards
- Upload history + filters, retry
- Shared report public view
- Notifications center
- Profile + change password
- Optional Email 2FA + backup codes
- OCR client-side preprocessing (deskew/denoise/sharpen via canvas)
- Analytics + system logs UI

### Technical notes
- Google OAuth via `oauth.signInWithOAuth("google", ...)` + `supabase--configure_social_auth`.
- Phone auth: none exists in current template — nothing to remove.
- Email OTP: uses Supabase's built-in email OTP (`signInWithOtp` / `verifyOtp`) — 6-digit code, configurable expiry.
- Gemini OCR: server function calls the AI Gateway `/v1/chat/completions` with `google/gemini-3-pro-image` (vision), structured JSON output validated with Zod before insert.
- All admin operations use `supabaseAdmin` behind `has_role(auth.uid(), 'admin')` check.
- No mock data — every screen wired to DB via `createServerFn` + TanStack Query.

Phase 1 alone is a large turn (~15–20 files + migration + auth config). Phase 2 items ship in follow-up turns to keep each change reviewable and each turn buildable.

**Approve to start Phase 1, or tell me which phase-2 items to prioritize / defer.**
