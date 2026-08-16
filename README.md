# Trading Journal Platform

## Branch workflow

- main: stable production releases
- develop: tested development changes
- feature/*: isolated work

## Local development

1. Install dependencies with npm.cmd install.
2. Create .env.local from .env.example.
3. Run the app with npm.cmd run dev.
4. Build for production with npm.cmd run build.

## Supabase

Use SUPABASE_SETUP.md as the canonical setup guide.

Run supabase/setup.sql in the Supabase SQL Editor. It is safe to rerun after partial setup and reconciles tables, row-level security policies, storage, triggers, and existing user profiles.

Configure the Confirm signup email template with both ConfirmationURL and Token variables so users can verify by link or code.

Deploy supabase/functions/delete-account/index.ts as delete-account with JWT verification enabled. Supabase injects the SUPABASE-prefixed function secrets automatically; never place the service-role key in browser code or tracked files.

## Vercel

- Build command: npm run build
- Output directory: dist
- Add Supabase variables separately to Preview and Production.
- Deploy develop as previews and main as production.